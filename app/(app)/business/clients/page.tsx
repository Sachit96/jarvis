import { Users, UserPlus, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getContacts, getAllActivities, getAllOnboardingTasks } from "@/lib/db/queries/business";
import { ensureOnboardingTasksAction } from "@/actions/business-actions";
import { ContactCard } from "@/components/business/contact-card";
import { StatTile } from "@/components/shared/stat-tile";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { BUSINESS_TABS } from "@/lib/nav-items";

export default async function ClientsPage() {
  const supabase = await createClient();
  const contacts = await getContacts(supabase);

  await Promise.all(contacts.map((c) => ensureOnboardingTasksAction(c.id)));

  const [activities, onboardingTasks] = await Promise.all([
    getAllActivities(supabase),
    getAllOnboardingTasks(supabase),
  ]);

  const activitiesByContact = new Map<string, typeof activities>();
  for (const a of activities) {
    const list = activitiesByContact.get(a.contact_id) ?? [];
    list.push(a);
    activitiesByContact.set(a.contact_id, list);
  }
  const onboardingByContact = new Map<string, typeof onboardingTasks>();
  for (const t of onboardingTasks) {
    const list = onboardingByContact.get(t.contact_id) ?? [];
    list.push(t);
    onboardingByContact.set(t.contact_id, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Business</p>
        <h1 className="text-xl font-semibold">Clients</h1>
      </div>

      <ModuleTabs tabs={BUSINESS_TABS} />

      {contacts.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          <StatTile label="Total Clients" value={String(contacts.length)} icon={Users} category="business" />
          <StatTile label="Manual" value={String(contacts.filter((c) => c.source === "manual").length)} icon={UserPlus} category="business" />
          <StatTile label="From GHL" value={String(contacts.filter((c) => c.source === "ghl").length)} icon={Link2} category="business" />
        </div>
      ) : null}

      {contacts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No clients yet — add a lead from the Pipeline tab to get started.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              activities={activitiesByContact.get(contact.id) ?? []}
              onboardingTasks={onboardingByContact.get(contact.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
