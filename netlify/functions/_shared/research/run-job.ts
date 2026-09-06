import { createAdminClient } from "../admin-client";
import { searchPlaces } from "./places";
import { auditWebsite } from "./audit";
import { getPageSpeed } from "./pagespeed";
import { getLeadQualifier } from "./providers";
import { LEAD_QUALIFIER_BATCH_SIZE } from "./gemini-lead-qualifier";
import {
  getLeadResearchByPlaceId,
  getResearchRunStatus,
  isCached,
  updateResearchRun,
} from "../../../../lib/db/queries/lead-research";
import { getPipelineStages } from "../../../../lib/db/queries/business";
import { computeScore, type ResearchRunParams } from "../../../../lib/validations/lead-research";
import type { LeadSignals, PlaceResult } from "../../../../lib/research/types";
import type { Database } from "../../../../lib/supabase/database.types";

// Deliberate duplicate of lib/research/run-job.ts — see
// _shared/admin-client.ts's comment for the full mechanism (that file's
// own `import "server-only"` crashes at module load under Netlify's
// function bundler, and this file's original opened with the same guard
// itself). Only the guard line and import paths differ: createAdminClient
// and every guarded dependency (places/audit/pagespeed/providers/
// gemini-lead-qualifier) come from the sibling _shared/research/*.ts
// duplicates; lib/db/queries/*, lib/validations/lead-research.ts, and
// lib/research/types.ts carry no such guard (only `import type` "@/..."
// references or plain SupabaseClient-parameter helpers), so they're
// imported directly from the real files rather than duplicated. The
// orchestration logic below is unchanged.
const AUDIT_CONCURRENCY = 3;

interface PendingItem {
  place: PlaceResult;
  existingContactId: string | undefined;
  existingDealId: string | null;
  signals: LeadSignals;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export async function runResearchJob(runId: string, params: ResearchRunParams): Promise<void> {
  const supabase = createAdminClient();
  const errorLog: { url?: string; place?: string; reason: string }[] = [];

  await updateResearchRun(supabase, runId, { status: "running", started_at: new Date().toISOString() });

  let places: PlaceResult[];
  try {
    places = await searchPlaces(params);
  } catch (err) {
    await updateResearchRun(supabase, runId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      error_log: [{ reason: err instanceof Error ? err.message : "Discovery (Places) failed" }],
    });
    return;
  }

  await updateResearchRun(supabase, runId, { found_count: places.length });

  const stages = await getPipelineStages(supabase);
  const firstStage = [...stages].sort((a, b) => a.sort_order - b.sort_order)[0];
  if (!firstStage) {
    await updateResearchRun(supabase, runId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      error_log: [{ reason: "No pipeline stages exist — create at least one in Business > Pipeline first" }],
    });
    return;
  }

  let skippedCachedCount = 0;
  let failedCount = 0;
  const pending: PendingItem[] = [];

  async function logFailure(place: PlaceResult, reason: string) {
    failedCount++;
    errorLog.push({ url: place.websiteUri ?? undefined, place: place.displayName, reason });
    await updateResearchRun(supabase, runId, {
      failed_count: failedCount,
      error_log: errorLog as unknown as Database["public"]["Tables"]["research_runs"]["Update"]["error_log"],
    });
  }

  // ---------------------------------------------------------- Phase 2: audit
  async function auditOne(place: PlaceResult) {
    await updateResearchRun(supabase, runId, { current_label: place.displayName });
    try {
      const existing = await getLeadResearchByPlaceId(supabase, place.placeId);
      if (existing && isCached(existing, params.force_refresh)) {
        skippedCachedCount++;
        await updateResearchRun(supabase, runId, { skipped_cached_count: skippedCachedCount });
        return;
      }

      const hasWebsite = !!place.websiteUri;
      const audit = hasWebsite ? await auditWebsite(place.websiteUri!) : null;
      const pageSpeed = hasWebsite && audit && !audit.auditBlocked ? await getPageSpeed(place.websiteUri!) : null;

      pending.push({
        place,
        existingContactId: existing?.contact_id,
        existingDealId: existing?.deal_id ?? null,
        signals: { place, hasWebsite, audit, pageSpeed },
      });
    } catch (err) {
      await logFailure(place, err instanceof Error ? err.message : "Audit failed");
    }
  }

  let auditCursor = 0;
  async function auditWorker() {
    while (auditCursor < places.length) {
      const status = await getResearchRunStatus(supabase, runId);
      if (status === "cancelled") return;
      const place = places[auditCursor++];
      await auditOne(place);
    }
  }
  await Promise.all(Array.from({ length: Math.min(AUDIT_CONCURRENCY, places.length) }, auditWorker));

  // ----------------------------------------------------- Phase 3: qualify
  let auditedCount = 0;
  let insertedCount = 0;
  const batches = chunk(pending, LEAD_QUALIFIER_BATCH_SIZE);

  for (const batch of batches) {
    if ((await getResearchRunStatus(supabase, runId)) === "cancelled") break;

    await updateResearchRun(supabase, runId, { current_label: `Qualifying ${batch.length} businesses…` });
    const qualifier = await getLeadQualifier();
    const outcomes = await qualifier.qualifyLeads(batch.map((item) => item.signals));

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const outcome = outcomes[i];

      const qualification = outcome?.result;
      if (!qualification) {
        await logFailure(item.place, outcome?.error ?? "No qualification outcome returned");
        continue;
      }

      auditedCount++;
      await updateResearchRun(supabase, runId, { audited_count: auditedCount });

      try {
        const { place, signals } = item;
        const score = computeScore(qualification.score_breakdown);
        const opportunityTags = qualification.opportunities.map((o) => o.tag);

        let contactId = item.existingContactId;
        let dealId = item.existingDealId;

        if (!contactId) {
          const { data: contact, error: contactError } = await supabase
            .from("contacts")
            .insert({
              company_name: place.displayName,
              contact_person: place.displayName,
              email: signals.audit?.extractedEmail ?? null,
              phone: place.nationalPhoneNumber,
              source: "research_agent",
            })
            .select()
            .single();
          if (contactError) throw new Error(`contact insert: ${contactError.message}`);
          contactId = contact.id;

          const { data: deal, error: dealError } = await supabase
            .from("deals")
            .insert({
              contact_id: contactId,
              stage_id: firstStage.id,
              title: place.displayName,
              source: "research_agent",
            })
            .select()
            .single();
          if (dealError) {
            await supabase.from("contacts").delete().eq("id", contactId);
            throw new Error(`deal insert: ${dealError.message}`);
          }
          dealId = deal.id;
        }

        const { error: upsertError } = await supabase.from("lead_research").upsert(
          {
            contact_id: contactId,
            deal_id: dealId,
            google_place_id: place.placeId,
            maps_url: place.googleMapsUri,
            city: params.city,
            region: params.region ?? null,
            country: params.country,
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
        if (upsertError) throw new Error(`lead_research upsert: ${upsertError.message}`);

        insertedCount++;
        await updateResearchRun(supabase, runId, { inserted_count: insertedCount });
      } catch (err) {
        await logFailure(item.place, err instanceof Error ? err.message : "Unknown error");
      }
    }
  }

  const finalStatus = (await getResearchRunStatus(supabase, runId)) === "cancelled" ? "cancelled" : "done";
  await updateResearchRun(supabase, runId, { status: finalStatus, finished_at: new Date().toISOString(), current_label: null });
}
