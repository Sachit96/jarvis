-- UniOS core (Work Order 2). New domain at /uni, reusing the app's existing
-- auth gate (proxy.ts), Gemini tiering, memory system, and design tokens —
-- not a separate app. Same single-user, no-RLS-policy posture as every
-- table created since 0012_remove_auth.sql: no user_id column anywhere.
--
-- Same divergence from the pre-0012 schema as lead_research/research_runs/
-- gemini_usage/scheduled_runs/saved_lead_searches — RLS enabled with zero
-- policies on every table below, deny-all to the anon key. The
-- service-role client this app actually uses bypasses this regardless.

create table public.uni_courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  professor text,
  professor_email text,
  room text,
  description text,
  term text not null,
  color text,
  credit_weight numeric(4,2) not null default 3.0 check (credit_weight > 0),
  target_grade numeric(5,2) check (target_grade >= 0 and target_grade <= 100),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.uni_courses
  for each row execute function extensions.moddatetime(updated_at);
create index uni_courses_term_idx on public.uni_courses (term, archived);
alter table public.uni_courses enable row level security;

create table public.uni_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.uni_courses(id) on delete cascade,
  type text not null check (type in ('lecture', 'tutorial', 'lab', 'office_hours')),
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = Sunday, matches JS Date#getDay()
  start_time time not null,
  end_time time not null check (end_time > start_time),
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.uni_schedule_blocks
  for each row execute function extensions.moddatetime(updated_at);
create index uni_schedule_blocks_course_idx on public.uni_schedule_blocks (course_id);
create index uni_schedule_blocks_day_idx on public.uni_schedule_blocks (day_of_week);
alter table public.uni_schedule_blocks enable row level security;

create table public.uni_assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.uni_courses(id) on delete cascade,
  title text not null,
  type text not null check (type in ('assignment', 'quiz', 'midterm', 'final', 'presentation', 'participation')),
  due_at timestamptz,
  weight_pct numeric(5,2) not null check (weight_pct >= 0 and weight_pct <= 100),
  max_score numeric(7,2) not null default 100 check (max_score > 0),
  earned_score numeric(7,2) check (earned_score >= 0),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'submitted', 'graded')),
  estimated_hours numeric(5,1) check (estimated_hours >= 0),
  difficulty int check (difficulty between 1 and 5),
  notes text,
  -- 'syllabus' rows come from the review-before-write parse flow (Work
  -- Order 3) — never written directly from a parse, only after the user
  -- confirms the extracted list on the review screen.
  source text not null default 'manual' check (source in ('manual', 'syllabus')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.uni_assessments
  for each row execute function extensions.moddatetime(updated_at);
create index uni_assessments_course_idx on public.uni_assessments (course_id);
create index uni_assessments_due_idx on public.uni_assessments (due_at);
create index uni_assessments_status_idx on public.uni_assessments (status);
alter table public.uni_assessments enable row level security;

create table public.uni_assessment_requirements (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.uni_assessments(id) on delete cascade,
  requirement text not null,
  completed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.uni_assessment_requirements
  for each row execute function extensions.moddatetime(updated_at);
create index uni_assessment_requirements_assessment_idx on public.uni_assessment_requirements (assessment_id, sort_order);
alter table public.uni_assessment_requirements enable row level security;

create table public.uni_study_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.uni_courses(id) on delete cascade,
  assessment_id uuid references public.uni_assessments(id) on delete set null,
  planned_start timestamptz not null,
  planned_minutes int not null check (planned_minutes > 0),
  actual_minutes int check (actual_minutes >= 0),
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.uni_study_sessions
  for each row execute function extensions.moddatetime(updated_at);
create index uni_study_sessions_course_idx on public.uni_study_sessions (course_id);
create index uni_study_sessions_planned_idx on public.uni_study_sessions (planned_start);
alter table public.uni_study_sessions enable row level security;

create table public.uni_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.uni_courses(id) on delete cascade,
  title text not null,
  type text not null check (type in ('slides', 'notes', 'reading', 'practice_exam', 'syllabus', 'other')),
  body text not null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.uni_materials
  for each row execute function extensions.moddatetime(updated_at);
create index uni_materials_course_idx on public.uni_materials (course_id, uploaded_at desc);
alter table public.uni_materials enable row level security;

-- University-wide, not tied to any one course (enrolment deadlines,
-- tuition due dates, OSAP, exam period boundaries).
create table public.uni_deadlines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_at timestamptz not null,
  category text not null check (category in ('enrolment', 'withdrawal', 'tuition', 'osap', 'exam_period', 'break', 'other')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.uni_deadlines
  for each row execute function extensions.moddatetime(updated_at);
create index uni_deadlines_due_idx on public.uni_deadlines (due_at);
alter table public.uni_deadlines enable row level security;
