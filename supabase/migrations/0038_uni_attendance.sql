-- University attendance.
--
-- The Student Dashboard pattern JARVIS is modelling here is built around
-- attendance percentages per course, and nothing in this schema recorded
-- attendance at all — uni_schedule_blocks says when a class HAPPENS, but not
-- whether you were in it.
--
-- Deliberately one row per class occurrence rather than a running counter on
-- uni_courses. A counter cannot answer "which classes did I miss", cannot be
-- corrected without losing history, and cannot produce a trend. A row per
-- occurrence gives all three, and the percentages are derived.
--
-- This is self-sustaining with no external integration: uni_schedule_blocks
-- already generates the class occurrences, and the student marks each one.
-- No LMS, no import, no credentials.

create table public.uni_attendance (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.uni_courses(id) on delete cascade,
  -- Nullable: a one-off lecture or a rescheduled class has no recurring block.
  schedule_block_id uuid references public.uni_schedule_blocks(id) on delete set null,
  -- Date, not timestamp. Attendance is a fact about a day's class, and a
  -- timestamp would invite timezone bugs on a value nobody reads as a time.
  class_date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One record per class occurrence. Marking the same class twice is a
  -- correction, not a second data point, so it updates in place.
  unique (course_id, class_date, schedule_block_id)
);

create index uni_attendance_course_date_idx on public.uni_attendance (course_id, class_date desc);

create trigger set_updated_at before update on public.uni_attendance
  for each row execute function extensions.moddatetime(updated_at);

-- Same as every table since 0012: RLS on with zero policies, deny-all to the
-- anon key. Only the service-role client reaches this.
alter table public.uni_attendance enable row level security;
