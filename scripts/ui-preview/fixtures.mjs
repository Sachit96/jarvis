/**
 * Synthetic rows for the visual QA harness. See ./README.md.
 *
 * These are NOT the user's data and are not derived from it. Every
 * human-readable string is prefixed "SAMPLE" precisely so that a screenshot
 * taken during QA can never be mistaken for the real dashboard. Nothing
 * under app/, components/ or lib/ imports this file, and nothing here is
 * ever written anywhere.
 *
 * They exist for one reason: several layouts (a pipeline board, a workout
 * calendar, a transaction table) only reveal their visual problems when
 * they have rows in them.
 */

const now = new Date();
const iso = (offsetDays = 0, hour = 9) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const day = (offsetDays = 0) => iso(offsetDays).slice(0, 10);
const stamps = { created_at: iso(-30), updated_at: iso(-1) };
const id = (prefix, n) => `${prefix}-0000-0000-0000-${String(n).padStart(12, "0")}`;

export const fixtures = {
  accounts: [
    { id: id("acc", 1), name: "SAMPLE Checking", account_type: "checking", current_balance: 8420.55, is_active: true, is_liability: false, ...stamps },
    { id: id("acc", 2), name: "SAMPLE Savings", account_type: "savings", current_balance: 21750, is_active: true, is_liability: false, ...stamps },
    { id: id("acc", 3), name: "SAMPLE Credit Card", account_type: "credit", current_balance: -1310.2, is_active: true, is_liability: true, ...stamps },
    { id: id("acc", 4), name: "SAMPLE Brokerage", account_type: "investment", current_balance: 46310.9, is_active: true, is_liability: false, ...stamps },
  ],

  transactions: [
    { id: id("txn", 1), account_id: id("acc", 1), amount: 5200, category: "salary", type: "income", description: "SAMPLE monthly retainer", occurred_at: day(-12), ...stamps },
    { id: id("txn", 2), account_id: id("acc", 1), amount: 1450, category: "rent", type: "expense", description: "SAMPLE rent", occurred_at: day(-10), ...stamps },
    { id: id("txn", 3), account_id: id("acc", 3), amount: 212.4, category: "groceries", type: "expense", description: "SAMPLE groceries", occurred_at: day(-6), ...stamps },
    { id: id("txn", 4), account_id: id("acc", 1), amount: 89.99, category: "software", type: "expense", description: "SAMPLE tooling", occurred_at: day(-4), ...stamps },
    { id: id("txn", 5), account_id: id("acc", 1), amount: 1800, category: "consulting", type: "income", description: "SAMPLE project invoice", occurred_at: day(-2), ...stamps },
    { id: id("txn", 6), account_id: id("acc", 3), amount: 64.1, category: "transport", type: "expense", description: "SAMPLE fuel", occurred_at: day(-1), ...stamps },
  ],

  pipeline_stages: [
    { id: id("stg", 1), name: "Contacted", sort_order: 1, is_won: false, is_lost: false, ...stamps },
    { id: id("stg", 2), name: "Qualified", sort_order: 2, is_won: false, is_lost: false, ...stamps },
    { id: id("stg", 3), name: "Proposal", sort_order: 3, is_won: false, is_lost: false, ...stamps },
    { id: id("stg", 4), name: "Won", sort_order: 4, is_won: true, is_lost: false, ...stamps },
    { id: id("stg", 5), name: "Lost", sort_order: 5, is_won: false, is_lost: true, ...stamps },
  ],

  contacts: [
    { id: id("con", 1), contact_person: "SAMPLE Contact A", company_name: "SAMPLE Northwind", email: "a@example.invalid", phone: null, notes: null, source: "manual", external_id: null, ...stamps },
    { id: id("con", 2), contact_person: "SAMPLE Contact B", company_name: "SAMPLE Meridian", email: "b@example.invalid", phone: null, notes: null, source: "manual", external_id: null, ...stamps },
    { id: id("con", 3), contact_person: "SAMPLE Contact C", company_name: "SAMPLE Halcyon", email: null, phone: null, notes: null, source: "manual", external_id: null, ...stamps },
  ],

  deals: [
    { id: id("deal", 1), contact_id: id("con", 1), stage_id: id("stg", 1), title: "SAMPLE retainer", value: 4800, expected_close_date: day(14), closed_at: null, stage_changed_at: iso(-3), notes: null, source: "manual", external_id: null, ...stamps },
    { id: id("deal", 2), contact_id: id("con", 2), stage_id: id("stg", 3), title: "SAMPLE platform build", value: 18500, expected_close_date: day(9), closed_at: null, stage_changed_at: iso(-21), notes: null, source: "manual", external_id: null, ...stamps },
    { id: id("deal", 3), contact_id: id("con", 3), stage_id: id("stg", 2), title: "SAMPLE audit", value: 6200, expected_close_date: day(-2), closed_at: null, stage_changed_at: iso(-40), notes: null, source: "manual", external_id: null, ...stamps },
    { id: id("deal", 4), contact_id: id("con", 1), stage_id: id("stg", 4), title: "SAMPLE onboarding", value: 9400, expected_close_date: day(-5), closed_at: iso(-5), stage_changed_at: iso(-5), notes: null, source: "manual", external_id: null, ...stamps },
  ],

  contracts: [
    { id: id("ctr", 1), contact_id: id("con", 1), title: "SAMPLE monthly retainer", monthly_value: 3200, status: "active", start_date: day(-90), end_date: null, notes: null, ...stamps },
    { id: id("ctr", 2), contact_id: id("con", 2), title: "SAMPLE support plan", monthly_value: 1150, status: "active", start_date: day(-45), end_date: null, notes: null, ...stamps },
  ],

  activities: [
    { id: id("act", 1), contact_id: id("con", 1), deal_id: id("deal", 1), type: "call", notes: "SAMPLE discovery call", occurred_at: iso(-2, 14), created_at: iso(-2, 14) },
    { id: id("act", 2), contact_id: id("con", 2), deal_id: id("deal", 2), type: "email", notes: "SAMPLE proposal sent", occurred_at: iso(-4, 11), created_at: iso(-4, 11) },
  ],

  tasks: [
    { id: id("tsk", 1), title: "SAMPLE overdue task", description: null, status: "todo", priority: "high", due_date: day(-2), completed_at: null, tags: [], ...stamps },
    { id: id("tsk", 2), title: "SAMPLE task due today", description: null, status: "todo", priority: "medium", due_date: day(0), completed_at: null, tags: ["sample"], ...stamps },
    { id: id("tsk", 3), title: "SAMPLE upcoming task", description: null, status: "todo", priority: "low", due_date: day(3), completed_at: null, tags: [], ...stamps },
    { id: id("tsk", 4), title: "SAMPLE completed task", description: null, status: "done", priority: "medium", due_date: day(-1), completed_at: iso(-1), tags: [], ...stamps },
  ],

  goals: [
    { id: id("gol", 1), title: "SAMPLE quarterly revenue goal", description: null, category: "business", progress_percent: 62, status: "active", target_date: day(45), timeframe: "weekly", ...stamps },
    { id: id("gol", 2), title: "SAMPLE training consistency", description: null, category: "health", progress_percent: 88, status: "active", target_date: day(20), timeframe: "daily", ...stamps },
    { id: id("gol", 3), title: "SAMPLE savings target", description: null, category: "finance", progress_percent: 31, status: "active", target_date: day(120), timeframe: "monthly", ...stamps },
  ],

  habits: [
    { id: id("hab", 1), name: "SAMPLE morning routine", kind: "build", metric_type: "boolean", cadence: "daily", days_of_week: [1, 2, 3, 4, 5, 6, 7], is_active: true, pinned: true, sort_order: 1, target_count: null, color: null, ...stamps },
    { id: id("hab", 2), name: "SAMPLE reading", kind: "build", metric_type: "boolean", cadence: "daily", days_of_week: [1, 2, 3, 4, 5, 6, 7], is_active: true, pinned: false, sort_order: 2, target_count: null, color: null, ...stamps },
    { id: id("hab", 3), name: "SAMPLE deep work block", kind: "build", metric_type: "boolean", cadence: "daily", days_of_week: [1, 2, 3, 4, 5], is_active: true, pinned: false, sort_order: 3, target_count: null, color: null, ...stamps },
  ],

  habit_logs: Array.from({ length: 40 }, (_, i) => ({
    id: id("hlg", i + 1),
    habit_id: id("hab", (i % 3) + 1),
    log_date: day(-Math.floor(i / 2)),
    completed: i % 3 !== 2,
    completed_at: iso(-Math.floor(i / 2)),
    count: null,
    note: null,
    ...stamps,
  })),

  exercises: [
    { id: id("exe", 1), name: "SAMPLE Barbell Squat", muscle_group: "legs", is_active: true, source: "manual", external_id: null, ...stamps },
    { id: id("exe", 2), name: "SAMPLE Bench Press", muscle_group: "chest", is_active: true, source: "manual", external_id: null, ...stamps },
    { id: id("exe", 3), name: "SAMPLE Deadlift", muscle_group: "back", is_active: true, source: "manual", external_id: null, ...stamps },
  ],

  // Spread across the last four weeks so the workout calendar has enough
  // completed days to show whatever treatment they get.
  workouts: [0, 1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 20, 22, 24].map((back, i) => ({
    id: id("wko", i + 1),
    session_label: `SAMPLE session ${i + 1}`,
    started_at: iso(-back, 18),
    completed: true,
    notes: null,
    source: "manual",
    external_id: null,
    ...stamps,
  })),

  workout_sets: Array.from({ length: 30 }, (_, i) => ({
    id: id("set", i + 1),
    workout_id: id("wko", (i % 14) + 1),
    exercise_id: id("exe", (i % 3) + 1),
    set_number: (i % 4) + 1,
    reps: 8,
    weight_kg: 60 + (i % 5) * 5,
    ...stamps,
  })),

  nutrition_targets: [
    { id: id("ntg", 1), target_calories: 2400, target_protein_g: 180, target_carbs_g: 240, target_fat_g: 70, target_water_ml: 3000, ...stamps },
  ],

  nutrition_logs: [
    { id: id("nlg", 1), description: "SAMPLE breakfast", meal_type: "breakfast", calories: 520, protein_g: 38, carbs_g: 52, fat_g: 16, logged_at: iso(0, 8), source: "manual", ...stamps },
    { id: id("nlg", 2), description: "SAMPLE lunch", meal_type: "lunch", calories: 780, protein_g: 55, carbs_g: 74, fat_g: 24, logged_at: iso(0, 13), source: "manual", ...stamps },
  ],

  body_metrics: Array.from({ length: 8 }, (_, i) => ({
    id: id("bmx", i + 1),
    weight_kg: 82 - i * 0.3,
    body_fat_pct: 17.5 - i * 0.1,
    logged_at: iso(-i * 7),
    notes: null,
    ...stamps,
  })),

  memory_entries: [
    { id: id("mem", 1), title: "SAMPLE preference", body: "Prefers concise answers.", type: "preference", source: "manual", tags: ["sample"], pinned: true, confidence: 0.9, expires_at: null, ...stamps },
    { id: id("mem", 2), title: "SAMPLE context", body: "Runs a solo consulting practice.", type: "fact", source: "manual", tags: ["sample", "business"], pinned: false, confidence: 0.8, expires_at: null, ...stamps },
  ],

  daily_recommendations: [
    {
      id: id("rec", 1),
      rec_date: day(0),
      markdown_body: "**SAMPLE brief.** This text exists only to occupy the mentor card during visual QA.",
      focus_areas: ["SAMPLE focus"],
      strengths: ["SAMPLE strength"],
      weaknesses: ["SAMPLE weakness"],
      model_used: null,
      ...stamps,
    },
  ],





  // Rows the study-plan loop reads: previously written by "Plan tonight" and
  // the AI assignment breakdown, and displayed by nothing.



};

/** RPC responses. Only the ones the UI actually calls need an entry. */
export const rpcResults = {
  increment_gemini_usage: 1,
};
