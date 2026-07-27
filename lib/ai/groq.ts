import "server-only";
import Groq from "groq-sdk";

export const MENTOR_MODEL = "llama-3.3-70b-versatile";

let cachedClient: Groq | null | undefined;

/** Returns null (rather than throwing) when GROQ_API_KEY isn't set yet, so callers can render a fallback UI. */
export function getGroqClient(): Groq | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.GROQ_API_KEY;
  cachedClient = apiKey ? new Groq({ apiKey }) : null;
  return cachedClient;
}
