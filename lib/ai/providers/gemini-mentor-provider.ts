import "server-only";
import { callGemini, stripMarkdownFence, type GeminiContent } from "@/lib/ai/providers/gemini-client";
import type { MentorProvider, MentorChatMessage, MentorBriefResult, LoggedMealArgs } from "@/lib/ai/providers/types";

// Tier routing (see gemini-client.ts for the full verified rationale): all
// three methods here route to "high_volume" (gemma-4-31b-it) — none of them
// need what "structured" uniquely offers. generateBrief's schema is flat
// (no nesting, no enums), verified reliable on Gemma 3/3 times; chat is
// plain text; nutritionChat's tool-calling round trip was verified working
// both directions live. The lead qualifier (a separate provider class)
// stays on "structured" — its nested/enum schema is exactly the shape that
// failed on Gemma. The effort: "fast" | "deep" parameter on generateBrief
// is kept (weekly review still asks for "deep") but both currently resolve
// to the same tier/model — effort tuning within a tier is a possible
// future refinement, not something either the old or new routing does.

const BRIEF_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    markdownBody: { type: "STRING" },
    focusAreas: { type: "ARRAY", items: { type: "STRING" } },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    weaknesses: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["markdownBody", "focusAreas", "strengths", "weaknesses"],
};

const LOG_NUTRITION_TOOL = {
  name: "log_nutrition_entry",
  description: "Log a meal or food the user describes into their nutrition diary, with your best estimate of its macros.",
  parameters: {
    type: "OBJECT",
    properties: {
      meal_type: { type: "STRING", enum: ["breakfast", "lunch", "dinner", "snack"] },
      description: { type: "STRING", description: "Short description of what was eaten" },
      calories: { type: "NUMBER" },
      protein_g: { type: "NUMBER" },
      carbs_g: { type: "NUMBER" },
      fat_g: { type: "NUMBER" },
    },
    required: ["meal_type", "description", "calories", "protein_g", "carbs_g", "fat_g"],
  },
};

/** MentorChatMessage uses "assistant" (matches the mentor_messages DB column and the rest of this app); Gemini's contents use "model". */
function toGeminiContents(history: MentorChatMessage[]): GeminiContent[] {
  return history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export class GeminiMentorProvider implements MentorProvider {
  async generateBrief(systemPrompt: string, _effort: "fast" | "deep"): Promise<MentorBriefResult> {
    // "high_volume": flat schema (no nesting, no enums), verified reliable
    // on Gemma — see the tier doc comment in gemini-client.ts.
    const { text } = await callGemini({
      tier: "high_volume",
      systemInstruction: systemPrompt,
      contents: [{ role: "user", parts: [{ text: "Generate it now." }] }],
      responseSchema: BRIEF_RESPONSE_SCHEMA,
      temperature: 0.6,
    });
    if (!text) throw new Error("Gemini response had no text part");

    try {
      const parsed = JSON.parse(stripMarkdownFence(text));
      const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
      return {
        markdownBody: typeof parsed.markdownBody === "string" ? parsed.markdownBody : text,
        focusAreas: strings(parsed.focusAreas),
        strengths: strings(parsed.strengths),
        weaknesses: strings(parsed.weaknesses),
      };
    } catch {
      return { markdownBody: text, focusAreas: [], strengths: [], weaknesses: [] };
    }
  }

  async chat(systemPrompt: string, history: MentorChatMessage[]): Promise<string> {
    // "high_volume": plain text, no schema, no tools — and this is the
    // highest-frequency call in the app (general mentor chat + Voice
    // Mode share it), so the ~29x daily-request headroom matters most
    // here. Verified live against real buildMentorContext() data + full
    // conversation history: ~2,266 total tokens for one real turn
    // (including Gemma's hidden thinking tokens), ~14% of the 16K/min
    // ceiling for a single call.
    const { text } = await callGemini({
      tier: "high_volume",
      systemInstruction: systemPrompt,
      contents: toGeminiContents(history),
    });
    return text ?? "…";
  }

  async nutritionChat(
    systemPrompt: string,
    history: MentorChatMessage[],
    executeTool: (args: LoggedMealArgs) => Promise<string>,
  ): Promise<string> {
    // "high_volume": needs function calling, not structured JSON — verified
    // live both call directions (functionCall out, functionResponse back
    // in) work correctly on Gemma, including a correct final answer after
    // the tool result comes back.
    const contents = toGeminiContents(history);

    const first = await callGemini({
      tier: "high_volume",
      systemInstruction: systemPrompt,
      contents,
      tools: [LOG_NUTRITION_TOOL],
    });

    const call = first.functionCalls.find((c) => c.name === "log_nutrition_entry");
    if (!call) return first.text ?? "…";

    const resultMessage = await executeTool(call.args as unknown as LoggedMealArgs);

    const second = await callGemini({
      tier: "high_volume",
      systemInstruction: systemPrompt,
      contents: [
        ...contents,
        { role: "model", parts: [{ functionCall: call }] },
        { role: "user", parts: [{ functionResponse: { name: "log_nutrition_entry", response: { result: resultMessage } } }] },
      ],
      tools: [LOG_NUTRITION_TOOL],
    });
    return second.text ?? "Logged it.";
  }
}
