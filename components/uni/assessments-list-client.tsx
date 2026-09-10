"use client";

import { BookOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { AssessmentItem } from "@/components/uni/assessment-item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASSESSMENT_STATUSES } from "@/lib/validations/uni";
import type { Database } from "@/lib/supabase/database.types";
import { EmptyState } from "@/components/shared/empty-state";

type Assessment = Database["public"]["Tables"]["uni_assessments"]["Row"];
type Course = Database["public"]["Tables"]["uni_courses"]["Row"];
type Group = Database["public"]["Tables"]["uni_assessment_groups"]["Row"];

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  graded: "Graded",
};

export function AssessmentsListClient({
  assessments,
  courses,
  groups,
}: {
  assessments: Assessment[];
  courses: Course[];
  /** Every course's grading groups; each row is handed only its own course's. */
  groups: Group[];
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"urgency" | "weight">("urgency");

  const filtered = useMemo(() => {
    let list = assessments;
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    if (courseFilter !== "all") list = list.filter((a) => a.course_id === courseFilter);
    list = [...list];
    if (sortBy === "urgency") {
      list.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return a.due_at.localeCompare(b.due_at);
      });
    } else {
      list.sort((a, b) => (b.weight_pct ?? 0) - (a.weight_pct ?? 0));
    }
    return list;
  }, [assessments, statusFilter, courseFilter, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="All statuses">All statuses</SelectItem>
            {ASSESSMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s} label={STATUS_LABEL[s]}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={courseFilter} onValueChange={(v) => setCourseFilter(v ?? "all")}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="All courses">All courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id} label={c.code}>
                {c.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => { if (v === "urgency" || v === "weight") setSortBy(v); }}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgency" label="Sort: Urgency">Sort: Urgency</SelectItem>
            <SelectItem value="weight" label="Sort: Weight">Sort: Weight</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="surface">
        <EmptyState icon={BookOpen} title="Nothing matches" description="No assessments fall inside the current filters." />
      </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <AssessmentItem
              key={a.id}
              assessment={a}
              courseCode={courses.find((c) => c.id === a.course_id)?.code}
              courseColor={courses.find((c) => c.id === a.course_id)?.color ?? undefined}
              groups={groups.filter((g) => g.course_id === a.course_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
