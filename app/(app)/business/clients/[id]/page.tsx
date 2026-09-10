import { notFound } from "next/navigation";
import Link from "next/link";
import { Phone, Mail } from "lucide-react";
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
import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";

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
      <BackLink href="/business/clients" label="Clients" />

      <PageHeader
        eyebrow={contact.company_name ?? "Client"}
        title={contact.contact_person}
        description={
          contact.phone || contact.email ? (
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {contact.phone ? (
                <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <Phone className="size-3.5" strokeWidth={2} /> {contact.phone}
                </a>
              ) : null}
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <Mail className="size-3.5" strokeWidth={2} /> {contact.email}
                </a>
              ) : null}
            </span>
          ) : undefined
        }
        actions={
          contact.source !== "manual" ? (
            <Badge variant="outline" className="uppercase">
              {contact.source}
            </Badge>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <div className="surface p-4">
            <ContactNotesEditor contactId={contact.id} notes={contact.notes} />
          </div>

          {deals.length > 0 ? (
            <div className="surface p-4">
              <p className="eyebrow">Deals</p>
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
              <p className="eyebrow">Contracts</p>
              {contracts.map((c) => (
                <ContractCard key={c.id} contract={c} contact={contact} />
              ))}
            </div>
          ) : null}

          <div className="surface p-4">
            <OnboardingChecklist contactId={contact.id} tasks={onboardingTasks} />
          </div>

          <div className="surface p-4">
            <Backlinks backlinks={backlinks} />
          </div>
        </div>

        <div className="surface p-4">
          <p className="eyebrow">Activity</p>
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
            <p className="mt-3 text-body text-foreground-tertiary">No activity logged yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
