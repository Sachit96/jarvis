import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioSignature, twiMlReply, emptyTwiMl } from "@/lib/sms/twilio-signature";
import { callGemini, type GeminiFunctionDeclaration } from "@/lib/ai/providers/gemini-client";
import { LOG_NUTRITION_TOOL } from "@/lib/ai/providers/gemini-mentor-provider";
import { todayStr } from "@/lib/date";

// Inbound SMS logging engine (Work Order 5) — Twilio POSTs here on every
// message to TWILIO_PHONE_NUMBER. Inert (returns empty TwiML immediately)
// until all four env vars below are set; "not configured" is the
// established graceful-degradation convention this app already uses for
// Hevy/Gemini, applied here too.
const RATE_LIMIT_PER_HOUR = 20;

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
    description: "Save a freeform journal note — use this for anything that isn't clearly a workout, meal, task completion, or study session.",
    parameters: {
      type: "OBJECT",
      properties: { body: { type: "STRING" } },
      required: ["body"],
    },
  },
];

const SYSTEM_INSTRUCTION = `You parse a text message from the user into exactly one logging action. Only call a specific tool (log_workout, log_nutrition_entry, complete_task, log_study_session) if the message clearly and unambiguously matches it. If it's ambiguous, vague, or doesn't clearly match one of those, call add_journal_entry with the message's content instead — never guess at a specific action you're not confident about.`;

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
      systemInstruction: SYSTEM_INSTRUCTION,
      contents: [{ role: "user", parts: [{ text: body }] }],
      tools: TOOLS,
    });
    const call = functionCalls[0];

    if (!call || call.name === "add_journal_entry") {
      const text = (call?.args as { body?: string } | undefined)?.body ?? body;
      await supabase.from("journal_entries").insert({ body: text, entry_type: "freeform", entry_date: todayStr() });
      actionTaken = "add_journal_entry";
      reply = call ? `Saved as a journal note: "${text.slice(0, 80)}"` : `Wasn't sure how to categorize that, so I saved it as a journal note: "${text.slice(0, 80)}"`;
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
    } else if (call.name === "complete_task") {
      const args = call.args as { title: string };
      const { data: tasks } = await supabase.from("tasks").select("id, title").neq("status", "done");
      const needle = args.title.trim().toLowerCase();
      const match = (tasks ?? []).find((t) => t.title.toLowerCase() === needle) ?? (tasks ?? []).find((t) => t.title.toLowerCase().includes(needle) || needle.includes(t.title.toLowerCase()));
      if (!match) {
        await supabase.from("journal_entries").insert({ body, entry_type: "freeform", entry_date: todayStr() });
        actionTaken = "add_journal_entry";
        reply = `Couldn't find a task matching "${args.title}" — saved as a journal note instead.`;
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
        await supabase.from("journal_entries").insert({ body, entry_type: "freeform", entry_date: todayStr() });
        actionTaken = "add_journal_entry";
        reply = `Couldn't find a course matching "${args.course_code}" — saved as a journal note instead.`;
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
      await supabase.from("journal_entries").insert({ body, entry_type: "freeform", entry_date: todayStr() });
      actionTaken = "add_journal_entry";
      reply = `Wasn't sure how to categorize that, so I saved it as a journal note: "${body.slice(0, 80)}"`;
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
