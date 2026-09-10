import { NotebookPen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getJournalEntries } from "@/lib/db/queries/life";
import { JournalForm } from "@/components/life/journal-form";
import { JournalEntryCard } from "@/components/life/journal-entry-card";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { TASKS_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default async function JournalPage() {
  const supabase = await createClient();
  const entries = await getJournalEntries(supabase);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Life" title="Journal" />

      <ModuleTabs tabs={TASKS_TABS} />

      <JournalForm />

      {entries.length === 0 ? (
        <div className="surface">
          <EmptyState icon={NotebookPen} title="No entries yet" description="Write a reflection above — entries stay searchable from Memory afterwards." />
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <JournalEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
