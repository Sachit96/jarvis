import type { Database } from "@/lib/supabase/database.types";
import type { LeadSignals } from "@/lib/research/types";
import type { QualificationResult } from "@/lib/validations/lead-research";

export type LeadResearchRow = Database["public"]["Tables"]["lead_research"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type DealRow = Database["public"]["Tables"]["deals"]["Row"];
export type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];

/** Built server-side in the Lead Research page (same "fetch flat, join by id in a Map" pattern as PipelinePage) — see the comment on lib/db/queries/lead-research.ts's getResearchLeads for why there's no nested Supabase embed instead. */
export interface LeadRowData {
  lead: LeadResearchRow;
  contact: ContactRow | undefined;
  deal: DealRow | undefined;
}

/** The shape lib/research/run-job.ts and refresh-single-lead.ts actually write into lead_research.audit (Json in the generated types) — cast at the read boundary rather than threading `Json` through every consumer. */
export interface LeadAuditPayload {
  signals: LeadSignals;
  qualification: QualificationResult;
}

export function parseAuditPayload(audit: LeadResearchRow["audit"]): LeadAuditPayload | null {
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) return null;
  const record = audit as Record<string, unknown>;
  if (!record.signals || !record.qualification) return null;
  return audit as unknown as LeadAuditPayload;
}
