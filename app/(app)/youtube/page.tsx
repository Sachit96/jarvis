import { Clapperboard, FileText, CircleCheckBig, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getScripts, getYtConnection } from "@/lib/db/queries/youtube";
import { getIntegrationStatus } from "@/lib/integrations/status";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCell, KpiGrid } from "@/components/shared/kpi-grid";
import { ScriptGenerateForm } from "@/components/youtube/script-generate-form";
import { ScriptCard } from "@/components/youtube/script-card";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";

/**
 * The pipeline stages a script moves through, in order. These are the
 * `yt_scripts.status` values that already exist (see YT_STATUSES) — no new
 * states were invented to make the board look fuller.
 */
const PIPELINE = [
  { key: "draft", label: "Drafted", icon: FileText },
  { key: "approved", label: "Approved", icon: CircleCheckBig },
  { key: "used", label: "Published", icon: Upload },
] as const;

export default async function YouTubePage() {
  const supabase = await createClient();
  const [scripts, connection] = await Promise.all([getScripts(supabase), getYtConnection(supabase)]);
  const youtube = getIntegrationStatus("youtube");
  const counts = Object.fromEntries(
    PIPELINE.map((stage) => [stage.key, scripts.filter((s) => s.status === stage.key).length]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="YouTube"
        description="Scripts, and where each one has got to."
      />

      {/* The counts are the pipeline. Nothing here claims a connection the
          app does not have: the upload state below reads from the shared
          integration status, so a disconnected channel says so plainly
          rather than showing an empty analytics panel. */}
      <KpiGrid columns={4}>
        {PIPELINE.map((stage, i) => (
          <KpiCell
            key={stage.key}
            label={stage.label}
            icon={stage.icon}
            primary={i === 0}
            value={counts[stage.key] ?? 0}
            hint={i === 0 ? "Generated, not yet reviewed" : i === 1 ? "Ready to record" : "Uploaded to the channel"}
          />
        ))}
        <KpiCell
          label="Channel"
          icon={Clapperboard}
          value={connection?.channel_title ?? (youtube.state === "connected" ? "Connected" : "Not connected")}
          hint={connection ? "Uploads go straight to this channel" : youtube.message}
        />
      </KpiGrid>

      <ScriptGenerateForm />

      {scripts.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={Clapperboard}
            title="No scripts yet"
            description="Generate one above — research, hook, sections and titles in one shot."
          />
        </div>
      ) : (
        <section className="space-y-3">
          <SectionHeader title="Scripts" description={`${scripts.length} in the pipeline`} />
          <div className="space-y-3">
            {scripts.map((s) => (
              <ScriptCard key={s.id} script={s} youtubeConnected={!!connection} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
