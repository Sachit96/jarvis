import type { LeadSignals } from "../../../../lib/research/types";
import { OPPORTUNITY_TAGS, SCORE_CATEGORY_MAX, qualificationResultSchema } from "../../../../lib/validations/lead-research";
import type { LeadQualifierProvider, LeadQualifyOutcome } from "../../../../lib/ai/providers/types";
import { callGemini } from "./gemini-client";

// Deliberate duplicate of lib/ai/providers/gemini-lead-qualifier.ts — see
// _shared/admin-client.ts's comment for why. Only the guard line and the
// import paths (callGemini from the sibling _shared/research duplicate;
// everything else from the real, unguarded lib files) differ from the
// original.

export const LEAD_QUALIFIER_BATCH_SIZE = 8;

const PER_BUSINESS_SCHEMA = {
  type: "OBJECT",
  properties: {
    audit_summary: { type: "STRING" },
    opportunities: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          tag: { type: "STRING", enum: OPPORTUNITY_TAGS as unknown as string[] },
          why: { type: "STRING" },
        },
        required: ["tag", "why"],
      },
    },
    score_breakdown: {
      type: "OBJECT",
      properties: {
        website_quality: { type: "INTEGER", minimum: 0, maximum: SCORE_CATEGORY_MAX.website_quality },
        conversion_readiness: { type: "INTEGER", minimum: 0, maximum: SCORE_CATEGORY_MAX.conversion_readiness },
        seo_basics: { type: "INTEGER", minimum: 0, maximum: SCORE_CATEGORY_MAX.seo_basics },
        performance: { type: "INTEGER", minimum: 0, maximum: SCORE_CATEGORY_MAX.performance },
        digital_presence: { type: "INTEGER", minimum: 0, maximum: SCORE_CATEGORY_MAX.digital_presence },
      },
      required: ["website_quality", "conversion_readiness", "seo_basics", "performance", "digital_presence"],
    },
    ai_summary: { type: "STRING" },
  },
  required: ["audit_summary", "opportunities", "score_breakdown", "ai_summary"],
};

const BATCH_RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: PER_BUSINESS_SCHEMA,
};

const SYSTEM_INSTRUCTION = `You are a cold-outreach research analyst scoring local businesses as sales prospects for a web/AI-systems agency.

Scoring is opportunity-inverted: the score means "how good a prospect is this for me," not "how good is their website." A worse web presence scores HIGHER, because it means more to sell. State findings plainly, no fluff.

You will be given a numbered list of businesses in one request. Return a JSON array with exactly as many objects as businesses given, in the same order — index 0 of the array corresponds to the first business, index 1 to the second, and so on. Never merge two businesses into one entry, skip one, or reorder them.

Hard rules, applied independently to EACH business:
- Never invent a fact that isn't present in that business's own signals. If you don't have evidence for something, don't claim it.
- If audit_blocked is true, or a website is entirely absent, signals are thin — say so explicitly in audit_summary and score conservatively (don't max out categories you have no real evidence for).
- opportunities.tag must be one of the fixed taxonomy values provided — never invent a new tag.
- ai_summary is 2-3 sentences a salesperson reads right before dialing the phone — concrete and specific to that business, not generic.
- score_breakdown values are integers within each category's max: website_quality 0-${SCORE_CATEGORY_MAX.website_quality}, conversion_readiness 0-${SCORE_CATEGORY_MAX.conversion_readiness}, seo_basics 0-${SCORE_CATEGORY_MAX.seo_basics}, performance 0-${SCORE_CATEGORY_MAX.performance}, digital_presence 0-${SCORE_CATEGORY_MAX.digital_presence}. Do not attempt to compute or report a total score — that's handled by the caller.`;

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
    lines.push(`Website audit blocked: ${audit?.blockedReason ?? "unknown reason"}. Score conservatively — you have almost no real evidence here.`);
  } else {
    lines.push(
      `HTTPS: ${audit.https}`,
      `Mobile viewport meta tag: ${audit.hasViewportMeta}`,
      `Title: ${audit.title ?? "missing"}${audit.hasGenericTitle ? " (generic/templated)" : ""}`,
      `Meta description: ${audit.metaDescription ?? "missing"}`,
      `CTAs present: tel=${audit.ctas.tel} mailto=${audit.ctas.mailto} form=${audit.ctas.form} bookingWords=${audit.ctas.bookingWords}`,
      `Booking system fingerprints: ${audit.bookingSystems.join(", ") || "none"}`,
      `Chat widget fingerprints: ${audit.chatWidgets.join(", ") || "none"}`,
      `Footer copyright year: ${audit.footerCopyrightYear ?? "not found"}`,
      `Framework: ${audit.framework ?? "unknown/custom"}`,
      `Images: ${audit.imageCount} total, ${audit.imagesWithAlt} with alt text`,
      `Social links present: ${audit.hasSocialLinks}`,
      `Testimonials/reviews section: ${audit.hasTestimonials}`,
      `Extracted email: ${audit.extractedEmail ?? "none found"}`,
    );
    if (pageSpeed && pageSpeed.performanceScore !== null) {
      lines.push(`PageSpeed (mobile) performance score: ${pageSpeed.performanceScore}/100, LCP: ${pageSpeed.lcpMs ?? "unknown"}ms`);
    } else {
      lines.push("PageSpeed data unavailable for this run — don't penalize or credit performance beyond what the signals above already show.");
    }
  }
  return lines.join("\n");
}

