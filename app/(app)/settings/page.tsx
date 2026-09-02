import { Download, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGhlConnection, getGhlSyncLogs } from "@/lib/db/queries/business";
import { getSavedLeadSearches } from "@/lib/db/queries/lead-research";
import { getYtConnection } from "@/lib/db/queries/youtube";
import { AiMentorStatusCard } from "@/components/settings/ai-mentor-status-card";
import { GhlConnectionCard } from "@/components/settings/ghl-connection-card";
import { GhlSyncLogs } from "@/components/settings/ghl-sync-logs";
import { SavedLeadSearchesCard } from "@/components/settings/saved-lead-searches-card";
import { SmsStatusCard } from "@/components/settings/sms-status-card";
import { AnthropicStatusCard } from "@/components/settings/anthropic-status-card";
import { YoutubeConnectionCard } from "@/components/settings/youtube-connection-card";
import { TIER_MODEL } from "@/lib/ai/providers/gemini-client";
import { getAnthropicSpendCap, getAnthropicSpendToDate } from "@/lib/ai/providers/anthropic-client";
import { isMissingRelation } from "@/lib/db/missing-relation";

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
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const [ghlConnection, ghlLogs, savedSearches, ytConnection] = await Promise.all([
    getGhlConnection(supabase),
    getGhlSyncLogs(supabase),
    getSavedLeadSearches(supabase),
    getYtConnection(supabase),
  ]);

  const smsConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER && process.env.OWNER_PHONE_NUMBER,
  );
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

  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const [anthropicCap, anthropicSpent] = await Promise.all([getAnthropicSpendCap(), getAnthropicSpendToDate()]);
  const hasYoutubeKeys = Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">System</p>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      {youtube_connected ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> YouTube connected.
        </div>
      ) : youtube_error ? (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <XCircle className="h-4 w-4" /> {YOUTUBE_ERROR_MESSAGE[youtube_error] ?? "YouTube connection failed."}
        </div>
      ) : null}

      <AiMentorStatusCard
        hasKey={hasGeminiKey}
        model={`${TIER_MODEL.high_volume} (high-volume) + ${TIER_MODEL.structured} (structured)`}
      />

      <GhlConnectionCard connection={ghlConnection} />
      <GhlSyncLogs logs={ghlLogs} />
      <SavedLeadSearchesCard searches={savedSearches} />
      <SmsStatusCard configured={smsConfigured} ownerNumber={process.env.OWNER_PHONE_NUMBER ?? null} recentCount={smsRecentCount} />
      <AnthropicStatusCard hasKey={hasAnthropicKey} spentUsd={anthropicSpent} capUsd={anthropicCap} />
      <YoutubeConnectionCard
        configured={hasYoutubeKeys}
        connected={!!ytConnection}
        channelTitle={ytConnection?.channel_title ?? null}
        connectedAt={ytConnection?.connected_at ?? null}
      />

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Data export</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Download every record you own across all modules as a single JSON file.
        </p>
        <a
          href="/api/export/json"
          download
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80"
        >
          <Download className="h-3.5 w-3.5" /> Export JSON backup
        </a>
      </div>
    </div>
  );
}
