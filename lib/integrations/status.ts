import "server-only";

/**
 * One vocabulary for "is this external service usable right now", shared by
 * Settings, Home, the AI tool layer and Voice.
 *
 * Without a shared abstraction each surface invents its own check —
 * hasHevyKey() returning a boolean here, a try/catch there — and they drift
 * until Settings claims connected while the AI says unavailable. More
 * importantly, a boolean cannot distinguish the two failures that matter
 * most to a user: "you never set this up" and "it is set up but broken".
 */

export type IntegrationState =
  /** Credentials present and the last interaction worked. */
  | "connected"
  /** Deliberately not set up. Nothing is wrong. */
  | "disconnected"
  /** Needs a key, a token, or an OAuth grant before it can do anything. */
  | "configuration_required"
  /** A sync is in flight. */
  | "syncing"
  /** Configured, but the last interaction failed. */
  | "error"
  /** Cannot work here at all — no adapter, or the provider is unreachable by design. */
  | "unavailable";

export type IntegrationId = "brightspace" | "hevy" | "youtube" | "gemini" | "anthropic" | "sms";

export interface IntegrationStatus {
  id: IntegrationId;
  label: string;
  state: IntegrationState;
  /** One sentence a human can act on. Surfaced verbatim in Settings and to the model. */
  message: string;
  /** What the user must do, when the ball is in their court. */
  actionHint?: string;
  /** Which env vars this integration needs — never their values. */
  requires?: string[];
}

/** States in which asking the integration for data is pointless. */
export function isUsable(state: IntegrationState): boolean {
  return state === "connected" || state === "syncing";
}

/**
 * The status a tool returns when it is asked for data an unusable
 * integration would have supplied. Keeps the wording identical wherever it
 * surfaces, so the model, Settings and Voice all say the same thing.
 */
export function describeUnusable(status: IntegrationStatus): string {
  return status.actionHint ? `${status.message} ${status.actionHint}` : status.message;
}

/**
 * Presence of an env var, without ever reading its value into a return
 * type that could be logged or serialised to a client.
 */
function configured(...names: string[]): boolean {
  return names.every((n) => Boolean(process.env[n]));
}

const SMS_VARS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "OWNER_PHONE_NUMBER",
] as const;

/**
 * Credential-derived status for every integration.
 *
 * Deliberately synchronous and network-free: this runs on Settings, on Home,
 * and on every AI turn, and it must never turn a page render into a fan-out
 * of third-party health checks. It answers "could this work", which is the
 * question that decides whether to offer the feature. Whether a specific
 * call then succeeded is reported by that call, not predicted here.
 */
export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      id: "hevy",
      label: "Hevy",
      state: configured("HEVY_API_KEY") ? "connected" : "configuration_required",
      message: configured("HEVY_API_KEY")
        ? "Workout sync is configured."
        : "Hevy is not connected, so workouts are whatever you log manually.",
      actionHint: configured("HEVY_API_KEY")
        ? undefined
        : "Add HEVY_API_KEY (requires a Hevy Pro subscription) to sync automatically.",
      requires: ["HEVY_API_KEY"],
    },
    {
      id: "brightspace",
      label: "Brightspace",
      state: configured("BRIGHTSPACE_HOST", "BRIGHTSPACE_CLIENT_ID", "BRIGHTSPACE_CLIENT_SECRET")
        ? "disconnected"
        : "configuration_required",
      // Two distinct states, and the difference matters: with no app
      // registered there is nothing to connect TO, whereas a registered app
      // with no token just needs the user to authorise once.
      message: configured("BRIGHTSPACE_HOST", "BRIGHTSPACE_CLIENT_ID", "BRIGHTSPACE_CLIENT_SECRET")
        ? "Brightspace is configured but not authorised yet."
        : "Brightspace is not connected. University data is whatever you entered by hand.",
      actionHint: configured("BRIGHTSPACE_HOST", "BRIGHTSPACE_CLIENT_ID", "BRIGHTSPACE_CLIENT_SECRET")
        ? "Authorise JARVIS from Settings to start syncing."
        : "Register an OAuth app with your institution, then set BRIGHTSPACE_HOST, BRIGHTSPACE_CLIENT_ID and BRIGHTSPACE_CLIENT_SECRET.",
      requires: ["BRIGHTSPACE_HOST", "BRIGHTSPACE_CLIENT_ID", "BRIGHTSPACE_CLIENT_SECRET"],
    },
    {
      id: "youtube",
      label: "YouTube",
      // Client ID/secret are an app REGISTRATION, not a grant — exactly the
      // same distinction as Brightspace. Reporting "connected" from these
      // alone claimed uploads would work when no account had ever authorised
      // JARVIS. Only a stored token in yt_connections earns "connected", and
      // only getIntegrationStatusesWithGrants can see that.
      state: configured("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET")
        ? "disconnected"
        : "configuration_required",
      message: configured("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET")
        ? "YouTube is configured but no account has been authorised yet."
        : "YouTube upload is not configured.",
      actionHint: configured("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET")
        ? "Connect YouTube from Settings to authorise uploads."
        : "Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET to enable uploads.",
      requires: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
    },
    {
      id: "gemini",
      label: "Gemini",
      state: configured("GEMINI_API_KEY") ? "connected" : "configuration_required",
      message: configured("GEMINI_API_KEY")
        ? "The AI Mentor and Voice Mode can respond."
        : "No Gemini key, so the AI Mentor and Voice Mode cannot respond.",
      actionHint: configured("GEMINI_API_KEY") ? undefined : "Set GEMINI_API_KEY.",
      requires: ["GEMINI_API_KEY"],
    },
    {
      id: "anthropic",
      label: "Anthropic",
      state: configured("ANTHROPIC_API_KEY") ? "connected" : "disconnected",
      message: configured("ANTHROPIC_API_KEY")
        ? "Available as an alternate provider for lead qualification."
        : "Not configured. Gemini handles lead qualification instead.",
      requires: ["ANTHROPIC_API_KEY"],
    },
    {
      id: "sms",
      label: "SMS",
      // All four or nothing: the webhook no-ops (empty TwiML) unless every
      // one is set, and OWNER_PHONE_NUMBER is what gates who may text in.
      // Checking only the auth token reported "connected" for a webhook that
      // silently ignored every message.
      state: configured(...SMS_VARS) ? "connected" : "configuration_required",
      message: configured(...SMS_VARS)
        ? "Inbound SMS logging is configured."
        : "SMS logging is not configured.",
      actionHint: configured(...SMS_VARS)
        ? undefined
        : "Set all four Twilio variables — the webhook ignores every message until then.",
      requires: [...SMS_VARS],
    },
  ];
}

export function getIntegrationStatus(id: IntegrationId): IntegrationStatus {
  const found = getIntegrationStatuses().find((s) => s.id === id);
  // Every IntegrationId is listed above, so a miss is a programming error
  // rather than a runtime condition worth a fallback object.
  if (!found) throw new Error(`No status defined for integration "${id}"`);
  return found;
}
