"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { researchTopic, generateScript } from "@/lib/ai/providers/gemini-youtube";

export interface GenerateScriptResult {
  ok: boolean;
  error?: string;
  scriptId?: string;
}

export async function generateScriptAction(topic: string, niche: string): Promise<GenerateScriptResult> {
  if (!process.env.GEMINI_API_KEY) return { ok: false, error: "GEMINI_API_KEY is not configured" };
  if (!topic.trim()) return { ok: false, error: "Topic is required" };

  try {
    const { summary, grounded } = await researchTopic(topic, niche || undefined);
    const script = await generateScript(topic, niche || undefined, summary);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("yt_scripts")
      .insert({
        topic,
        niche: niche || null,
        research_summary: summary,
        research_grounded: grounded,
        hook: script.hook,
        script_body: script.scriptBody,
        sections: script.sections,
        estimated_runtime_sec: script.estimatedRuntimeSec,
        suggested_titles: [script.suggestedTitle, ...script.alternativeTitles],
        status: "draft",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    revalidatePath("/youtube");
    return { ok: true, scriptId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Script generation failed" };
  }
}

export async function setScriptStatusAction(id: string, status: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("yt_scripts").update({ status }).eq("id", id);
  revalidatePath("/youtube");
}

export async function deleteScriptAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("yt_scripts").delete().eq("id", id);
  revalidatePath("/youtube");
}

// Thumbnail generation (generateThumbnailsAction/selectThumbnailAction) was
// removed this session — every image-capable model on this Gemini key
// (gemini-2.5-flash-image, gemini-3-pro-image(-preview),
// gemini-3.1-flash-image(-preview), gemini-3.1-flash-lite-image) returns a
// real 429 with an explicit QuotaFailure detail naming `limit: 0` for
// generate_content_free_tier_requests — confirmed live, not assumed, across
// all of them. A button that can never succeed is worse than no button
// (Business Pipeline Cockpit / Lead Research cleanup work order, Phase 1d).
// The yt_thumbnails table itself was left alone rather than dropped — see
// migrations/0031_drop_yt_thumbnails.sql, written but not applied, your call.
