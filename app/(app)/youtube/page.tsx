import { Clapperboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getScripts, getYtConnection } from "@/lib/db/queries/youtube";
import { EmptyState } from "@/components/shared/empty-state";
import { ScriptGenerateForm } from "@/components/youtube/script-generate-form";
import { ScriptCard } from "@/components/youtube/script-card";
import { PageHeader } from "@/components/shared/page-header";

export default async function YouTubePage() {
  const supabase = await createClient();
  const [scripts, connection] = await Promise.all([getScripts(supabase), getYtConnection(supabase)]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Content" title="YouTube" />

      <ScriptGenerateForm />

      {scripts.length === 0 ? (
        <EmptyState title="No scripts yet" description="Generate one above — research, hook, sections, and titles in one shot." icon={Clapperboard} />
      ) : (
        <div className="space-y-3">
          {scripts.map((s) => (
            <ScriptCard key={s.id} script={s} youtubeConnected={!!connection} />
          ))}
        </div>
      )}
    </div>
  );
}
