-- UniOS state check — run in the Supabase SQL editor, one query per tab.
-- Read-only. Establishes what UniOS actually holds before the Fall 2026
-- D2L audit is reconciled into it.

-- 1. Courses
select code, name, professor, room, term_start, term_end, credit_weight, archived
from public.uni_courses
order by code;

-- 2. Schedule blocks (0 = Sunday .. 6 = Saturday)
select c.code, b.type, b.day_of_week, b.start_time, b.end_time, b.room
from public.uni_schedule_blocks b
join public.uni_courses c on c.id = b.course_id
order by b.day_of_week, b.start_time;

-- 3. Assessment coverage per course, with the group-aware weight total.
--    naive_sum counts every row; effective_sum discounts the drop-lowest
--    excess (e.g. QMS 110's 12 MyLabMath rows at 2.0% read 24 naive / 20 real).
select
  c.code,
  count(a.id)                                          as rows,
  count(a.id) filter (where a.weight_pct is null)      as unweighted,
  count(a.id) filter (where a.needs_verification)      as flagged,
  count(a.id) filter (where a.due_at is null)          as undated,
  coalesce(sum(a.weight_pct), 0)                       as naive_sum,
  coalesce(sum(a.weight_pct), 0)
    - coalesce((
        select sum(g.drop_lowest_count * sub.unit)
        from public.uni_assessment_groups g
        join lateral (
          select max(a2.weight_pct) as unit
          from public.uni_assessments a2 where a2.group_id = g.id
        ) sub on true
        where g.course_id = c.id
      ), 0)                                            as effective_sum
from public.uni_courses c
left join public.uni_assessments a on a.course_id = c.id
group by c.id, c.code
order by c.code;

-- 4. Everything already flagged for verification
select c.code, a.title, a.type, a.due_at, a.weight_pct, a.verification_note
from public.uni_assessments a
join public.uni_courses c on c.id = a.course_id
where a.needs_verification
order by c.code, a.due_at nulls last;

-- 5. Anything overdue and not submitted, as of now
select c.code, a.title, a.due_at, a.weight_pct, a.status
from public.uni_assessments a
join public.uni_courses c on c.id = a.course_id
where a.due_at < now() and a.status in ('not_started', 'in_progress')
order by a.due_at;

-- 6. University dates + no-class periods
select title, due_at::date as starts, end_at::date as ends, category from public.uni_deadlines order by due_at;
select c.code, p.start_date, p.end_date, p.label
from public.uni_no_class_periods p
left join public.uni_courses c on c.id = p.course_id
order by p.start_date;
