import "server-only";
import { callGemini, stripMarkdownFence } from "@/lib/ai/providers/gemini-client";
import { scriptResultSchema, SCRIPT_RESPONSE_SCHEMA, type ScriptResult } from "@/lib/validations/youtube";

/**
 * There is no general web-search API configured in this app (Lead
 * Research's "search pattern" is Google Places — business search, not
 * general web search), so this WOULD attempt Gemini's own built-in Google
 * Search grounding tool instead — except grounding is disabled below.
 * Two live tests, weeks apart (this session and the one before it): a
 * request carrying the google_search tool on the "structured" tier gets
 * an immediate 429 RESOURCE_EXHAUSTED, every single time, on the very
 * first attempt — plain text generation on the same model/key works fine
 * throughout. Grounding has its own quota, separate from the model's
 * regular text quota (confirmed: Gemma silently ignores the tool
 * declaration entirely rather than erroring, so this was never attempted
 * there either). Google's free allowance for this is documented as
 * 5,000 grounded requests/month — but the 429 response carries no
 * QuotaFailure detail naming which metric was hit, so "genuinely zero
 * allocated" vs. "somehow already exhausted" can't be distinguished from
 * the API response alone. The circumstantial case for zero is strong,
 * though: this project has never had a single grounded call succeed, on
 * either test, and there is no plausible path to 5,000 real successful
 * calls having happened in between for a project that's only ever been
 * dev-tested. If Cloud Console (ai.dev/rate-limit, or the Generative
 * Language API's quota page under IAM & Admin > Quotas for this
 * project) later shows real nonzero grounding quota, re-enable by
 * passing `enableSearchGrounding: true` here again — the parameter and
 * grounded-detection logic are both still fully intact in
 * gemini-client.ts, only this one call site stopped using them.
 *
 * `grounded` is always false now — kept in the return shape (rather than
 * removed) so callers/the UI that already branch on it don't need a
 * wider change; it's just no longer ever true.
 */
export async function researchTopic(topic: string, niche?: string): Promise<{ summary: string; grounded: boolean }> {
  const prompt = `Topic: ${topic}${niche ? ` (niche: ${niche})` : ""}. What formats and angles are currently working for this kind of video? 3-5 sentences.`;
  const systemInstruction =
    "You research current YouTube video formats and angles for a given topic. Paraphrase only — describe approaches and patterns in your own words; never reproduce transcripts, scripts, or substantial verbatim text from any source. If you were not actually able to search and are reasoning from general knowledge instead, do not claim otherwise — just answer plainly.";

  const { text } = await callGemini({
    tier: "structured",
    systemInstruction,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    temperature: 0.5,
  });
  return { summary: text ?? "No research summary was generated.", grounded: false };
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

// Thumbnail generation (generateThumbnail, YT_IMAGE_MODEL) was removed
// this session (cleanup work order Phase 1d) — re-verified live, not just
// re-asserted: every image-capable model on this GEMINI_API_KEY
// (gemini-2.5-flash-image, gemini-3-pro-image, gemini-3-pro-image-preview,
// gemini-3.1-flash-image, gemini-3.1-flash-image-preview,
// gemini-3.1-flash-lite-image — the full ListModels result, not just the
// two tried previously) returns a real 429 with an explicit QuotaFailure
// detail naming `limit: 0` for generate_content_free_tier_requests. Will
// work the moment paid billing (or a project with nonzero image quota) is
// attached — restore from git history (this comment's own commit) if that
// changes. Until then, a button that can never succeed is worse than no
// button — see actions/youtube-actions.ts's comment for the rest.
