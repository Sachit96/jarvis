"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { deleteContactAction } from "@/actions/business-actions";
import { ActivityForm } from "@/components/business/activity-form";
import { ActivityItem } from "@/components/business/activity-item";
import { OnboardingChecklist } from "@/components/business/onboarding-checklist";
import type { Database } from "@/lib/supabase/database.types";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type Activity = Database["public"]["Tables"]["activities"]["Row"];
type OnboardingTask = Database["public"]["Tables"]["client_onboarding_tasks"]["Row"];

export function ContactCard({
  contact,
  activities,
  onboardingTasks,
}: {
  contact: Contact;
  activities: Activity[];
  onboardingTasks: OnboardingTask[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={cn("space-y-3 rounded-lg border border-border bg-card p-4", isPending && "opacity-50")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/business/clients/${contact.id}`} className="truncate text-sm font-medium hover:underline">
              {contact.contact_person}
            </Link>
            {contact.source === "ghl" ? (
              <Badge variant="outline" className="text-[10px] uppercase">
                GHL
              </Badge>
            ) : null}
          </div>
          {contact.company_name ? (
            <p className="truncate text-xs text-muted-foreground">{contact.company_name}</p>
          ) : null}
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {[contact.email, contact.phone].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          onClick={() => startTransition(() => deleteContactAction(contact.id))}
          aria-label="Delete contact"
          className="relative after:absolute after:-inset-3.5 shrink-0 text-muted-foreground hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {contact.notes ? <p className="text-xs text-muted-foreground">{contact.notes}</p> : null}

      <div className="space-y-1.5 border-t border-border pt-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Activity</p>
        {activities.length > 0 ? (
          <ul className="space-y-1">
            {activities.slice(0, 5).map((a) => (
              <ActivityItem key={a.id} activity={a} />
            ))}
          </ul>
        ) : null}
        <ActivityForm contactId={contact.id} />
      </div>

      <div className="border-t border-border pt-2">
        <OnboardingChecklist contactId={contact.id} tasks={onboardingTasks} />
      </div>
    </div>
  );
}
