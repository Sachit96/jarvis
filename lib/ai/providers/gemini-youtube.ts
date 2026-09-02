import "server-only";
import { callGemini, stripMarkdownFence } from "@/lib/ai/providers/gemini-client";
import { incrementGeminiUsage } from "@/lib/db/queries/gemini-usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { scriptResultSchema, SCRIPT_RESPONSE_SCHEMA, type ScriptResult } from "@/lib/validations/youtube";

/**
 * There is no general web-search API configured in this app (Lead
 * Research's "search pattern" is Google Places — business search, not
 * general web search — and no new API key exists tonight to add one), so
 * this attempts Gemini's own built-in Google Search grounding tool
 * instead, on the "structured" tier specifically. Verified live before
 * building this: "high_volume" (Gemma) silently IGNORES the google_search
 * tool declaration — no error, it just answers from its own training data
 * as if the tool didn't exist — so grounding is never attempted there.
 * Whether "structured" (Flash-Lite) actually grounds was UNVERIFIABLE at
 * first (its daily quota looked exhausted), then verified more precisely
 * the next session: plain text generation on Flash-Lite works fine right
 * now, but a request carrying the google_search tool gets a real 429
 * RESOURCE_EXHAUSTED every time — grounding has its own, separate quota
 * from the model's regular text quota, and it's the one that's tapped
 * out. `grounded` in the return value reflects whether the response
 * actually came back with real citations, not whether grounding was
 * requested — callers and the UI must check it rather than assume.
 *
 * Falls back to an ungrounded call if the grounded attempt fails for ANY
 * reason (not just this specific quota — a transient error shouldn't
 * fail the whole feature either) — found live tonight that without this,
 * one exhausted quota on a nice-to-have enhancement was taking down
 * script generation entirely. The fallback still honestly reports
 * grounded: false; it never pretends the failed attempt succeeded.
 */
export async function researchTopic(topic: string, niche?: string): Promise<{ summary: string; grounded: boolean }> {
  const prompt = `Topic: ${topic}${niche ? ` (niche: ${niche})` : ""}. What formats and angles are currently working for this kind of video? 3-5 sentences.`;
  const systemInstruction =
    "You research current YouTube video formats and angles for a given topic. Paraphrase only — describe approaches and patterns in your own words; never reproduce transcripts, scripts, or substantial verbatim text from any source. If you were not actually able to search and are reasoning from general knowledge instead, do not claim otherwise — just answer plainly.";

  try {
    const { text, grounded } = await callGemini({
      tier: "structured",
      systemInstruction,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      enableSearchGrounding: true,
      temperature: 0.5,
    });
    return { summary: text ?? "No research summary was generated.", grounded };
  } catch (err) {
    console.error("[researchTopic] grounded attempt failed, falling back to ungrounded:", err instanceof Error ? err.message : err);
    const { text } = await callGemini({
      tier: "structured",
      systemInstruction,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      temperature: 0.5,
    });
    return { summary: text ?? "No research summary was generated.", grounded: false };
  }
}

const SCRIPT_SYSTEM_INSTRUCTION = `You write a YouTube video script outline from a topic and (if given) research notes.

Rules:
- hook: the first 5-10 seconds, written to be spoken aloud, that makes someone NOT skip.
- sections: a timestamped outline (label + approximate startSec + a few sentences of content per section) covering the whole video.
- scriptBody: the fuller script text, hook through outro, written to be read aloud by the creator — not bullet points.
- Paraphrase only. Never reproduce verbatim text from the research notes or any external source — everything here should be original writing based on the ideas, not copied phrasing.
- suggestedTitle + alternativeTitles: exactly 3 alternatives, all distinct from each other and from suggestedTitle.`;

export async function generateScript(topic: string, niche: string | undefined, researchSummary: string): Promise<ScriptResult> {
  const { text } = await callGemini({
    tier: "structured",
    systemInstruction: SCRIPT_SYSTEM_INSTRUCTION,
    contents: [
      {
        role: "user",
        parts: [{ text: `Topic: ${topic}${niche ? `\nNiche: ${niche}` : ""}\n\nResearch notes:\n${researchSummary}` }],
      },
    ],
    responseSchema: SCRIPT_RESPONSE_SCHEMA,
    temperature: 0.7,
  });
  if (!text) throw new Error("Gemini returned no content for the script");
  const parsed = JSON.parse(stripMarkdownFence(text));
  const result = scriptResultSchema.safeParse(parsed);
  if (!result.success) throw new Error(`Script generation failed schema validation: ${result.error.message}`);
  return result.data;
}

// ==================================================== Thumbnails

/**
 * VERIFIED LIVE tonight, not assumed: there is no model literally named
 * "Imagen 4" reachable via this project's GEMINI_API_KEY — the image-
 * capable models on this key are Gemini's own native image-output models
 * (gemini-2.5-flash-image aka "Nano Banana", gemini-3.1-flash-lite-image,
 * gemini-3-pro-image, etc.), and gemini-2.5-flash-image returned a REAL
 * 429 with `limit: 0` for `generate_content_free_tier_requests` — i.e.
 * zero free-tier quota on this project, not "exhausted for today." A
 * second model (gemini-3.1-flash-lite-image) also 429'd. This function is
 * built correctly and will work the moment paid billing (or a project
 * with nonzero image quota) is attached — it is NOT currently usable for
 * free with this key, and generateThumbnail surfaces that plainly rather
 * than retrying forever or pretending it's a transient failure.
 */
export const YT_IMAGE_MODEL = "gemini-2.5-flash-image";

export interface ThumbnailResult {
  ok: boolean;
  error?: string;
  imageBase64?: string;
  mimeType?: string;
}

export async function generateThumbnail(prompt: string): Promise<ThumbnailResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "GEMINI_API_KEY is not configured" };

  const supabase = createAdminClient();
  // Tracked under its own model key in gemini_usage, per the work order —
  // a separate line item from the text-tier budgets, even though it
  // currently has zero free quota to spend.
  await incrementGeminiUsage(supabase, YT_IMAGE_MODEL);

  const safePrompt = `${prompt}. No real identifiable people, no copyrighted characters, no brand logos.`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${YT_IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: safePrompt }] }] }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      return { ok: false, error: "Thumbnail generation isn't available on the free tier for this API key (verified: 0 free-tier quota on gemini-2.5-flash-image)." };
    }
    return { ok: false, error: `Thumbnail generation failed: ${res.status} ${res.statusText}` };
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData);
  if (!imagePart?.inlineData) return { ok: false, error: "No image data in the response" };
  return { ok: true, imageBase64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType };
}
