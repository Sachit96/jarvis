"use server";

import { getGroqClient, MENTOR_MODEL } from "@/lib/ai/groq";

export interface GroqTestResult {
  ok: boolean;
  message: string;
}

export async function testGroqConnectionAction(): Promise<GroqTestResult> {
  const client = getGroqClient();
  if (!client) {
    return { ok: false, message: "GROQ_API_KEY is not set." };
  }
  try {
    const result = await client.chat.completions.create({
      model: MENTOR_MODEL,
      messages: [{ role: "user", content: "Reply with the single word: pong" }],
      max_tokens: 5,
    });
    const reply = result.choices[0]?.message.content ?? "";
    return { ok: true, message: `Connected — model replied: "${reply.trim()}"` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
  }
}
