import "server-only";
import type { PageSpeedResult } from "@/lib/research/types";

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const TIMEOUT_MS = 15_000; // PageSpeed genuinely runs a Lighthouse pass server-side — slower than a plain fetch by design

/** Never blocks the run — any failure (timeout, quota, bad response shape) returns nulls, not a thrown error. */
export async function getPageSpeed(websiteUrl: string): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) return { performanceScore: null, lcpMs: null };

  const url = new URL(ENDPOINT);
  url.searchParams.set("url", websiteUrl);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("strategy", "mobile");
  url.searchParams.set("category", "performance");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) return { performanceScore: null, lcpMs: null };
    const data = await res.json();
    const scoreFraction = data?.lighthouseResult?.categories?.performance?.score;
    const lcp = data?.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue;
    return {
      performanceScore: typeof scoreFraction === "number" ? Math.round(scoreFraction * 100) : null,
      lcpMs: typeof lcp === "number" ? Math.round(lcp) : null,
    };
  } catch {
    return { performanceScore: null, lcpMs: null };
  } finally {
    clearTimeout(timer);
  }
}
