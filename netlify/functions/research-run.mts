// Netlify Background Function — up to 15 minutes, vs. the 60-second hard
// cap on a standard Next.js route handler here. A 25-business run doing a
// website fetch + PageSpeed call + LLM call per business easily exceeds 60s,
// so the actual work happens here, triggered by a fire-and-forget POST from
// app/api/research/runs/route.ts (which returns immediately with the run id
// for the client to poll).
//
// Relative imports, not the app's "@/..." alias — this file is bundled by
// Netlify's own function bundler, separately from the Next.js build, and
// isn't guaranteed to resolve tsconfig path aliases the same way.
//
// runResearchJob comes from the _shared/research/ duplicate, NOT
// lib/research/run-job.ts directly — found live (2026-09-06): that file
// (and 7 more it transitively imports — places.ts, audit.ts, pagespeed.ts,
// gemini-lead-qualifier.ts, anthropic-lead-qualifier.ts, anthropic-
// client.ts, lib/ai/providers.ts) all open with `import "server-only"`,
// whose unconditional real implementation crashes at module load under
// any bundler that isn't Next.js's own. That crash happened before this
// function ever reached a single line of the actual research pipeline,
// for every invocation since research-run.mts was written — see
// _shared/admin-client.ts's comment for the full mechanism.
// researchRunParamsSchema has no such guard (plain Zod, no "server-only"),
// so it's still imported directly from the real file.
import { runResearchJob } from "./_shared/research/run-job";
import { researchRunParamsSchema } from "../../lib/validations/lead-research";

export default async (req: Request) => {
  const body = await req.json().catch(() => null);
  const runId = body?.runId;
  const parsed = researchRunParamsSchema.safeParse(body?.params);

  if (!runId || !parsed.success) {
    // No client is waiting on this response (Background Functions don't
    // support it anyway) — this only shows up in Netlify's function logs.
    console.error("[research-run] invalid invocation body", { runId, error: parsed.success ? null : parsed.error.message });
    return;
  }

  await runResearchJob(runId, parsed.data);
};

export const config = {
  background: true,
};
