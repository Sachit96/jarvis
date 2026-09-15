import { test } from "node:test";
import assert from "node:assert/strict";
import { classesOnDate, noClassReason } from "../lib/uni/class-day.ts";

const MON = { course_id: "c1", day_of_week: 1 };
const TUE = { course_id: "c2", day_of_week: 2 };

test("classes on a date", async (t) => {
  await t.test("matches on weekday", () => {
    // 2026-09-14 is a Monday.
    assert.deepEqual(classesOnDate([MON, TUE], "2026-09-14"), [MON]);
  });

  await t.test("a course with no term dates is never clamped", () => {
    const courses = [{ id: "c1" }];
    assert.equal(classesOnDate([MON], "2026-09-14", { courses }).length, 1);
  });

  await t.test("drops classes before the term starts and after it ends", () => {
    const courses = [{ id: "c1", term_start: "2026-09-08", term_end: "2026-12-08" }];
    assert.equal(classesOnDate([MON], "2026-09-07", { courses }).length, 0);
    assert.equal(classesOnDate([MON], "2026-09-14", { courses }).length, 1);
    assert.equal(classesOnDate([MON], "2026-12-14", { courses }).length, 0);
  });

  await t.test("term bounds are inclusive", () => {
    // 2026-09-14 and 2026-11-30 are both Mondays.
    const courses = [{ id: "c1", term_start: "2026-09-14", term_end: "2026-11-30" }];
    assert.equal(classesOnDate([MON], "2026-09-14", { courses }).length, 1);
    assert.equal(classesOnDate([MON], "2026-11-30", { courses }).length, 1);
  });

  await t.test("a university-wide break suppresses every course", () => {
    const noClassPeriods = [{ course_id: null, start_date: "2026-10-12", end_date: "2026-10-16" }];
    // 2026-10-12 is a Monday inside reading week.
    assert.equal(classesOnDate([MON], "2026-10-12", { noClassPeriods }).length, 0);
    assert.equal(classesOnDate([MON], "2026-10-19", { noClassPeriods }).length, 1);
  });

  await t.test("a course-specific break leaves other courses alone", () => {
    const noClassPeriods = [{ course_id: "c1", start_date: "2026-10-12", end_date: "2026-10-16" }];
    const both = [MON, { course_id: "c2", day_of_week: 1 }];
    assert.deepEqual(
      classesOnDate(both, "2026-10-12", { noClassPeriods }).map((b) => b.course_id),
      ["c2"],
    );
  });
});

test("reason a day has no classes", async (t) => {
  await t.test("names the break", () => {
    const reason = noClassReason("2026-10-13", {
      noClassPeriods: [
        { course_id: null, start_date: "2026-10-12", end_date: "2026-10-16", label: "Reading week" },
      ],
    });
    assert.deepEqual(reason, { kind: "break", label: "Reading week" });
  });

  await t.test("falls back to a generic label when the period is unnamed", () => {
    const reason = noClassReason("2026-10-13", {
      noClassPeriods: [{ course_id: null, start_date: "2026-10-12", end_date: "2026-10-16" }],
    });
    assert.deepEqual(reason, { kind: "break", label: "Scheduled break" });
  });

  await t.test("reports outside-term only when every dated course agrees", () => {
    const courses = [
      { id: "c1", term_start: "2026-09-08", term_end: "2026-12-08" },
      { id: "c2", term_start: "2027-01-05", term_end: "2027-04-10" },
    ];
    assert.deepEqual(noClassReason("2026-12-20", { courses }), { kind: "outside_term" });
    // c1 is still running, so the winter course being out of term proves nothing.
    assert.equal(noClassReason("2026-10-05", { courses }), null);
  });

  await t.test("concludes nothing when no course has term dates", () => {
    assert.equal(noClassReason("2026-12-20", { courses: [{ id: "c1" }] }), null);
  });
});
