import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGhlConnection, getGhlSyncLogs } from "@/lib/db/queries/business";
import { getSavedLeadSearches } from "@/lib/db/queries/lead-research";
import { AiMentorStatusCard } from "@/components/settings/ai-mentor-status-card";
import { GhlConnectionCard } from "@/components/settings/ghl-connection-card";
import { GhlSyncLogs } from "@/components/settings/ghl-sync-logs";
import { SavedLeadSearchesCard } from "@/components/settings/saved-lead-searches-card";
import { SmsStatusCard } from "@/components/settings/sms-status-card";
import { TIER_MODEL } from "@/lib/ai/providers/gemini-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const [ghlConnection, ghlLogs, savedSearches] = await Promise.all([
    getGhlConnection(supabase),
    getGhlSyncLogs(supabase),
    getSavedLeadSearches(supabase),
  ]);

  const smsConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER && process.env.OWNER_PHONE_NUMBER,
  );
  const { count: smsRecentCount } = smsConfigured
    ? await supabase
        .from("sms_messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    : { count: 0 };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">System</p>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <AiMentorStatusCard
        hasKey={hasGeminiKey}
        model={`${TIER_MODEL.high_volume} (high-volume) + ${TIER_MODEL.structured} (structured)`}
      />

      <GhlConnectionCard connection={ghlConnection} />
      <GhlSyncLogs logs={ghlLogs} />
      <SavedLeadSearchesCard searches={savedSearches} />
      <SmsStatusCard configured={smsConfigured} ownerNumber={process.env.OWNER_PHONE_NUMBER ?? null} recentCount={smsRecentCount ?? 0} />

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
