import "server-only";
import { getIntegrationStatus, isUsable, type IntegrationStatus } from "@/lib/integrations/status";

/**
 * Brightspace (D2L Valence) adapter.
 *
 * The shape here follows richardantao/brightspace-lms-js — an OAuth2
 * authorization-code flow, a host-scoped client, and version-negotiated
 * resource calls — and that package is MIT, so it should be installed rather
 * than reimplemented once the sandbox allows it. What this file provides is
 * the seam it plugs into: the rest of JARVIS talks to these functions, so
 * swapping the placeholder internals for the real client changes this
 * directory and nothing else.
 *
 * BLOCKED, and deliberately not faked:
 *   1. `npm i brightspace-lms` is denied by this environment's sandbox.
 *   2. Brightspace OAuth needs an app registered with the institution.
 *      Many universities, TMU included, do not offer student app
 *      registration — so this may stay configuration_required indefinitely
 *      through no fault of the code.
 *
 * Until both clear, every function returns an unusable status. It never
 * falls back to the manually-entered course data: those are different
 * claims, and an assistant that presents local data as LMS data is exactly
 * the failure this status system exists to prevent. The University module's
 * own pages keep working from Supabase as they always have.
 *
 * NO PASSWORDS. The flow below is authorization-code only; there is no path
 * in this adapter that accepts a user's Brightspace credentials.
 */

export interface BrightspaceCourse {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface BrightspaceAssignment {
  id: string;
  course_id: string;
  title: string;
  due_at: string | null;
}

export interface BrightspaceGrade {
  course_id: string;
  item_name: string;
  points_earned: number | null;
  points_possible: number | null;
}

export interface BrightspaceResult<T> {
  status: IntegrationStatus;
  data?: T;
  failure?: string;
}

export function getBrightspaceStatus(): IntegrationStatus {
  return getIntegrationStatus("brightspace");
}

/**
 * Where the OAuth redirect would be built.
 *
 * Returns null rather than a half-formed URL when the app is not registered,
 * so a "Connect Brightspace" button can render disabled with a reason
 * instead of sending the user to a broken authorize page.
 */
export function getAuthorizationUrl(redirectUri: string): string | null {
  const host = process.env.BRIGHTSPACE_HOST;
  const clientId = process.env.BRIGHTSPACE_CLIENT_ID;
  if (!host || !clientId) return null;

  const url = new URL("/d2l/auth/api/token", host);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  // Read-only scopes: this integration reads coursework, it never submits.
  url.searchParams.set("scope", "core:*:* grades:*:read enrollment:*:read");
  return url.toString();
}

/**
 * Guard shared by every fetch below.
 *
 * Written once so a new resource function cannot forget the check and
 * silently return an empty list that reads as "you have no assignments".
 */
function unusable<T>(): BrightspaceResult<T> | null {
  const status = getBrightspaceStatus();
  return isUsable(status.state) ? null : { status };
}

export async function fetchCourses(): Promise<BrightspaceResult<BrightspaceCourse[]>> {
  const blocked = unusable<BrightspaceCourse[]>();
  if (blocked) return blocked;
  // Unreachable until the package and an OAuth grant exist. Throwing rather
  // than returning [] means a mistake here surfaces as an error, not as a
  // student being told they have no courses.
  throw new Error("Brightspace client not installed — see lib/integrations/brightspace/index.ts");
}

export async function fetchAssignments(): Promise<BrightspaceResult<BrightspaceAssignment[]>> {
  const blocked = unusable<BrightspaceAssignment[]>();
  if (blocked) return blocked;
  throw new Error("Brightspace client not installed — see lib/integrations/brightspace/index.ts");
}

export async function fetchGrades(): Promise<BrightspaceResult<BrightspaceGrade[]>> {
  const blocked = unusable<BrightspaceGrade[]>();
  if (blocked) return blocked;
  throw new Error("Brightspace client not installed — see lib/integrations/brightspace/index.ts");
}
