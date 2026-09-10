import { CheckCircle2, XCircle } from "lucide-react";
import { ExportBackupButton } from "@/components/settings/export-backup-button";
import { createClient } from "@/lib/supabase/server";
import { getIntegrationStatus, type IntegrationId } from "@/lib/integrations/status";
import { getSavedLeadSearches } from "@/lib/db/queries/lead-research";
import { getYtConnection } from "@/lib/db/queries/youtube";
import { AiMentorStatusCard } from "@/components/settings/ai-mentor-status-card";
import { IntegrationStatusCard } from "@/components/settings/integration-status-card";
import { BrightspaceConnectionCard } from "@/components/settings/brightspace-connection-card";
import { SavedLeadSearchesCard } from "@/components/settings/saved-lead-searches-card";
import { SmsStatusCard } from "@/components/settings/sms-status-card";
import { AnthropicStatusCard } from "@/components/settings/anthropic-status-card";
import { YoutubeConnectionCard } from "@/components/settings/youtube-connection-card";
import { TIER_MODEL } from "@/lib/ai/providers/gemini-client";
import { getAnthropicSpendCap, getAnthropicSpendToDate } from "@/lib/ai/providers/anthropic-client";
import { isMissingRelation } from "@/lib/db/missing-relation";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";

// Extracted so Date.now() isn't called directly inside the Server
// Component body — same react-hooks/purity pattern as daysAgoIso() in
// lib/db/queries/voice.ts.
function oneDayAgoIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

const YOUTUBE_ERROR_MESSAGE: Record<string, string> = {
  access_denied: "YouTube connection cancelled.",
  invalid_state: "YouTube connection failed a security check — try connecting again.",
  no_refresh_token: "Google didn't return a refresh token — try connecting again (this usually resolves itself).",
  storage_failed: "Connected, but saving the connection failed — try again.",
  token_exchange_failed: "YouTube connection failed during token exchange.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ youtube_connected?: string; youtube_error?: string }>;
}) {
  const { youtube_connected, youtube_error } = await searchParams;
  const supabase = await createClient();
  // Derived from the shared status module rather than re-read here: the SMS
  // four-variable rule in particular now lives in exactly one place, so this
  // page and the board below it cannot disagree about what configured means.
  const statusOf = (id: IntegrationId) => getIntegrationStatus(id).state;
  const hasGeminiKey = statusOf("gemini") === "connected";
  const [savedSearches, ytConnection] = await Promise.all([
    getSavedLeadSearches(supabase),
    getYtConnection(supabase),
  ]);

  const smsConfigured = statusOf("sms") === "connected";
  // Degrades to 0 if migration 0024 hasn't run yet — see lib/db/missing-relation.ts.
  let smsRecentCount = 0;
  if (smsConfigured) {
    const { count, error } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneDayAgoIso());
    if (error && !isMissingRelation(error)) throw error;
    smsRecentCount = count ?? 0;
  }

  const hasAnthropicKey = statusOf("anthropic") === "connected";
  const [anthropicCap, anthropicSpent] = await Promise.all([getAnthropicSpendCap(), getAnthropicSpendToDate()]);
  // configuration_required is the one state meaning no app is registered;
  // disconnected means registered but not yet authorised.
  const hasYoutubeKeys = statusOf("youtube") !== "configuration_required";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="What JARVIS can reach, what it is allowed to spend, and how to get your data out."
      />

      {youtube_connected ? (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-body text-success">
          <CheckCircle2 className="size-4 shrink-0" /> YouTube connected.
        </div>
      ) : youtube_error ? (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-body text-danger">
          <XCircle className="size-4 shrink-0" />{" "}
          {YOUTUBE_ERROR_MESSAGE[youtube_error] ?? "YouTube connection failed."}
        </div>
      ) : null}

      {/* The at-a-glance board goes first; the cards below it stay because
          each does something this one does not (spend caps, OAuth connect,
          saved searches) rather than just reporting a state.

          Grouped into three sections and paired into two columns from lg up:
          as one flat stack of eight equally-weighted cards at full page
          width, every line ran ~120 characters and nothing indicated which
          card was a status readout and which needed action. */}
      <section className="space-y-3">
        <SectionHeader
          title="Connections"
          description="Anything not connected is simply unavailable — no data is invented in its place."
        />
        <IntegrationStatusCard />
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <BrightspaceConnectionCard />
          <YoutubeConnectionCard
            configured={hasYoutubeKeys}
            connected={!!ytConnection}
            channelTitle={ytConnection?.channel_title ?? null}
            connectedAt={ytConnection?.connected_at ?? null}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Intelligence"
          description="Which models are reachable, and the ceiling on what the paid one may spend."
        />
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <AiMentorStatusCard
            hasKey={hasGeminiKey}
            model={`${TIER_MODEL.high_volume} (high-volume) + ${TIER_MODEL.structured} (structured)`}
          />
          <AnthropicStatusCard hasKey={hasAnthropicKey} spentUsd={anthropicSpent} capUsd={anthropicCap} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Automation and data" />
        <SavedLeadSearchesCard searches={savedSearches} />
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <SmsStatusCard
            configured={smsConfigured}
            ownerNumber={process.env.OWNER_PHONE_NUMBER ?? null}
            recentCount={smsRecentCount}
          />
          <div className="surface p-5">
            <p className="eyebrow">Data export</p>
            <p className="mt-2 mb-3 text-body text-foreground-tertiary">
              Download every record you own across all modules as a single JSON file.
            </p>
            <ExportBackupButton />
          </div>
        </div>
      </section>
    </div>
  );
}
