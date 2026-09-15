import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  summarise, summariseByCourse, trend, riskOf,
  ATTENDANCE_THRESHOLD, type AttendanceRecord, type AttendanceStatus,
} from "../lib/uni/attendance.ts";

const rec = (status: AttendanceStatus, date = "2026-09-01", course = "c1"): AttendanceRecord =>
  ({ course_id: course, class_date: date, status });

describe("what counts toward attendance", () => {
  test("a cancelled class leaves the denominator entirely", () => {
    // Counting the university's cancellation as the student's miss is the
    // single most unfair thing this calculation could do.
    const summary = summarise([rec("present"), rec("cancelled", "2026-09-02")]);
    assert.equal(summary.counted, 1);
    assert.equal(summary.percent, 100);
    assert.equal(summary.cancelled, 1);
  });

  test("an excused absence also leaves the denominator", () => {
    // Already accepted by the institution — folding it in would make this
    // number disagree with the registrar's.
    const summary = summarise([rec("present"), rec("excused", "2026-09-02")]);
    assert.equal(summary.counted, 1);
    assert.equal(summary.percent, 100);
    assert.equal(summary.missed, 0);
  });

  test("late counts as attended but is still visible", () => {
    const summary = summarise([rec("late"), rec("present", "2026-09-02")]);
    assert.equal(summary.percent, 100);
    assert.equal(summary.late, 1);
  });

  test("no records gives null, not zero", () => {
    // "0% attendance" and "no classes recorded" are completely different
    // facts, and showing the first for the second is a lie.
    const summary = summarise([]);
    assert.equal(summary.percent, null);
    assert.equal(summary.risk, "no_data");
  });

  test("a term of only cancelled classes is still no data", () => {
    const summary = summarise([rec("cancelled"), rec("cancelled", "2026-09-02")]);
    assert.equal(summary.percent, null);
    assert.equal(summary.risk, "no_data");
  });
});

describe("risk thresholds", () => {
  test("below the threshold is at risk", () => {
    assert.equal(riskOf(ATTENDANCE_THRESHOLD - 0.1), "at_risk");
  });

  test("exactly at the threshold is not at risk", () => {
    // The line is "at least 75%", so 75 must not be reported as failing.
    assert.equal(riskOf(ATTENDANCE_THRESHOLD), "warning");
  });

  test("comfortably above is good", () => {
    assert.equal(riskOf(95), "good");
  });

  test("no data is its own state, not good", () => {
    assert.equal(riskOf(null), "no_data");
  });
});

describe("how many more classes can be missed", () => {
  test("a perfect record can afford several", () => {
    // 12 of 12: missing 4 more gives 12/16 = 75%, still at the line.
    const summary = summarise(Array.from({ length: 12 }, (_, i) => rec("present", `2026-09-${String(i + 1).padStart(2, "0")}`)));
    assert.equal(summary.percent, 100);
    assert.equal(summary.canMiss, 4);
  });

  test("already below the line can afford none", () => {
    const records = [rec("present"), rec("absent", "2026-09-02"), rec("absent", "2026-09-03")];
    const summary = summarise(records);
    assert.ok(summary.percent! < ATTENDANCE_THRESHOLD);
    assert.equal(summary.canMiss, 0);
  });

  test("the answer never claims a miss that would cross the line", () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      rec(i < 16 ? "present" : "absent", `2026-09-${String(i + 1).padStart(2, "0")}`));
    const summary = summarise(records);
    const after = (summary.attended / (summary.counted + summary.canMiss)) * 100;
    assert.ok(after >= ATTENDANCE_THRESHOLD, `${after} should still be at or above the line`);
    const oneMore = (summary.attended / (summary.counted + summary.canMiss + 1)) * 100;
    assert.ok(oneMore < ATTENDANCE_THRESHOLD, "one more than the answer must cross the line");
  });
});

describe("per-course breakdown", () => {
  test("the course in trouble is listed first", () => {
    const records = [
      rec("present", "2026-09-01", "good"), rec("present", "2026-09-02", "good"),
      rec("absent", "2026-09-01", "bad"), rec("absent", "2026-09-02", "bad"),
    ];
    const byCourse = summariseByCourse(records);
    assert.equal(byCourse[0].courseId, "bad");
    assert.equal(byCourse[0].percent, 0);
    assert.equal(byCourse[1].percent, 100);
  });

  test("a course with no counted classes sorts last, not first", () => {
    // no_data must not masquerade as the worst attendance on the page.
    const records = [
      rec("absent", "2026-09-01", "bad"),
      rec("cancelled", "2026-09-01", "unknown"),
    ];
    const byCourse = summariseByCourse(records);
    assert.equal(byCourse[0].courseId, "bad");
    assert.equal(byCourse[1].percent, null);
  });
});

describe("trend", () => {
  test("only counted classes move the line", () => {
    const points = trend([
      rec("present", "2026-09-01"),
      rec("cancelled", "2026-09-02"),
      rec("absent", "2026-09-03"),
    ]);
    assert.equal(points.length, 2, "a cancelled class adds no point");
    assert.deepEqual(points.map((p) => p.percent), [100, 50]);
  });

  test("records out of order still produce a chronological trend", () => {
    const points = trend([rec("absent", "2026-09-03"), rec("present", "2026-09-01")]);
    assert.deepEqual(points.map((p) => p.date), ["2026-09-01", "2026-09-03"]);
  });
});
