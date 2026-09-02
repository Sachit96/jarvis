import { Clapperboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getScripts, getThumbnails, getYtConnection } from "@/lib/db/queries/youtube";
import { EmptyState } from "@/components/shared/empty-state";
import { ScriptGenerateForm } from "@/components/youtube/script-generate-form";
import { ScriptCard } from "@/components/youtube/script-card";

export default async function YouTubePage() {
  const supabase = await createClient();
  const [scripts, connection] = await Promise.all([getScripts(supabase), getYtConnection(supabase)]);
  const thumbnailsByScript = await Promise.all(scripts.map((s) => getThumbnails(supabase, s.id)));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Content</p>
        <h1 className="text-xl font-semibold">YouTube</h1>
      </div>

      <ScriptGenerateForm />

      {scripts.length === 0 ? (
        <EmptyState title="No scripts yet" description="Generate one above — research, hook, sections, and titles in one shot." icon={Clapperboard} />
      ) : (
        <div className="space-y-3">
          {scripts.map((s, i) => (
            <ScriptCard key={s.id} script={s} thumbnails={thumbnailsByScript[i]} youtubeConnected={!!connection} />
          ))}
        </div>
      )}
    </div>
  );
}
