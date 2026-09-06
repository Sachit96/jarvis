import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioSignature, twiMlReply, emptyTwiMl } from "@/lib/sms/twilio-signature";
import { callGemini, type GeminiFunctionDeclaration } from "@/lib/ai/providers/gemini-client";
import { LOG_NUTRITION_TOOL } from "@/lib/ai/providers/gemini-mentor-provider";
import { todayStr } from "@/lib/date";
import { lbsToKg } from "@/lib/units";
import { DEADLINE_CATEGORIES } from "@/lib/validations/uni";

// Inbound SMS logging engine (Work Order 5) — Twilio POSTs here on every
// message to TWILIO_PHONE_NUMBER. Inert (returns empty TwiML immediately)
// until all four env vars below are set; "not configured" is the
// established graceful-degradation convention this app already uses for
// Hevy/Gemini, applied here too.
const RATE_LIMIT_PER_HOUR = 20;

/**
 * Coverage audit (found live, 2026-09-06): texting "Log my weight as
 * 162lbs" got saved as a journal note. Root cause confirmed before fixing
 * anything — this tool set was workout/nutrition/task/study-session/
 * journal only. Body metrics, sleep, habits, transactions, trades, goal
 * progress, uni deadlines, and memory entries had no destination tool at
 * all, so *anything* in those domains silently fell through to journal.
 * Mood turned out not to need a new tool — it's already a field on
 * journal_entries, so it's a parameter on add_journal_entry instead.
 */
const TOOLS: GeminiFunctionDeclaration[] = [
  {
    name: "log_workout",
    description: "Log that a workout happened.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Short label, e.g. 'Push day' or 'Leg day'" },
        summary: { type: "STRING", description: "Free-text summary of what was done — exercises, sets/reps if mentioned" },
      },
      required: ["title", "summary"],
    },
  },
  LOG_NUTRITION_TOOL,
  {
    name: "log_body_metric",
    description: "Log a body-weight or body-composition measurement (e.g. 'log my weight as 162lbs', 'weighed in at 73kg today').",
    parameters: {
      type: "OBJECT",
      properties: {
        weight_lbs: { type: "NUMBER", description: "Body weight in pounds — convert if the message gives kg (1 kg = 2.20462 lbs)" },
        body_fat_pct: { type: "NUMBER", description: "Body fat percentage, only if mentioned" },
      },
      required: ["weight_lbs"],
    },
  },
  {
    name: "log_sleep",
    description: "Log last night's sleep (e.g. 'slept 7 hours', 'got 6.5 hrs, felt rough').",
    parameters: {
      type: "OBJECT",
      properties: {
        hours_slept: { type: "NUMBER" },
        quality: { type: "NUMBER", description: "1-5 quality rating, only if the message implies one (e.g. 'felt rough' -> 2, 'slept great' -> 5)" },
      },
      required: ["hours_slept"],
    },
  },
  {
    name: "log_habit_completion",
    description: "Mark one of the user's existing daily habits as done for today (e.g. 'did my run', 'read today').",
    parameters: {
      type: "OBJECT",
      properties: { habit_name: { type: "STRING", description: "The habit's name, or a close match to it" } },
      required: ["habit_name"],
    },
  },
  {
    name: "log_transaction",
    description: "Log a real money transaction — an expense or income (e.g. 'spent $40 on groceries', 'got paid $500').",
    parameters: {
      type: "OBJECT",
      properties: {
        type: { type: "STRING", enum: ["expense", "income"] },
        amount: { type: "NUMBER" },
        category: { type: "STRING", description: "Short category, e.g. 'Groceries', 'Client payment'" },
        description: { type: "STRING" },
      },
      required: ["type", "amount", "category"],
    },
  },
  {
    name: "log_trade",
    description: "Log a new trading-journal entry for an opened position (e.g. 'opened long BTC/USD at 65000').",
    parameters: {
      type: "OBJECT",
      properties: {
        asset_pair: { type: "STRING" },
        direction: { type: "STRING", enum: ["long", "short"] },
        entry_price: { type: "NUMBER" },
        quantity: { type: "NUMBER", description: "Only if a size/quantity is mentioned" },
        notes: { type: "STRING" },
      },
      required: ["asset_pair", "direction", "entry_price"],
    },
  },
  {
    name: "update_goal_progress",
    description: "Update the progress percentage on one of the user's existing goals (e.g. 'goal 2 is at 50% now').",
    parameters: {
      type: "OBJECT",
      properties: {
        goal_title: { type: "STRING", description: "The goal's title, or a close match to it" },
        progress_percent: { type: "NUMBER", description: "0-100" },
      },
      required: ["goal_title", "progress_percent"],
    },
  },
  {
    name: "add_deadline",
    description: "Add a university deadline (e.g. 'OSAP deadline is Sept 30', 'add-drop ends Oct 5').",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        due_date: { type: "STRING", description: "YYYY-MM-DD" },
        category: { type: "STRING", enum: [...DEADLINE_CATEGORIES] },
      },
      required: ["title", "due_date"],
    },
  },
  {
    name: "add_memory_entry",
    description: "Save a durable fact worth remembering long-term — not a diary note (e.g. 'remember my landlord's number is 555-1234').",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Short title" },
        body: { type: "STRING" },
      },
      required: ["title", "body"],
    },
  },
  {
    name: "complete_task",
    description: "Mark an existing task as done.",
    parameters: {
      type: "OBJECT",
      properties: { title: { type: "STRING", description: "The task title, or a close match to it" } },
      required: ["title"],
    },
  },
  {
    name: "log_study_session",
    description: "Log a completed study session for a university course.",
    parameters: {
      type: "OBJECT",
      properties: {
        course_code: { type: "STRING" },
        minutes: { type: "NUMBER" },
        notes: { type: "STRING" },
      },
      required: ["course_code", "minutes"],
    },
  },
  {
    name: "add_journal_entry",
    description: "Save a freeform diary/reflection note — use this ONLY when the message is clearly a reflective thought or observation the person wants remembered as a journal entry. Do not use this as a default for messages that don't clearly match another tool — leave those uncalled instead.",
    parameters: {
      type: "OBJECT",
      properties: {
        body: { type: "STRING" },
        mood: { type: "NUMBER", description: "1-5, only if the message's tone clearly implies a mood" },
      },
      required: ["body"],
    },
  },
];

