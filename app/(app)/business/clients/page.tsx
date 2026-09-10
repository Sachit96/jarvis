import { Users, UserPlus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getContacts, getAllActivities, getAllOnboardingTasks } from "@/lib/db/queries/business";
import { ensureOnboardingTasksAction } from "@/actions/business-actions";
import { ContactCard } from "@/components/business/contact-card";
import { StatTile } from "@/components/shared/stat-tile";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { BUSINESS_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

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
      <PageHeader eyebrow="Business" title="Clients" />

      <ModuleTabs tabs={BUSINESS_TABS} />

      {contacts.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          <StatTile label="Total Clients" value={String(contacts.length)} icon={Users} />
          <StatTile label="Manual" value={String(contacts.filter((c) => c.source === "manual").length)} icon={UserPlus} />
          <StatTile label="From Lead Research" value={String(contacts.filter((c) => c.source === "research_agent").length)} icon={Search} />
        </div>
      ) : null}

      {contacts.length === 0 ? (
        <div className="surface">
          <EmptyState icon={Users} title="No clients yet" description="Move a deal to a won stage on the Pipeline board and the client will appear here." />
        </div>
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
