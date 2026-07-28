import { createClient } from "@/lib/supabase/server";
import { getJournalEntries } from "@/lib/db/queries/life";
import { JournalForm } from "@/components/life/journal-form";
import { JournalEntryCard } from "@/components/life/journal-entry-card";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { TASKS_TABS } from "@/lib/nav-items";

export default async function JournalPage() {
  const supabase = await createClient();
  const entries = await getJournalEntries(supabase);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Life</p>
        <h1 className="text-xl font-semibold">Journal</h1>
      </div>

      <ModuleTabs tabs={TASKS_TABS} />

      <JournalForm />

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No entries yet — write your first reflection above.
        </p>
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
