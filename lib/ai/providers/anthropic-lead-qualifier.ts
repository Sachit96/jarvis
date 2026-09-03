import "server-only";
import type { LeadSignals } from "@/lib/research/types";
import { OPPORTUNITY_TAGS, SCORE_CATEGORY_MAX, qualificationResultSchema } from "@/lib/validations/lead-research";
import type { LeadQualifierProvider, LeadQualifyOutcome } from "@/lib/ai/providers/types";
import { callAnthropic } from "@/lib/ai/providers/anthropic-client";

/**
 * Anthropic implementation of the same LeadQualifierProvider interface
 * gemini-lead-qualifier.ts implements — getLeadQualifier() (providers/
 * index.ts) picks between them based on ANTHROPIC_API_KEY + spend cap,
 * never both, and callers never know which one answered.
 *
 * This exists specifically because Gemma failed the lead qualifier's
 * nested/enum schema 3/3 times live — Flash-Lite (the "structured" Gemini
 * tier) still handles it fine, so Anthropic is an OPTIONAL upgrade path
 * here, not a fix for something broken. Batches 8 businesses per call,
 * same as the Gemini implementation, for the same reason (fewer, larger
 * calls beat many small ones) even though Anthropic has no RPM scarcity
 * to route around — token cost is the same either way, and fewer calls
 * means less repeated system-prompt overhead.
 */
export const ANTHROPIC_LEAD_QUALIFIER_BATCH_SIZE = 8;

// Anthropic's output_config.format:{type:"json_schema"} uses standard
// lowercase JSON Schema — a different dialect from Gemini's uppercase
// OpenAPI-subset responseSchema (see gemini-lead-qualifier.ts's schema).
//
// Every "object" node below needs `additionalProperties: false` — found
// live tonight (Business Pipeline Cockpit Phase 0): Anthropic rejects the
// whole request with a 400 ("For 'object' type, 'additionalProperties'
// must be explicitly set to false") if even one is missing, which is why
// every single qualification in production has failed since this file
// was written — the batch's own error handling was silently swallowing
// this (see qualifyLeads' fixed catch below) so it read as a mysterious
// blanket "Anthropic qualification failed for this batch."
const PER_BUSINESS_JSON_SCHEMA = {
  type: "object",
  properties: {
    audit_summary: { type: "string" },
    opportunities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tag: { type: "string", enum: OPPORTUNITY_TAGS as unknown as string[] },
          why: { type: "string" },
        },
        required: ["tag", "why"],
        additionalProperties: false,
      },
    },
    score_breakdown: {
      type: "object",
      properties: {
        // NOT minimum/maximum — tried that the same night, live: Anthropic
        // rejects the whole request outright ("For 'integer' type,
        // properties maximum, minimum are not supported"). Its
        // output_config.format json_schema dialect is narrower than
        // standard JSON Schema here. The per-category ceiling is instead
        // enforced only in the prompt (SYSTEM_INSTRUCTION below, which
        // now actually states the numbers — it didn't before) plus
        // qualificationResultSchema's Zod .max() as the real backstop;
        // Zod validates each business independently, so one business
        // going out of range fails just that one entry, not the batch.
        website_quality: { type: "integer" },
        conversion_readiness: { type: "integer" },
        seo_basics: { type: "integer" },
        performance: { type: "integer" },
        digital_presence: { type: "integer" },
      },
      required: ["website_quality", "conversion_readiness", "seo_basics", "performance", "digital_presence"],
      additionalProperties: false,
    },
    ai_summary: { type: "string" },
  },
  required: ["audit_summary", "opportunities", "score_breakdown", "ai_summary"],
  additionalProperties: false,
};

const BATCH_JSON_SCHEMA = { type: "array", items: PER_BUSINESS_JSON_SCHEMA };

const SYSTEM_INSTRUCTION = `You are a cold-outreach research analyst scoring local businesses as sales prospects for a web/AI-systems agency.

Scoring is opportunity-inverted: the score means "how good a prospect is this for me," not "how good is their website." A worse web presence scores HIGHER, because it means more to sell. State findings plainly, no fluff.

You will be given a numbered list of businesses in one request. Return a JSON array with exactly as many objects as businesses given, in the same order. Never merge two businesses into one entry, skip one, or reorder them.

Hard rules, applied independently to EACH business:
- Never invent a fact that isn't present in that business's own signals.
- If audit_blocked is true, or a website is entirely absent, signals are thin — say so explicitly in audit_summary and score conservatively.
- opportunities.tag must be one of the fixed taxonomy values provided — never invent a new tag.
- ai_summary is 2-3 sentences a salesperson reads right before dialing the phone.
- score_breakdown values are integers within each category's max: website_quality 0-${SCORE_CATEGORY_MAX.website_quality}, conversion_readiness 0-${SCORE_CATEGORY_MAX.conversion_readiness}, seo_basics 0-${SCORE_CATEGORY_MAX.seo_basics}, performance 0-${SCORE_CATEGORY_MAX.performance}, digital_presence 0-${SCORE_CATEGORY_MAX.digital_presence}. Do not compute a total score.`;

