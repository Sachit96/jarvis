import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDeal, getContact, getPipelineStages, getDealTasks, getActivitiesForDeal } from "@/lib/db/queries/business";
import { getBacklinks } from "@/lib/obsidian/wikilinks";
import { DealCard } from "@/components/business/deal-card";
import { DealNotesEditor } from "@/components/business/deal-notes-editor";
import { ActivityForm } from "@/components/business/activity-form";
import { ActivityItem } from "@/components/business/activity-item";
import { Backlinks } from "@/components/shared/backlinks";

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
      <Link href="/business/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Pipeline
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{deal.title || "Untitled deal"}</h1>
        {contact ? (
          <Link href={`/business/clients/${contact.id}`} className="text-sm text-muted-foreground hover:underline">
            {contact.company_name || contact.contact_person}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <DealCard deal={deal} contact={contact ?? undefined} stages={stages} tasks={tasks} />

          <div className="rounded-lg border border-border bg-card p-4">
            <DealNotesEditor dealId={deal.id} notes={deal.notes} />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <Backlinks backlinks={backlinks} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-label uppercase tracking-wide text-muted-foreground">Activity</p>
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
            <p className="mt-3 text-sm text-muted-foreground">No activity logged against this deal yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
