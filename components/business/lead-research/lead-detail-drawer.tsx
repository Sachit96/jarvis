"use client";

import { Phone, ExternalLink, MapPin, Star } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScoreBandBadge } from "@/components/business/lead-research/score-band-badge";
import { OPPORTUNITY_LABEL, SCORE_CATEGORY_MAX } from "@/lib/validations/lead-research";
import { parseAuditPayload, type LeadRowData } from "@/components/business/lead-research/types";

function signalRow(label: string, value: string | boolean) {
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : value || "—";
  return (
    <div key={label} className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono tabular-nums">{display}</span>
    </div>
  );
}

export function LeadDetailDrawer({ row, onClose }: { row: LeadRowData | null; onClose: () => void }) {
  if (!row) return null;
  const { lead, contact, deal } = row;
  const payload = parseAuditPayload(lead.audit);
  const audit = payload?.signals.audit;
  const pageSpeed = payload?.signals.pageSpeed;
  const opportunities = payload?.qualification.opportunities ?? [];
  const breakdown = lead.score_breakdown as Record<string, number> | null;

  const businessName = contact?.company_name || contact?.contact_person || "Unknown business";

  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[520px]">
        <SheetHeader>
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="min-w-0">
              <SheetTitle className="truncate">{businessName}</SheetTitle>
              {lead.city ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {[lead.city, lead.region, lead.country].filter(Boolean).join(", ")}
                </p>
              ) : null}
            </div>
            <ScoreBandBadge score={lead.score} className="shrink-0" />
          </div>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {lead.ai_summary ? (
            <div className="rounded-lg border border-brand/30 bg-brand/5 p-3">
              <p className="text-caption font-semibold uppercase tracking-wide text-brand">Read before dialing</p>
              <p className="mt-1 text-sm">{lead.ai_summary}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {contact?.phone ? (
              <a
                href={`tel:${contact.phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm font-medium text-success hover:bg-success/20"
              >
                <Phone className="h-3.5 w-3.5" /> {contact.phone}
              </a>
            ) : null}
            {lead.maps_url ? (
              <a
                href={lead.maps_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Maps
              </a>
            ) : null}
            {lead.rating ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-current" /> {lead.rating} ({lead.review_count ?? 0})
              </span>
            ) : null}
          </div>

          {opportunities.length > 0 ? (
            <div>
              <p className="text-label uppercase tracking-wide text-muted-foreground">Opportunities</p>
              <ul className="mt-1.5 space-y-2">
                {opportunities.map((o) => (
                  <li key={o.tag} className="rounded-lg border border-border bg-card p-2.5">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {OPPORTUNITY_LABEL[o.tag] ?? o.tag}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{o.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {breakdown ? (
            <div>
              <p className="text-label uppercase tracking-wide text-muted-foreground">Score breakdown</p>
              <div className="mt-1.5 space-y-1">
                {Object.entries(SCORE_CATEGORY_MAX).map(([key, max]) => (
                  <div key={key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="capitalize text-muted-foreground">{key.replace(/_/g, " ")}</span>
                    <span className="font-mono tabular-nums">
                      {breakdown[key] ?? 0}/{max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-label uppercase tracking-wide text-muted-foreground">Website audit</p>
            {!payload?.signals.hasWebsite ? (
              <p className="mt-1 text-xs text-muted-foreground">No website found — strongest possible opportunity signal.</p>
            ) : audit?.auditBlocked ? (
              <p className="mt-1 text-xs text-muted-foreground">Audit blocked: {audit.blockedReason ?? "unknown reason"}.</p>
            ) : audit ? (
              <div className="mt-1.5 space-y-1 rounded-lg border border-border bg-card p-2.5">
                {signalRow("HTTPS", audit.https)}
                {signalRow("Mobile viewport tag", audit.hasViewportMeta)}
                {signalRow("Title", audit.title ?? "missing")}
                {signalRow("Generic title", audit.hasGenericTitle)}
                {signalRow("tel: CTA", audit.ctas.tel)}
                {signalRow("Booking CTA", audit.ctas.bookingWords)}
                {signalRow("Booking system", audit.bookingSystems.join(", ") || "none detected")}
                {signalRow("Chat widget", audit.chatWidgets.join(", ") || "none detected")}
                {signalRow("Framework", audit.framework ?? "unknown/custom")}
                {signalRow("Images w/ alt text", `${audit.imagesWithAlt}/${audit.imageCount}`)}
                {signalRow("Social links", audit.hasSocialLinks)}
                {signalRow("Testimonials", audit.hasTestimonials)}
                {pageSpeed?.performanceScore != null ? signalRow("PageSpeed (mobile)", `${pageSpeed.performanceScore}/100`) : null}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">No audit data recorded for this lead yet.</p>
            )}
          </div>

          <div className="border-t border-border pt-3 text-caption text-muted-foreground">
            <p>Researched {new Date(lead.researched_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
            {deal ? <p className="mt-0.5">Deal value: ${Number(deal.value).toLocaleString()}</p> : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
