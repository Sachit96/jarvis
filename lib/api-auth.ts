import "server-only";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Bearer-token check shared by every route this session's Phase 2
 * hardening protects (export, Hevy sync, research runs) — same pattern
 * app/api/mentor/run/route.ts already used, extracted so it's not
 * reimplemented slightly differently in four places. Constant-time
 * comparison (same reasoning as proxy.ts's SITE_PASSWORD check) so a
 * mismatched token can't be brute-forced faster via response timing.
 */
export function hasValidBearerToken(request: NextRequest, secretEnvVar: string): boolean {
  const secret = process.env[secretEnvVar];
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const supplied = authHeader.slice("Bearer ".length);

  const suppliedBuffer = Buffer.from(supplied);
  const secretBuffer = Buffer.from(secret);
  return suppliedBuffer.length === secretBuffer.length && timingSafeEqual(suppliedBuffer, secretBuffer);
}
