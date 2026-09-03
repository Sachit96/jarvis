import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getContact,
  getActivitiesForContact,
  getOnboardingTasksForContact,
  getContractsForContact,
  getDealsForContact,
  getPipelineStages,
} from "@/lib/db/queries/business";
import { getBacklinks } from "@/lib/obsidian/wikilinks";
import { ensureOnboardingTasksAction } from "@/actions/business-actions";
import { Badge } from "@/components/ui/badge";
import { ActivityForm } from "@/components/business/activity-form";
import { ActivityItem } from "@/components/business/activity-item";
import { OnboardingChecklist } from "@/components/business/onboarding-checklist";
import { ContractCard } from "@/components/business/contract-card";
import { ContactNotesEditor } from "@/components/business/contact-notes-editor";
import { Backlinks } from "@/components/shared/backlinks";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const contact = await getContact(supabase, id);
  if (!contact) notFound();

  await ensureOnboardingTasksAction(id);

  const [activities, onboardingTasks, contracts, deals, stages, backlinks] = await Promise.all([
    getActivitiesForContact(supabase, id),
    getOnboardingTasksForContact(supabase, id),
    getContractsForContact(supabase, id),
    getDealsForContact(supabase, id),
    getPipelineStages(supabase),
    getBacklinks(supabase, "contact", id),
  ]);
  const stageById = new Map(stages.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <Link href="/business/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Clients
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{contact.contact_person}</h1>
            {contact.source !== "manual" ? (
              <Badge variant="outline" className="text-[10px] uppercase">
                {contact.source}
              </Badge>
            ) : null}
          </div>
          {contact.company_name ? <p className="text-sm text-muted-foreground">{contact.company_name}</p> : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm">
            {contact.phone ? (
              <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 text-success hover:underline">
                <Phone className="h-3.5 w-3.5" /> {contact.phone}
              </a>
            ) : null}
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Mail className="h-3.5 w-3.5" /> {contact.email}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <ContactNotesEditor contactId={contact.id} notes={contact.notes} />
          </div>

          {deals.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-label uppercase tracking-wide text-muted-foreground">Deals</p>
              <ul className="mt-2 space-y-1.5">
                {deals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/business/pipeline/${d.id}`} className="truncate hover:underline">
                      {d.title || "Untitled deal"}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{stageById.get(d.stage_id)?.name ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {contracts.length > 0 ? (
            <div className="space-y-3">
              <p className="text-label uppercase tracking-wide text-muted-foreground">Contracts</p>
              {contracts.map((c) => (
                <ContractCard key={c.id} contract={c} contact={contact} />
              ))}
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-card p-4">
            <OnboardingChecklist contactId={contact.id} tasks={onboardingTasks} />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <Backlinks backlinks={backlinks} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-label uppercase tracking-wide text-muted-foreground">Activity</p>
          <div className="mt-2">
            <ActivityForm contactId={contact.id} />
          </div>
          {activities.length > 0 ? (
            <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
              {activities.map((a) => (
                <ActivityItem key={a.id} activity={a} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No activity logged yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
