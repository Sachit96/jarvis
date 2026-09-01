"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMentorProvider } from "@/lib/ai/providers";
import { getCourses, getAssessments, getMaterials } from "@/lib/db/queries/uni";
import { planStudySessions, type RankedItem } from "@/lib/uni/study-plan";
import { buildPersonaPrefix } from "@/lib/ai/persona";

export interface PlanTonightResult {
  ok: boolean;
  error?: string;
  sessions?: RankedItem[];
  phrasing?: string;
}

/**
 * Study planning (Work Order 3). The ranking and time allocation are pure
 * arithmetic (lib/uni/study-plan.ts) — the ONE Gemini call here (Gemma
 * "high_volume" tier, via the existing MentorProvider.chat) only phrases
 * the already-decided plan conversationally. The model is never asked to
 * do the prioritization math itself.
 */
export async function planTonightAction(availableHours: number): Promise<PlanTonightResult> {
  const supabase = await createClient();
  const courses = await getCourses(supabase).catch(() => []);
  if (courses.length === 0) return { ok: false, error: "No courses yet" };
  const assessments = await getAssessments(supabase, courses.map((c) => c.id));

  const sessions = planStudySessions(assessments, courses, Math.round(availableHours * 60));
  if (sessions.length === 0) return { ok: true, sessions: [], phrasing: "Nothing urgent enough to plan around right now — you're caught up." };

  if (!process.env.GEMINI_API_KEY) {
    return { ok: true, sessions, phrasing: sessions.map((s) => `${s.courseCode} — ${s.title} (${s.minutes}min)`).join("; ") };
  }

  try {
    const persona = await buildPersonaPrefix(supabase);
    const provider = getMentorProvider();
    const planSummary = sessions.map((s) => `${s.courseCode} "${s.title}": ${s.minutes} minutes (priority score ${s.priorityScore})`).join("\n");
    const reply = await provider.chat(
      [
        persona,
        `The user has ${availableHours} hours available to study tonight. The plan below has ALREADY been decided by code, ranked by urgency, grade weight, and course risk — do not re-rank or second-guess it, just phrase it as a short, motivating, natural-language plan (3-5 sentences). Reference the actual items and minutes given.`,
        `Plan:\n${planSummary}`,
      ].join("\n\n"),
      [{ role: "user", content: "What should I work on tonight?" }],
    );
    return { ok: true, sessions, phrasing: reply };
  } catch (err) {
    // Phrasing is a nice-to-have on top of a plan that's already computed — never let it block the plan itself.
    return { ok: true, sessions, phrasing: sessions.map((s) => `${s.courseCode} — ${s.title} (${s.minutes}min)`).join("; "), error: err instanceof Error ? err.message : undefined };
  }
}

export async function confirmStudyPlanAction(sessions: { assessmentId: string; courseId: string; minutes: number }[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const now = new Date();
  now.setHours(19, 0, 0, 0);
  const { error } = await supabase.from("uni_study_sessions").insert(
    sessions.map((s) => ({
      course_id: s.courseId,
      assessment_id: s.assessmentId,
      planned_start: now.toISOString(),
      planned_minutes: s.minutes,
    })),
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/uni");
  return { ok: true };
}

// ================================================= Study material Q&A

export interface MaterialQaResult {
  ok: boolean;
  error?: string;
  answer?: string;
  usedMaterials?: string[];
}

/**
 * Simple context-stuffing Q&A — no vector DB/embeddings, per the work
 * order ("the volume doesn't justify it and it would blow the token
 * ceiling"). Selects materials by course + recency, stops adding once a
 * rough character budget is hit (~12K chars ≈ 3K tokens, leaving headroom
 * under Gemma's 16K TPM alongside the question/persona/history), and
 * tells the user which ones were actually used if some had to be left out.
 */
const MATERIAL_CONTEXT_CHAR_BUDGET = 12_000;

export async function askMaterialQuestionAction(courseId: string, question: string): Promise<MaterialQaResult> {
  if (!process.env.GEMINI_API_KEY) return { ok: false, error: "GEMINI_API_KEY is not configured" };
  const supabase = await createClient();
  const materials = await getMaterials(supabase, courseId);
  if (materials.length === 0) return { ok: false, error: "No materials uploaded for this course yet" };

  const used: string[] = [];
  let budget = MATERIAL_CONTEXT_CHAR_BUDGET;
  const blocks: string[] = [];
  for (const m of materials) {
    // getMaterials already orders by uploaded_at desc, so this walk is already most-recent-first.
    if (budget <= 0) break;
    const chunk = m.body.slice(0, budget);
    blocks.push(`--- ${m.title} (${m.type}) ---\n${chunk}`);
    used.push(m.title);
    budget -= chunk.length;
  }

  try {
    const persona = await buildPersonaPrefix(supabase);
    const provider = getMentorProvider();
    const reply = await provider.chat(
      [
        persona,
        "Answer the user's question about their course material using ONLY the material text given below. If the material doesn't cover it, say so plainly rather than guessing from general knowledge.",
        `Course materials:\n\n${blocks.join("\n\n")}`,
      ].join("\n\n"),
      [{ role: "user", content: question }],
    );
    return { ok: true, answer: reply, usedMaterials: used };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Question failed" };
  }
}
