"use client";

import { useMemo, useState } from "react";
import { Phone, Download, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ScoreBandBadge } from "@/components/business/lead-research/score-band-badge";
import { LeadRowActions } from "@/components/business/lead-research/lead-row-actions";
import { LeadDetailDrawer } from "@/components/business/lead-research/lead-detail-drawer";
import { SCORE_BANDS, SCORE_BAND_LABEL, OPPORTUNITY_TAGS, OPPORTUNITY_LABEL, scoreBand, type OpportunityTag } from "@/lib/validations/lead-research";
import type { LeadRowData, PipelineStageRow } from "@/components/business/lead-research/types";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(rows: LeadRowData[]) {
  const header = ["business", "phone", "score", "band", "city", "opportunities", "ai_summary", "stage", "maps_url"];
  const lines = rows.map((r) => {
    const { lead, contact, deal } = r;
    return [
      contact?.company_name || contact?.contact_person || "",
      contact?.phone || "",
      String(lead.score),
      scoreBand(lead.score),
      lead.city || "",
      lead.opportunities.map((t) => OPPORTUNITY_LABEL[t as OpportunityTag] ?? t).join("; "),
      lead.ai_summary || "",
      deal?.title || "",
      lead.maps_url || "",
    ]
      .map(csvEscape)
      .join(",");
  });
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lead-call-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function LeadResearchBoard({ rows, stages }: { rows: LeadRowData[]; stages: PipelineStageRow[] }) {
  const [band, setBand] = useState<"all" | (typeof SCORE_BANDS)[number]>("all");
  const [opportunity, setOpportunity] = useState<"all" | OpportunityTag>("all");
  const [city, setCity] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.lead.city) set.add(r.lead.city);
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (band !== "all" && scoreBand(r.lead.score) !== band) return false;
      if (opportunity !== "all" && !r.lead.opportunities.includes(opportunity)) return false;
      if (city !== "all" && r.lead.city !== city) return false;
      return true;
    });
  }, [rows, band, opportunity, city]);

  const openRow = openId ? (filtered.find((r) => r.lead.id === openId) ?? rows.find((r) => r.lead.id === openId) ?? null) : null;

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-card ring-1 ring-border">
        <EmptyState
          icon={Search}
          title="No leads yet"
          description="Start a research run above — Discovery, website audit, and AI qualification happen automatically, and results land here sorted by score."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1">
          <button
            onClick={() => setBand("all")}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium", band === "all" ? "bg-brand/20 text-brand" : "text-muted-foreground hover:text-foreground")}
          >
            All ({rows.length})
          </button>
          {SCORE_BANDS.map((b) => {
            const count = rows.filter((r) => scoreBand(r.lead.score) === b).length;
            return (
              <button
                key={b}
                onClick={() => setBand(b)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium", band === b ? "bg-brand/20 text-brand" : "text-muted-foreground hover:text-foreground")}
              >
                {SCORE_BAND_LABEL[b]} ({count})
              </button>
            );
          })}
        </div>

        <Select value={opportunity} onValueChange={(v) => v && setOpportunity(v as typeof opportunity)}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Opportunity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="All opportunities">All opportunities</SelectItem>
            {OPPORTUNITY_TAGS.map((tag) => (
              <SelectItem key={tag} value={tag} label={OPPORTUNITY_LABEL[tag]}>
                {OPPORTUNITY_LABEL[tag]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={city} onValueChange={(v) => v && setCity(v)}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="All cities">All cities</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c} label={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => downloadCsv(filtered)}>
          <Download className="h-3.5 w-3.5" /> Export call sheet ({filtered.length})
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing matches this filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-caption uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Business</th>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">Opportunities</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const { lead, contact, deal } = row;
                const stage = deal ? stages.find((s) => s.id === deal.stage_id) : undefined;
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setOpenId(lead.id)}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2">
                      <ScoreBandBadge score={lead.score} />
                    </td>
                    <td className="max-w-[220px] px-3 py-2">
                      <p className="truncate font-medium">{contact?.company_name || contact?.contact_person || "Unknown"}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{lead.city ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {lead.opportunities.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            {OPPORTUNITY_LABEL[tag as OpportunityTag] ?? tag}
                          </Badge>
                        ))}
                        {lead.opportunities.length > 2 ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            +{lead.opportunities.length - 2}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{stage?.name ?? "—"}</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {contact?.phone ? (
                        <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 text-xs text-success hover:underline">
                          <Phone className="h-3 w-3" /> {contact.phone}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                      <LeadRowActions row={row} stages={stages} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <LeadDetailDrawer row={openRow} onClose={() => setOpenId(null)} />
    </div>
  );
}
