import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDeadlines } from "@/lib/db/queries/uni";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeadlineForm } from "@/components/uni/deadline-form";
import { DeleteDeadlineButton } from "@/components/uni/uni-delete-buttons";
import { UNI_TABS } from "@/lib/nav-items";

const CATEGORY_LABEL: Record<string, string> = {
  enrolment: "Enrolment",
  withdrawal: "Withdrawal",
  tuition: "Tuition",
  osap: "OSAP",
  exam_period: "Exam period",
  break: "Break",
  other: "Other",
};

export default async function UniDeadlinesPage() {
  const supabase = await createClient();
  const deadlines = await getDeadlines(supabase);
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">University</p>
          <h1 className="text-xl font-semibold">Deadlines</h1>
        </div>
        <DeadlineForm />
      </div>

      <ModuleTabs tabs={UNI_TABS} />

      {deadlines.length === 0 ? (
        <EmptyState title="No deadlines tracked yet" description="Enrolment, tuition, OSAP, and exam-period dates go here." icon={CalendarClock} />
      ) : (
        <div className="space-y-2">
          {deadlines.map((d) => {
            const isPast = new Date(d.due_at) < now;
            return (
              <Card key={d.id} padding="compact" className={isPast ? "opacity-50" : undefined}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
                    <p className="mt-0.5 text-caption text-muted-foreground">
                      {new Date(d.due_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                    {d.notes ? <p className="mt-1 text-caption text-muted-foreground">{d.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{CATEGORY_LABEL[d.category] ?? d.category}</Badge>
                    <DeleteDeadlineButton id={d.id} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
