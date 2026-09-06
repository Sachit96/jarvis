import { CheckCircle2, CircleDashed, CircleOff, PenLine, XCircle, type LucideIcon } from "lucide-react";

/**
 * One shared vocabulary for "why does this number/section look like this,"
 * used both standalone (Settings integration cards) and inline (a StatTile's
 * qualifying note). Found live (2026-09-06 audit): a bare "$0" or "0/100"
 * reads as a real measurement whether the truth behind it is "nothing set
 * up yet," "the field is genuinely blank," or "the integration died" — each
 * needs a different next action, so each gets its own label rather than
 * being flattened into one generic "no data" state.
 */
export type DataState = "connected" | "stale" | "disconnected" | "needs-setup" | "manual";

export const DATA_STATE_META: Record<DataState, { label: string; icon: LucideIcon; className: string }> = {
  connected: { label: "Connected", icon: CheckCircle2, className: "text-success" },
  stale: { label: "Stale", icon: CircleDashed, className: "text-warn" },
  disconnected: { label: "Disconnected", icon: XCircle, className: "text-danger" },
  "needs-setup": { label: "Needs setup", icon: CircleOff, className: "text-muted-foreground" },
  manual: { label: "Not filled in", icon: PenLine, className: "text-muted-foreground" },
};
