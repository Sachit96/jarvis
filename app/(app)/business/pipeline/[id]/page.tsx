import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDeal, getContact, getPipelineStages, getDealTasks, getActivitiesForDeal } from "@/lib/db/queries/business";
import { getBacklinks } from "@/lib/obsidian/wikilinks";
import { DealCard } from "@/components/business/deal-card";
import { DealNotesEditor } from "@/components/business/deal-notes-editor";
import { ActivityForm } from "@/components/business/activity-form";
import { ActivityItem } from "@/components/business/activity-item";
import { Backlinks } from "@/components/shared/backlinks";
import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { DealTasksCard } from "@/components/business/deal-tasks-card";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const deal = await getDeal(supabase, id);
  if (!deal) notFound();

  const [contact, stages, tasks, activities, backlinks] = await Promise.all([
    getContact(supabase, deal.contact_id),
    getPipelineStages(supabase),
    getDealTasks(supabase, [deal.id]),
    getActivitiesForDeal(supabase, deal.id),
    getBacklinks(supabase, "deal", id),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/business/pipeline" label="Pipeline" />

      <PageHeader
        eyebrow="Deal"
        title={deal.title || "Untitled deal"}
        description={
          contact ? (
            <Link href={`/business/clients/${contact.id}`} className="hover:text-foreground hover:underline">
              {contact.company_name || contact.contact_person}
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <DealCard deal={deal} contact={contact ?? undefined} stages={stages} tasks={tasks} />

          {/* The board card no longer carries its own task list, so this is
              where the "N open" counter on the board actually leads. */}
          <DealTasksCard dealId={deal.id} tasks={tasks} />

          <div className="surface p-4">
            <DealNotesEditor dealId={deal.id} notes={deal.notes} />
          </div>

          <Backlinks backlinks={backlinks} card />
        </div>

        <div className="surface p-4">
          <p className="eyebrow">Activity</p>
          <div className="mt-2">
            <ActivityForm contactId={deal.contact_id} dealId={deal.id} />
          </div>
          {activities.length > 0 ? (
            <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
              {activities.map((a) => (
                <ActivityItem key={a.id} activity={a} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-body text-foreground-tertiary">No activity logged against this deal yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
