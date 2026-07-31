"use server";

import { getMentorProvider } from "@/lib/ai/providers";
import { TIER_MODEL } from "@/lib/ai/providers/gemini-client";

export interface GeminiTestResult {
  ok: boolean;
  message: string;
}

export async function testGeminiConnectionAction(): Promise<GeminiTestResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, message: "GEMINI_API_KEY is not set." };
  }
  try {
    // chat() always routes to the "high_volume" tier (see gemini-mentor-provider.ts) — this test exercises that tier specifically, not the "structured" one.
    const reply = await getMentorProvider().chat(
      "Reply with exactly one word: pong",
      [{ role: "user", content: "ping" }],
    );
    return { ok: true, message: `Connected (${TIER_MODEL.high_volume}) — model replied: "${reply.trim()}"` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
  }
}
