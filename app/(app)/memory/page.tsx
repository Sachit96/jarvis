import { createClient } from "@/lib/supabase/server";
import { getMemoryEntries } from "@/lib/db/queries/memory";
import { MemoryPageClient } from "@/components/memory/memory-page-client";
import { PageHeader } from "@/components/shared/page-header";

export default async function MemoryPage() {
  const supabase = await createClient();
  const entries = await getMemoryEntries(supabase);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Memory" title="Library" />

      <MemoryPageClient entries={entries} />
    </div>
  );
}
