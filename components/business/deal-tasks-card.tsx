import { CheckSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/page-header";
import { AddDealTaskForm } from "@/components/business/add-deal-task-form";
import { DealTaskItem } from "@/components/business/deal-task-item";
import type { Database } from "@/lib/supabase/database.types";

type DealTask = Database["public"]["Tables"]["deal_tasks"]["Row"];

/**
 * Follow-ups for one deal.
 *
 * These used to live inline on every board card, which made the pipeline a
 * wall of inputs. Moving them off the board only works if they land
 * somewhere — this is that somewhere, and it is where the board's "3 open"
 * counter points.
 */
export function DealTasksCard({ dealId, tasks }: { dealId: string; tasks: DealTask[] }) {
  // Open first, then by due date (undated last), so the next thing to do is
  // the first thing you read.
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.created_at.localeCompare(b.created_at);
  });
  const open = tasks.filter((t) => !t.completed).length;

  return (
    <Card padding="slotted">
      <div className="px-(--card-spacing)">
        <SectionHeader
          title="Follow-ups"
          description={
            tasks.length === 0
              ? undefined
              : `${open} open of ${tasks.length}`
          }
        />
      </div>

      <div className="px-(--card-spacing)">
        <AddDealTaskForm dealId={dealId} />
      </div>

      <div className="px-(--card-spacing)">
        {sorted.length === 0 ? (
          <EmptyState
            compact
            icon={CheckSquare}
            title="No follow-ups"
            description="Add the next thing this deal needs and it will show on the board as an open count."
          />
        ) : (
          <ul className="space-y-2.5">
            {sorted.map((task) => (
              <DealTaskItem key={task.id} task={task} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
