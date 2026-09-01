"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateFlashcards } from "@/lib/ai/providers/gemini-uni-parser";
import { getFlashcards } from "@/lib/db/queries/uni";

export async function getFlashcardsForMaterialAction(materialId: string) {
  const supabase = await createClient();
  return getFlashcards(supabase, materialId);
}

export async function generateFlashcardsAction(materialId: string, courseId: string): Promise<{ ok: boolean; error?: string; count?: number }> {
  if (!process.env.GEMINI_API_KEY) return { ok: false, error: "GEMINI_API_KEY is not configured" };
  const supabase = await createClient();
  const { data: material, error: fetchErr } = await supabase.from("uni_materials").select("*").eq("id", materialId).maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!material) return { ok: false, error: "Material not found" };

  try {
    const cards = await generateFlashcards(material.body);
    if (cards.length === 0) return { ok: false, error: "Nothing usable came back — try a longer or more specific material." };
    const { error } = await supabase.from("uni_flashcards").insert(cards.map((c) => ({ material_id: materialId, ...c })));
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/uni/courses/${courseId}`);
    return { ok: true, count: cards.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Flashcard generation failed" };
  }
}

const MAX_INTERVAL_DAYS = 60;

/**
 * Spaced repetition, explicitly the simple version per the work order —
 * interval doubling on correct (capped at MAX_INTERVAL_DAYS), reset to 1
 * day on incorrect. Not SM-2 (no per-card ease factor tuning).
 */
export async function reviewFlashcardAction(id: string, correct: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: card } = await supabase.from("uni_flashcards").select("ease").eq("id", id).maybeSingle();
  const currentInterval = card?.ease ?? 1;
  const nextInterval = correct ? Math.min(MAX_INTERVAL_DAYS, currentInterval * 2) : 1;
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + nextInterval);

  await supabase
    .from("uni_flashcards")
    .update({ ease: nextInterval, last_reviewed: new Date().toISOString(), next_review: nextReview.toISOString() })
    .eq("id", id);
}

export async function deleteFlashcardAction(id: string, courseId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_flashcards").delete().eq("id", id);
  revalidatePath(`/uni/courses/${courseId}`);
}