function buildBatchPrompt(signalsList: LeadSignals[]): string {
  const sections = signalsList.map((s, i) => buildBusinessSection(s, i, signalsList.length));
  return [...sections, "", `Opportunity taxonomy (use only these tags): ${OPPORTUNITY_TAGS.join(", ")}`].join("\n\n");
}

export class GeminiLeadQualifier implements LeadQualifierProvider {
  async qualifyLeads(signalsList: LeadSignals[]): Promise<LeadQualifyOutcome[]> {
    if (signalsList.length === 0) return [];

    let batchResult = await this.tryBatch(signalsList);
    if (!batchResult) {
      batchResult = await this.tryBatch(signalsList);
    }
    if (!batchResult) {
      return this.qualifyIndividually(signalsList);
    }

    const failedIndexes = batchResult.map((o, i) => (o.error ? i : -1)).filter((i) => i !== -1);
    if (failedIndexes.length === 0) return batchResult;

    const fallbackResults = await this.qualifyIndividually(failedIndexes.map((i) => signalsList[i]));
    failedIndexes.forEach((originalIndex, j) => {
      batchResult![originalIndex] = fallbackResults[j];
    });
    return batchResult;
  }

  private async qualifyIndividually(signalsList: LeadSignals[]): Promise<LeadQualifyOutcome[]> {
    const outcomes: LeadQualifyOutcome[] = [];
    for (const signals of signalsList) {
      const single = await this.tryBatch([signals]);
      outcomes.push(single?.[0] ?? { error: "Qualification failed after batch, retry, and individual fallback" });
    }
    return outcomes;
  }

  private async tryBatch(signalsList: LeadSignals[]): Promise<LeadQualifyOutcome[] | null> {
    try {
      const { text } = await callGemini({
        tier: "structured",
        systemInstruction: SYSTEM_INSTRUCTION,
        contents: [{ role: "user", parts: [{ text: buildBatchPrompt(signalsList) }] }],
        responseSchema: BATCH_RESPONSE_SCHEMA,
        temperature: 0.4,
      });
      if (!text) return null;

      const parsed = JSON.parse(text);

      if (process.env.LEAD_RESEARCH_DEBUG_GEMINI === "1") {
        console.log("[gemini-lead-qualifier] raw batch response (pre-Zod):", JSON.stringify(parsed, null, 2));
      }

      if (!Array.isArray(parsed) || parsed.length !== signalsList.length) {
        console.error(`[GeminiLeadQualifier] response array length mismatch: got ${Array.isArray(parsed) ? parsed.length : typeof parsed} for a ${signalsList.length}-business batch`);
        return null;
      }

      return parsed.map((item): LeadQualifyOutcome => {
        const result = qualificationResultSchema.safeParse(item);
        return result.success ? { result: result.data } : { error: `Schema validation failed: ${result.error.message}` };
      });
    } catch (err) {
      console.error("[GeminiLeadQualifier] batch call threw:", err instanceof Error ? err.message : err);
      return null;
    }
  }
}