function buildBusinessSection(signals: LeadSignals, index: number, total: number): string {
  const { place, hasWebsite, audit, pageSpeed } = signals;
  const lines: string[] = [
    `----- BUSINESS ${index + 1} of ${total} -----`,
    `Business: ${place.displayName}`,
    `Address: ${place.formattedAddress}`,
    `Google rating: ${place.rating ?? "none"} (${place.userRatingCount ?? 0} reviews)`,
    `Has website: ${hasWebsite ? "yes" : "no — strongest possible opportunity signal"}`,
  ];
  if (!hasWebsite) {
    lines.push("No further signals — there is nothing to audit.");
  } else if (!audit || audit.auditBlocked) {
    lines.push(`Website audit blocked: ${audit?.blockedReason ?? "unknown reason"}. Score conservatively.`);
  } else {
    lines.push(
      `HTTPS: ${audit.https}`,
      `Mobile viewport meta tag: ${audit.hasViewportMeta}`,
      `Title: ${audit.title ?? "missing"}${audit.hasGenericTitle ? " (generic/templated)" : ""}`,
      `Meta description: ${audit.metaDescription ?? "missing"}`,
      `CTAs present: tel=${audit.ctas.tel} mailto=${audit.ctas.mailto} form=${audit.ctas.form} bookingWords=${audit.ctas.bookingWords}`,
      `Booking system fingerprints: ${audit.bookingSystems.join(", ") || "none"}`,
      `Chat widget fingerprints: ${audit.chatWidgets.join(", ") || "none"}`,
      `Framework: ${audit.framework ?? "unknown/custom"}`,
      `Images: ${audit.imageCount} total, ${audit.imagesWithAlt} with alt text`,
      `Social links present: ${audit.hasSocialLinks}`,
      `Testimonials/reviews section: ${audit.hasTestimonials}`,
    );
    if (pageSpeed && pageSpeed.performanceScore !== null) {
      lines.push(`PageSpeed (mobile) performance score: ${pageSpeed.performanceScore}/100, LCP: ${pageSpeed.lcpMs ?? "unknown"}ms`);
    } else {
      lines.push("PageSpeed data unavailable for this run.");
    }
  }
  return lines.join("\n");
}

function buildBatchPrompt(signalsList: LeadSignals[]): string {
  const sections = signalsList.map((s, i) => buildBusinessSection(s, i, signalsList.length));
  return [...sections, "", `Opportunity taxonomy (use only these tags): ${OPPORTUNITY_TAGS.join(", ")}`].join("\n\n");
}

export class AnthropicLeadQualifier implements LeadQualifierProvider {
  async qualifyLeads(signalsList: LeadSignals[]): Promise<LeadQualifyOutcome[]> {
    if (signalsList.length === 0) return [];
    const outcomes: LeadQualifyOutcome[] = [];
    for (let i = 0; i < signalsList.length; i += ANTHROPIC_LEAD_QUALIFIER_BATCH_SIZE) {
      const batch = signalsList.slice(i, i + ANTHROPIC_LEAD_QUALIFIER_BATCH_SIZE);
      const result = await this.tryBatch(batch);
      if (Array.isArray(result)) {
        outcomes.push(...result);
      } else {
        // Same reason: this discarded the real failure ("Anthropic
        // qualification failed for this batch" told you nothing) — found
        // live tonight it was masking a real, fixable cause (batches of 10
        // truncating a 4096-token response mid-JSON). Logged AND
        // propagated into the per-lead error so it reaches
        // research_runs.error_log, not just the server console.
        console.error("[AnthropicLeadQualifier] batch failed:", result.error);
        outcomes.push(...batch.map(() => ({ error: `Anthropic qualification failed: ${result.error}` })));
      }
    }
    return outcomes;
  }

  private async tryBatch(signalsList: LeadSignals[]): Promise<LeadQualifyOutcome[] | { error: string }> {
    try {
      const { text } = await callAnthropic({
        system: SYSTEM_INSTRUCTION,
        userContent: buildBatchPrompt(signalsList),
        jsonSchema: BATCH_JSON_SCHEMA,
        // 4096 (the previous value) truncated a real 8-business batch mid-
        // JSON — found live tonight via the fixed error surfacing above,
        // which is what made this diagnosable at all instead of reading as
        // another mystery "qualification failed." Each business's own
        // output (audit_summary + up to several opportunities with a why
        // each + ai_summary) runs a few hundred tokens; 8 of them can
        // exceed 4096 depending on how much the model has to say. 8192
        // gives real headroom without changing ANTHROPIC_LEAD_QUALIFIER_
        // BATCH_SIZE, which is deliberately 8 for fewer/larger calls.
        maxTokens: 8192,
      });
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        return { error: `response wasn't valid JSON (${err instanceof Error ? err.message : "parse error"}) — likely truncated at the maxTokens limit for a ${signalsList.length}-business batch. Raw tail: ${text.slice(-200)}` };
      }
      if (!Array.isArray(parsed)) return { error: `response was not a JSON array (got ${typeof parsed})` };
      if (parsed.length !== signalsList.length) return { error: `response had ${parsed.length} entries for a ${signalsList.length}-business batch` };
      return parsed.map((item): LeadQualifyOutcome => {
        const result = qualificationResultSchema.safeParse(item);
        return result.success ? { result: result.data } : { error: `Schema validation failed: ${result.error.message}` };
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Unknown error" };
    }
  }
}
