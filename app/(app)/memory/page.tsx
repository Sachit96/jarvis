import { createClient } from "@/lib/supabase/server";
import { getMemoryEntries } from "@/lib/db/queries/memory";
import { MemoryPageClient } from "@/components/memory/memory-page-client";

export default async function MemoryPage() {
  const supabase = await createClient();
  const entries = await getMemoryEntries(supabase);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-label uppercase tracking-wide text-muted-foreground">Memory</p>
        <h1 className="text-title">Library</h1>
      </div>

      <MemoryPageClient entries={entries} />
    </div>
  );
}
