import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlaceDetails } from "@/lib/research/places";
import { auditWebsite } from "@/lib/research/audit";
import { getPageSpeed } from "@/lib/research/pagespeed";
import { getLeadQualifier } from "@/lib/ai/providers";
import { getLeadResearchById } from "@/lib/db/queries/lead-research";
import { computeScore } from "@/lib/validations/lead-research";
import type { LeadSignals } from "@/lib/research/types";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The Lead Research page's per-lead "force refresh" row action — re-runs
 * Stage 2 (audit) + Stage 3 (qualify) for ONE already-known business,
 * bypassing Stage 1 (Discovery) entirely since the place_id is already on
 * the lead_research row. Distinct from a full search re-run
 * (lib/research/run-job.ts), which always starts from Places Text Search
 * and can't target one specific business by id.
 *
 * Sequential and single-item on purpose — this runs inline in a Server
 * Action triggered by a click, not a background job, so it should return
 * in a few seconds, not enqueue anything.
 */
export async function refreshSingleLead(leadResearchId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();

  const existing = await getLeadResearchById(supabase, leadResearchId);
  if (!existing) return { ok: false, error: "Lead not found" };

  try {
    const place = await getPlaceDetails(existing.google_place_id);
    const hasWebsite = !!place.websiteUri;
    const audit = hasWebsite ? await auditWebsite(place.websiteUri!) : null;
    const pageSpeed = hasWebsite && audit && !audit.auditBlocked ? await getPageSpeed(place.websiteUri!) : null;
    const signals: LeadSignals = { place, hasWebsite, audit, pageSpeed };

    const qualifier = await getLeadQualifier();
    const [outcome] = await qualifier.qualifyLeads([signals]);
    const qualification = outcome?.result;
    if (!qualification) return { ok: false, error: outcome?.error ?? "Qualification returned no result" };

    const score = computeScore(qualification.score_breakdown);
    const opportunityTags = qualification.opportunities.map((o) => o.tag);

    // Refresh the contact's phone/email too — Place Details can surface a
    // number the original run missed, and a website audit can find an
    // email the first pass didn't. Best-effort: never fails the refresh.
    await supabase
      .from("contacts")
      .update({
        phone: place.nationalPhoneNumber ?? undefined,
        email: audit?.extractedEmail ?? undefined,
      })
      .eq("id", existing.contact_id);

    const { error: upsertError } = await supabase.from("lead_research").upsert(
      {
        contact_id: existing.contact_id,
        deal_id: existing.deal_id,
        google_place_id: place.placeId,
        maps_url: place.googleMapsUri,
        city: existing.city,
        region: existing.region,
        country: existing.country,
        rating: place.rating,
        review_count: place.userRatingCount,
        audit: { signals, qualification } as unknown as Database["public"]["Tables"]["lead_research"]["Insert"]["audit"],
        score,
        score_breakdown: qualification.score_breakdown as unknown as Database["public"]["Tables"]["lead_research"]["Insert"]["score_breakdown"],
        opportunities: opportunityTags,
        ai_summary: qualification.ai_summary,
        researched_at: new Date().toISOString(),
      },
      { onConflict: "google_place_id" },
    );
    if (upsertError) return { ok: false, error: upsertError.message };

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Refresh failed" };
  }
}
