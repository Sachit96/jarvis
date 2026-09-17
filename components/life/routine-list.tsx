import { byDay, formatTime } from "@/lib/life/timetable";
import { DeleteLifeScheduleBlockButton } from "@/components/life/delete-life-schedule-block-button";
import type { WeekBlock } from "@/lib/db/queries/life-schedule";

const CATEGORY_LABEL: Record<string, string> = {
  self_care: "Self-care",
  commute: "Commute",
  deep_work: "On Radar",
  gym: "Gym",
  meal: "Meal",
  personal: "Personal",
};

/**
 * The routine, as a plain list grouped by day — editable rows for the
 * grid above, which is deliberately read-only (a block in an absolute-
 * positioned grid is a poor hit target for a delete button). Class blocks
 * are excluded: they're University's data, deleted from there.
 */
export function RoutineList({ blocks }: { blocks: WeekBlock[] }) {
  const lifeBlocks = blocks.filter((b) => b.kind === "life");
  const days = byDay(lifeBlocks);
  const nonEmptyDays = days.filter((d) => d.blocks.length > 0);

  if (nonEmptyDays.length === 0) return null;

  return (
    <div className="surface space-y-4">
      <p className="eyebrow">Your routine</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {nonEmptyDays.map((day) => (
          <div key={day.dayOfWeek} className="space-y-1.5">
            <p className="text-label font-medium text-muted-foreground">{day.label}</p>
            <ul className="space-y-1">
              {day.blocks.map((block) => (
                <li key={block.id} className="flex items-center justify-between gap-2 text-caption">
                  <span className="min-w-0 truncate">
                    {formatTime(block.start_time)}–{formatTime(block.end_time)} · {block.label}
                    <span className="text-muted-foreground"> · {CATEGORY_LABEL[block.category] ?? block.category}</span>
                  </span>
                  <DeleteLifeScheduleBlockButton id={block.id.replace(/^life-/, "")} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
