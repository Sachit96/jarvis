"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkoutSessionCard } from "@/components/health/workout-session-card";
import type { Database } from "@/lib/supabase/database.types";

type Workout = Database["public"]["Tables"]["workouts"]["Row"];
type WorkoutSet = Database["public"]["Tables"]["workout_sets"]["Row"];
type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

const PAGE_SIZE = 10;

/**
 * Paginates the session list client-side (all sessions are already fetched
 * server-side — same data, just not all rendered as live forms at once).
 * Found live (2026-09-06 audit): 23 sessions rendered unconditionally came
 * to ~5,000px of always-mounted editable forms. Each WorkoutSessionCard
 * itself only mounts its heavier controls (set list, add-set form) once
 * expanded — this just keeps the *count* of mounted cards bounded too.
 */
export function WorkoutsList({
  rows,
  exercises,
}: {
  /** Pre-joined server-side (a Map doesn't need to cross the server/client
   * boundary just to be unwrapped back into per-row arrays here — plain
   * arrays are what every other client component in this app already
   * receives). */
  rows: { workout: Workout; sets: WorkoutSet[] }[];
  exercises: Exercise[];
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const pageItems = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-3">
      {pageItems.map(({ workout, sets }) => (
        <WorkoutSessionCard key={workout.id} workout={workout} sets={sets} exercises={exercises} />
      ))}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 pt-1 text-caption text-muted-foreground">
          <p>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <p className="tabular-nums">
              Page {page + 1} of {pageCount}
            </p>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
