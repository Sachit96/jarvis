import { z } from "zod";
import { numeric, optionalNumeric, optionalTextInput } from "@/lib/validation";

/** Fixed, filterable taxonomy — the model must pick from this list, never free text. */
export const OPPORTUNITY_TAGS = [
  "new_website",
  "website_redesign",
  "booking_system",
  "ai_chatbot",
  "ai_receptionist",
  "crm_followup",
  "review_automation",
  "seo",
  "paid_ads",
  "social_media",
] as const;
export type OpportunityTag = (typeof OPPORTUNITY_TAGS)[number];

export const OPPORTUNITY_LABEL: Record<OpportunityTag, string> = {
  new_website: "New Website",
  website_redesign: "Website Redesign",
  booking_system: "Booking System",
  ai_chatbot: "AI Chatbot",
  ai_receptionist: "AI Receptionist",
  crm_followup: "CRM Follow-up",
  review_automation: "Review Automation",
  seo: "SEO",
  paid_ads: "Paid Ads",
  social_media: "Social Media",
};

/** The five score_breakdown categories and their max points — max values must sum to 100. */
export const SCORE_CATEGORY_MAX = {
  website_quality: 30,
  conversion_readiness: 25,
  seo_basics: 15,
  performance: 15,
  digital_presence: 15,
} as const;

/**
 * What the LLM must return. Deliberately does NOT include a top-level `score`
 * field — "compute in code, don't trust the model's math" means the model
 * isn't asked to add up its own breakdown at all; lib/research/qualify.ts
 * sums score_breakdown itself once this parses.
 */
export const qualificationResultSchema = z.object({
  audit_summary: z.string().trim().min(1).max(2000),
  opportunities: z
    .array(
      z.object({
        tag: z.enum(OPPORTUNITY_TAGS),
        why: z.string().trim().min(1).max(300),
      }),
    )
    .max(OPPORTUNITY_TAGS.length),
  score_breakdown: z.object({
    website_quality: z.number().int().min(0).max(SCORE_CATEGORY_MAX.website_quality),
    conversion_readiness: z.number().int().min(0).max(SCORE_CATEGORY_MAX.conversion_readiness),
    seo_basics: z.number().int().min(0).max(SCORE_CATEGORY_MAX.seo_basics),
    performance: z.number().int().min(0).max(SCORE_CATEGORY_MAX.performance),
    digital_presence: z.number().int().min(0).max(SCORE_CATEGORY_MAX.digital_presence),
  }),
  ai_summary: z.string().trim().min(1).max(600),
});
export type QualificationResult = z.infer<typeof qualificationResultSchema>;

/** Score bands for the Lead Research results table — "which of these do I call first." */
export const SCORE_BANDS = ["hot", "warm", "skip"] as const;
export type ScoreBand = (typeof SCORE_BANDS)[number];

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "skip";
}

export const SCORE_BAND_LABEL: Record<ScoreBand, string> = { hot: "Hot", warm: "Warm", skip: "Skip" };

/** "score is computed in code, don't trust the model's math" — the model is never asked for a total, this is the only place one gets produced. */
export function computeScore(breakdown: QualificationResult["score_breakdown"]): number {
  return (
    breakdown.website_quality +
    breakdown.conversion_readiness +
    breakdown.seo_basics +
    breakdown.performance +
    breakdown.digital_presence
  );
}

/** One-click "log call outcome" row action on the Lead Research page — each maps to a fixed activities.notes string rather than free text, so working the list stays one click, not a form per call. */
export const CALL_OUTCOMES = ["connected", "voicemail", "no_answer", "not_interested", "booked_call"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  connected: "Connected",
  voicemail: "Left voicemail",
  no_answer: "No answer",
  not_interested: "Not interested",
  booked_call: "Booked a call",
};

// ============================================================= discovery form

export const researchRunParamsSchema = z.object({
  keyword: z.string().trim().min(1, "Enter a business type or keyword").max(200),
  city: z.string().trim().min(1, "City is required").max(120),
  region: optionalTextInput,
  country: z.string().trim().min(1, "Country is required").max(120),
  radius_km: numeric(z.number().positive().max(200)).default(25),
  min_reviews: optionalNumeric(z.number().int().min(0)),
  max_reviews: optionalNumeric(z.number().int().min(0)),
  must_have_website: z.enum(["any", "yes", "no"]).default("any"),
  max_results: numeric(z.number().int().min(1).max(25)).default(10),
  force_refresh: z.coerce.boolean().optional().default(false),
});
export type ResearchRunParams = z.infer<typeof researchRunParamsSchema>;

// ==================================================== saved (recurring) search

/**
 * A saved search's stored params never include force_refresh — a recurring
 * run should always rely on the normal 30-day cache window (isCached in
 * lib/db/queries/lead-research.ts), never force-recheck businesses it's
 * already qualified. The weekly scheduled function hardcodes
 * force_refresh: false when it dispatches a run from one of these,
 * regardless of what's stored, so this is dropped here rather than kept
 * and ignored.
 */
export const savedLeadSearchSchema = researchRunParamsSchema.omit({ force_refresh: true }).extend({
  label: z.string().trim().min(1, "Give this search a name").max(80),
});
export type SavedLeadSearchInput = z.infer<typeof savedLeadSearchSchema>;
