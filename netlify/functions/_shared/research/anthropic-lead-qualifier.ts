import type { LeadSignals } from "../../../../lib/research/types";
import { OPPORTUNITY_TAGS, SCORE_CATEGORY_MAX, qualificationResultSchema } from "../../../../lib/validations/lead-research";
import type { LeadQualifierProvider, LeadQualifyOutcome } from "../../../../lib/ai/providers/types";
import { callAnthropic, type AnthropicCallOptions, type AnthropicCallResult } from "./anthropic-client";

// Deliberate duplicate of lib/ai/providers/anthropic-lead-qualifier.ts —
// see _shared/admin-client.ts's comment for why. Only the guard line and
// the import paths (callAnthropic from the sibling _shared/research
// duplicate; everything else from the real, unguarded lib files) differ
// from the original.

export const ANTHROPIC_LEAD_QUALIFIER_BATCH_SIZE = 8;

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
  constructor(private readonly callModel: (options: AnthropicCallOptions) => Promise<AnthropicCallResult> = callAnthropic) {}

  async qualifyLeads(signalsList: LeadSignals[]): Promise<LeadQualifyOutcome[]> {
    if (signalsList.length === 0) return [];
    const outcomes: LeadQualifyOutcome[] = [];
    for (let i = 0; i < signalsList.length; i += ANTHROPIC_LEAD_QUALIFIER_BATCH_SIZE) {
      const batch = signalsList.slice(i, i + ANTHROPIC_LEAD_QUALIFIER_BATCH_SIZE);
      outcomes.push(...(await this.qualifyBatchWithBisection(batch)));
    }
    return outcomes;
  }

  private async qualifyBatchWithBisection(signalsList: LeadSignals[]): Promise<LeadQualifyOutcome[]> {
    const result = await this.tryBatch(signalsList);
    if (Array.isArray(result)) return result;

    if (result.truncated && signalsList.length > 1) {
      const mid = Math.ceil(signalsList.length / 2);
      console.error(`[AnthropicLeadQualifier] batch of ${signalsList.length} looked truncated, splitting into ${mid} + ${signalsList.length - mid} and retrying:`, result.error);
      const [first, second] = await Promise.all([
        this.qualifyBatchWithBisection(signalsList.slice(0, mid)),
        this.qualifyBatchWithBisection(signalsList.slice(mid)),
      ]);
      return [...first, ...second];
    }

    console.error("[AnthropicLeadQualifier] batch failed:", result.error);
    return signalsList.map(() => ({ error: `Anthropic qualification failed: ${result.error}` }));
  }

  private async tryBatch(signalsList: LeadSignals[]): Promise<LeadQualifyOutcome[] | { error: string; truncated?: boolean }> {
    try {
      const { text } = await this.callModel({
        system: SYSTEM_INSTRUCTION,
        userContent: buildBatchPrompt(signalsList),
        jsonSchema: BATCH_JSON_SCHEMA,
        maxTokens: 8192,
      });
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        return { truncated: true, error: `response wasn't valid JSON (${err instanceof Error ? err.message : "parse error"}) — likely truncated at the maxTokens limit for a ${signalsList.length}-business batch. Raw tail: ${text.slice(-200)}` };
      }
      if (!Array.isArray(parsed)) return { error: `response was not a JSON array (got ${typeof parsed})` };
      if (parsed.length !== signalsList.length) {
        return { truncated: true, error: `response had ${parsed.length} entries for a ${signalsList.length}-business batch` };
      }
      return parsed.map((item): LeadQualifyOutcome => {
        const result = qualificationResultSchema.safeParse(item);
        return result.success ? { result: result.data } : { error: `Schema validation failed: ${result.error.message}` };
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Unknown error" };
    }
  }
}
