import "server-only";
import { callGemini, type GeminiContent } from "@/lib/ai/providers/gemini-client";
import type { MentorProvider, MentorChatMessage, MentorBriefResult, LoggedMealArgs } from "@/lib/ai/providers/types";

// The model itself now lives in one place — lib/ai/providers/gemini-client.ts's
// GEMINI_MODEL — not here. The effort: "fast" | "deep" parameter on
// generateBrief is kept (weekly review still asks for "deep") but both
// currently resolve to the same model; every full-tier Flash/Pro model on
// this project is rate-limited to 5 RPM / 20 RPD, unusable across five
// features sharing one key, so quality is traded for 25x the daily budget
// for now. See gemini-client.ts for the ground-truth numbers and the
// eventual-upgrade-path note for voice specifically.

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
    const { text } = await callGemini({
      systemInstruction: systemPrompt,
      contents: [{ role: "user", parts: [{ text: "Generate it now." }] }],
      responseSchema: BRIEF_RESPONSE_SCHEMA,
      temperature: 0.6,
    });
    if (!text) throw new Error("Gemini response had no text part");

    try {
      const parsed = JSON.parse(text);
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
    const { text } = await callGemini({
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
    const contents = toGeminiContents(history);

    const first = await callGemini({
      systemInstruction: systemPrompt,
      contents,
      tools: [LOG_NUTRITION_TOOL],
    });

    const call = first.functionCalls.find((c) => c.name === "log_nutrition_entry");
    if (!call) return first.text ?? "…";

    const resultMessage = await executeTool(call.args as unknown as LoggedMealArgs);

    const second = await callGemini({
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
