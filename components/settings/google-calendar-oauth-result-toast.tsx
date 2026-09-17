"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const ERROR_MESSAGE: Record<string, string> = {
  access_denied: "Google Calendar connection cancelled.",
  invalid_state: "Connection attempt expired — try again.",
  no_refresh_token: "Google didn't return a refresh token — try connecting again.",
  calendar_setup_failed: "Connected, but creating the JARVIS calendar failed. Try reconnecting.",
  storage_failed: "Connected to Google, but saving the connection failed.",
  token_exchange_failed: "Connecting to Google Calendar failed.",
};

/** Fires the one-shot toast for a redirect back from the OAuth callback route — server components can't call toast() directly. */
export function GoogleCalendarOAuthResultToast({ connected, error }: { connected?: string; error?: string }) {
  useEffect(() => {
    if (connected) toast.success("Google Calendar connected.");
    else if (error) toast.error(ERROR_MESSAGE[error] ?? "Google Calendar connection failed.");
    // connected/error come from the server-rendered redirect URL and are
    // stable for the life of this page load, so this still only fires once
    // per actual redirect landing.
  }, [connected, error]);
  return null;
}
