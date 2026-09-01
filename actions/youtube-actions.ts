"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { researchTopic, generateScript, generateThumbnail } from "@/lib/ai/providers/gemini-youtube";

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

export interface GenerateThumbnailsResult {
  ok: boolean;
  error?: string;
  count?: number;
}

/** Generates 3 variants per the work order. Each is tracked/attempted independently — if the API has zero free quota (verified tonight), the first failure's message is returned and the rest aren't attempted. */
export async function generateThumbnailsAction(scriptId: string, hookOrTitle: string): Promise<GenerateThumbnailsResult> {
  const supabase = await createClient();
  const prompts = [
    `YouTube thumbnail background, bold and high-contrast, for a video about: ${hookOrTitle}. Abstract/graphic style, no text overlay, no real people.`,
    `YouTube thumbnail background, vibrant colors, dramatic lighting, for a video about: ${hookOrTitle}. No text overlay, no real people.`,
    `YouTube thumbnail background, minimalist composition, for a video about: ${hookOrTitle}. No text overlay, no real people.`,
  ];

  let count = 0;
  for (const prompt of prompts) {
    const result = await generateThumbnail(prompt);
    if (!result.ok) {
      if (count === 0) return { ok: false, error: result.error };
      break; // partial success — keep what we got
    }
    await supabase.from("yt_thumbnails").insert({
      script_id: scriptId,
      prompt,
      image_base64: result.imageBase64,
      mime_type: result.mimeType ?? "image/png",
    });
    count += 1;
  }

  revalidatePath("/youtube");
  return { ok: count > 0, count, error: count === 0 ? "No thumbnails generated" : undefined };
}

export async function selectThumbnailAction(id: string, scriptId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("yt_thumbnails").update({ selected: false }).eq("script_id", scriptId);
  await supabase.from("yt_thumbnails").update({ selected: true }).eq("id", id);
  revalidatePath("/youtube");
}