const BASE_SYSTEM_INSTRUCTION = `You parse a text message from the user into exactly one logging action. Call the single most specific tool that clearly and unambiguously matches the message. Prefer a specific domain tool (weight, sleep, habit, transaction, trade, goal, deadline, memory, workout, nutrition, task, study session) over add_journal_entry whenever the message fits one. Only call add_journal_entry when the message is clearly a reflective note/thought with no other clear category. If the message is ambiguous, vague, or doesn't confidently match ANY tool — including add_journal_entry — do not call any tool at all. Never guess at a match you're not confident about.`;

const CAPABILITIES_SUMMARY =
  "a workout, a meal, your weight, sleep, a habit, a trade, a transaction, a goal update, a task done, a study session, a uni deadline, a memory to save, or a journal note";

/**
 * Found live (2026-09-06): "OSAP deadline is Sept 30" inserted with
 * due_at in 2024 — the model has no anchor for "today" and defaults to a
 * training-data-era year for any year-less date. Same bug class as
 * lib/ai/persona.ts's computeLiveClockBlock; fixed the same way, by
 * telling the model the real date instead of trusting it to know.
 */
function buildSystemInstruction() {
  return `${BASE_SYSTEM_INSTRUCTION} Today's date is ${todayStr()}. When a message mentions a date without a year, resolve it to the nearest such date on or after today.`;
}

