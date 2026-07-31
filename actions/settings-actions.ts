"use server";

import { getMentorProvider } from "@/lib/ai/providers";
import { GEMINI_MODEL } from "@/lib/ai/providers/gemini-client";

export interface GeminiTestResult {
  ok: boolean;
  message: string;
}

export async function testGeminiConnectionAction(): Promise<GeminiTestResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, message: "GEMINI_API_KEY is not set." };
  }
  try {
    const reply = await getMentorProvider().chat(
      "Reply with exactly one word: pong",
      [{ role: "user", content: "ping" }],
    );
    return { ok: true, message: `Connected (${GEMINI_MODEL}) — model replied: "${reply.trim()}"` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
  }
}
