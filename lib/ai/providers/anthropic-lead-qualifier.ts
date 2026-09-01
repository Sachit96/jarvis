import "server-only";
import type { LeadSignals } from "@/lib/research/types";
import { OPPORTUNITY_TAGS, qualificationResultSchema } from "@/lib/validations/lead-research";
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
      },
    },
    score_breakdown: {
      type: "object",
      properties: {
        website_quality: { type: "integer" },
        conversion_readiness: { type: "integer" },
        seo_basics: { type: "integer" },
        performance: { type: "integer" },
        digital_presence: { type: "integer" },
      },
      required: ["website_quality", "conversion_readiness", "seo_basics", "performance", "digital_presence"],
    },
    ai_summary: { type: "string" },
  },
  required: ["audit_summary", "opportunities", "score_breakdown", "ai_summary"],
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
- score_breakdown values are integers within each category's stated max. Do not compute a total score.`;

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
      if (result) {
        outcomes.push(...result);
      } else {
        outcomes.push(...batch.map(() => ({ error: "Anthropic qualification failed for this batch" })));
      }
    }
    return outcomes;
  }

  private async tryBatch(signalsList: LeadSignals[]): Promise<LeadQualifyOutcome[] | null> {
    try {
      const { text } = await callAnthropic({
        system: SYSTEM_INSTRUCTION,
        userContent: buildBatchPrompt(signalsList),
        jsonSchema: BATCH_JSON_SCHEMA,
        maxTokens: 4096,
        temperature: 0.4,
      });
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length !== signalsList.length) return null;
      return parsed.map((item): LeadQualifyOutcome => {
        const result = qualificationResultSchema.safeParse(item);
        return result.success ? { result: result.data } : { error: `Schema validation failed: ${result.error.message}` };
      });
    } catch {
      return null;
    }
  }
}