/**
 * Found live (2026-09-06): "goal week 1 first client closed is at 25%"
 * failed to match the real goal "Week 1 — first client closed" because
 * the model's extracted argument drops the em-dash the real title has —
 * neither string is a substring of the other. Strip non-alphanumerics
 * before comparing so punctuation differences can't break a match.
 */
function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: NextRequest) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
  const ownerNumber = process.env.OWNER_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioNumber || !ownerNumber) {
    // Not configured — respond with valid empty TwiML rather than an
    // error, matching Twilio's own expectation that a webhook always
    // returns 200 (an error/timeout here just means Twilio retries).
    return new NextResponse(emptyTwiMl(), { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) params[key] = String(value);

  const signature = request.headers.get("X-Twilio-Signature") ?? "";
  const isValidSignature = validateTwilioSignature(authToken, signature, request.url, params);

  const supabase = createAdminClient();

  if (!isValidSignature) {
    await supabase.from("sms_messages").insert({ from_number: params.From ?? "unknown", body: params.Body ?? "", reply: "", status: "rejected_signature" });
    return new NextResponse(emptyTwiMl(), { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  const from = params.From ?? "";
  if (from !== ownerNumber) {
    // Logged (from_number is exactly what was rejected, useful for
    // noticing spoofing attempts) but never processed — a non-owner
    // sender gets no reply at all, not even an error.
    await supabase.from("sms_messages").insert({ from_number: from, body: params.Body ?? "", reply: "", status: "rejected_sender" });
    return new NextResponse(emptyTwiMl(), { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  // count intentionally read without checking `error` — if sms_messages
  // doesn't exist yet (migration 0024), this degrades to "not rate
  // limited" rather than throwing (see lib/db/missing-relation.ts). The
  // insert calls throughout this route are the same: never destructure
  // `error` from them, so a missing table can't crash the webhook — the
  // reply just goes out without a logged row.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("sms_messages")
    .select("*", { count: "exact", head: true })
    .eq("from_number", from)
    .eq("status", "processed")
    .gte("created_at", oneHourAgo);
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    const reply = "You've hit the hourly text limit — try again in a bit.";
    await supabase.from("sms_messages").insert({ from_number: from, body: params.Body ?? "", reply, status: "rate_limited" });
    return new NextResponse(twiMlReply(reply), { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  const body = params.Body ?? "";
  let actionTaken: string | null = null;
  let reply: string;

  try {
    const { functionCalls } = await callGemini({
      tier: "high_volume",
      systemInstruction: buildSystemInstruction(),
      contents: [{ role: "user", parts: [{ text: body }] }],
      tools: TOOLS,
    });
    const call = functionCalls[0];

    if (!call) {
      // Genuinely unroutable — found live (2026-09-06): this used to fall
      // through to add_journal_entry and reply as if it had succeeded,
      // which is worse than failing, since nothing was actually logged
      // where the person meant it to go. No tool call at all (not even
      // add_journal_entry) now means: say so, name what's loggable, log
      // nothing.
      actionTaken = null;
      reply = `Couldn't tell what to log from that. I can log ${CAPABILITIES_SUMMARY}.`;
    } else if (call.name === "add_journal_entry") {
      const args = call.args as { body?: string; mood?: number };
      const text = args.body ?? body;
      await supabase.from("journal_entries").insert({
        body: text,
        entry_type: "freeform",
        entry_date: todayStr(),
        mood: args.mood ?? null,
      });
      actionTaken = "add_journal_entry";
      reply = `Saved as a journal note: "${text.slice(0, 80)}"`;
    } else if (call.name === "log_workout") {
      const args = call.args as { title: string; summary: string };
      await supabase.from("workouts").insert({ session_label: args.title, notes: args.summary, started_at: new Date().toISOString(), completed: true });
      actionTaken = "log_workout";
      reply = `Logged workout: ${args.title}`;
    } else if (call.name === "log_nutrition_entry") {
      const args = call.args as { meal_type: string; description: string; calories: number; protein_g: number; carbs_g: number; fat_g: number };
      await supabase.from("nutrition_logs").insert({
        meal_type: args.meal_type,
        description: args.description,
        calories: Math.round(args.calories),
        protein_g: args.protein_g,
        carbs_g: args.carbs_g,
        fat_g: args.fat_g,
        source: "chatbot", // closest existing enum value — nutrition_logs.source has no dedicated "sms" option and adding one wasn't worth a migration just for this
        logged_at: todayStr(),
      });
      actionTaken = "log_nutrition";
      reply = `Logged: ${args.description} (~${Math.round(args.calories)} cal)`;
    } else if (call.name === "log_body_metric") {
      const args = call.args as { weight_lbs: number; body_fat_pct?: number };
      await supabase.from("body_metrics").upsert(
        {
          logged_at: todayStr(),
          weight_kg: lbsToKg(args.weight_lbs),
          body_fat_pct: args.body_fat_pct ?? null,
        },
        { onConflict: "logged_at" },
      );
      actionTaken = "log_body_metric";
      reply = `Logged weight: ${args.weight_lbs}lbs`;
    } else if (call.name === "log_sleep") {
      const args = call.args as { hours_slept: number; quality?: number };
      await supabase.from("sleep_logs").upsert(
        {
          log_date: todayStr(),
          hours_slept: args.hours_slept,
          quality: args.quality ?? null,
        },
        { onConflict: "log_date" },
      );
      actionTaken = "log_sleep";
      reply = `Logged sleep: ${args.hours_slept}h`;
    } else if (call.name === "log_habit_completion") {
      const args = call.args as { habit_name: string };
      const { data: habits } = await supabase.from("habits").select("id, name").eq("is_active", true);
      const needle = normalize(args.habit_name);
      const match =
        (habits ?? []).find((h) => normalize(h.name) === needle) ??
        (habits ?? []).find((h) => normalize(h.name).includes(needle) || needle.includes(normalize(h.name)));
      if (!match) {
        actionTaken = null;
        reply = `Couldn't find a habit matching "${args.habit_name}" — nothing logged.`;
      } else {
        await supabase
          .from("habit_logs")
          .upsert({ habit_id: match.id, log_date: todayStr(), completed: true, completed_at: new Date().toISOString() }, { onConflict: "habit_id,log_date" });
        actionTaken = "log_habit_completion";
        reply = `Marked "${match.name}" done for today.`;
      }
    } else if (call.name === "log_transaction") {
      const args = call.args as { type: "expense" | "income"; amount: number; category: string; description?: string };
      const { data: accounts } = await supabase.from("accounts").select("id").eq("is_active", true).order("created_at", { ascending: true }).limit(1);
      const account = accounts?.[0];
      if (!account) {
        actionTaken = null;
        reply = `Nothing logged — add an account in the Finance tab first, then I can log transactions by text.`;
      } else {
        await supabase.from("transactions").insert({
          account_id: account.id,
          type: args.type,
          amount: args.amount,
          category: args.category,
          description: args.description ?? null,
          occurred_at: todayStr(),
        });
        actionTaken = "log_transaction";
        reply = `Logged ${args.type}: $${args.amount} (${args.category})`;
      }
    } else if (call.name === "log_trade") {
      const args = call.args as { asset_pair: string; direction: "long" | "short"; entry_price: number; quantity?: number; notes?: string };
      await supabase.from("trades").insert({
        asset_pair: args.asset_pair,
        direction: args.direction,
        entry_price: args.entry_price,
        quantity: args.quantity ?? null,
        fees: 0,
        notes: args.notes ?? null,
        opened_at: new Date().toISOString(),
      });
      actionTaken = "log_trade";
      reply = `Logged trade: ${args.direction} ${args.asset_pair} @ ${args.entry_price}`;
    } else if (call.name === "update_goal_progress") {
      const args = call.args as { goal_title: string; progress_percent: number };
      const { data: goals } = await supabase.from("goals").select("id, title").neq("status", "achieved");
      const needle = normalize(args.goal_title);
      const match =
        (goals ?? []).find((g) => normalize(g.title) === needle) ??
        (goals ?? []).find((g) => normalize(g.title).includes(needle) || needle.includes(normalize(g.title)));
      if (!match) {
        actionTaken = null;
        reply = `Couldn't find a goal matching "${args.goal_title}" — nothing updated.`;
      } else {
        const clamped = Math.max(0, Math.min(100, Math.round(args.progress_percent)));
        await supabase
          .from("goals")
          .update({ progress_percent: clamped, status: clamped >= 100 ? "achieved" : "active" })
          .eq("id", match.id);
        actionTaken = "update_goal_progress";
        reply = `Updated "${match.title}" to ${clamped}%.`;
      }
    } else if (call.name === "add_deadline") {
      const args = call.args as { title: string; due_date: string; category?: string };
      const category = DEADLINE_CATEGORIES.includes(args.category as (typeof DEADLINE_CATEGORIES)[number])
        ? (args.category as (typeof DEADLINE_CATEGORIES)[number])
        : "other";
      await supabase.from("uni_deadlines").insert({ title: args.title, due_at: args.due_date, category });
      actionTaken = "add_deadline";
      reply = `Added deadline: ${args.title} (${args.due_date})`;
    } else if (call.name === "add_memory_entry") {
      const args = call.args as { title: string; body: string };
      await supabase.from("memory_entries").insert({ type: "fact", title: args.title, body: args.body, source: "manual" });
      actionTaken = "add_memory_entry";
      reply = `Saved to memory: ${args.title}`;
    } else if (call.name === "complete_task") {
      const args = call.args as { title: string };
      const { data: tasks } = await supabase.from("tasks").select("id, title").neq("status", "done");
      const needle = normalize(args.title);
      const match = (tasks ?? []).find((t) => normalize(t.title) === needle) ?? (tasks ?? []).find((t) => normalize(t.title).includes(needle) || needle.includes(normalize(t.title)));
      if (!match) {
        actionTaken = null;
        reply = `Couldn't find a task matching "${args.title}" — nothing marked done.`;
      } else {
        await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", match.id);
        actionTaken = "complete_task";
        reply = `Marked "${match.title}" done.`;
      }
    } else if (call.name === "log_study_session") {
      const args = call.args as { course_code: string; minutes: number; notes?: string };
      const { data: courses } = await supabase.from("uni_courses").select("id, code").eq("archived", false);
      const needle = args.course_code.trim().toLowerCase();
      const match = (courses ?? []).find((c) => c.code.toLowerCase() === needle);
      if (!match) {
        actionTaken = null;
        reply = `Couldn't find a course matching "${args.course_code}" — nothing logged.`;
      } else {
        await supabase.from("uni_study_sessions").insert({
          course_id: match.id,
          planned_start: new Date().toISOString(),
          planned_minutes: Math.round(args.minutes),
          actual_minutes: Math.round(args.minutes),
          completed: true,
          notes: args.notes ?? null,
        });
        actionTaken = "log_study_session";
        reply = `Logged ${args.minutes}min of study for ${match.code}.`;
      }
    } else {
      // Declared a tool but the name matched none of the above — shouldn't
      // happen given TOOLS above, but fail honestly rather than journal it.
      actionTaken = null;
      reply = `Couldn't tell what to log from that. I can log ${CAPABILITIES_SUMMARY}.`;
    }
  } catch (err) {
    reply = "Something went wrong logging that — try again in a moment.";
    await supabase.from("sms_messages").insert({ from_number: from, body, action_taken: null, reply, status: "error" });
    console.error("[sms-webhook]", err instanceof Error ? err.message : err);
    return new NextResponse(twiMlReply(reply), { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  await supabase.from("sms_messages").insert({ from_number: from, body, action_taken: actionTaken, reply, status: "processed" });
  return new NextResponse(twiMlReply(reply), { status: 200, headers: { "Content-Type": "text/xml" } });
}
