"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { disconnectGoogleCalendarAction, syncGoogleCalendarNowAction } from "@/actions/google-calendar-actions";
import { Button } from "@/components/ui/button";

interface Props {
  configured: boolean;
  connected: boolean;
  calendarSummary: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Push-sync only, for now — connecting creates a dedicated "JARVIS"
 * calendar and "Sync now" writes the standing routine, class times,
 * deadlines and dated assessments into it as one event each (recurring
 * weekly events for the routine/classes, single events for dated items).
 * Pulling changes made directly in Google back into JARVIS is the next
 * increment; this card doesn't claim that yet.
 */
export function GoogleCalendarConnectionCard({ configured, connected, calendarSummary, connectedAt, lastSyncedAt }: Props) {
  const [isDisconnecting, startDisconnect] = useTransition();
  const [isSyncing, startSync] = useTransition();

  const age = connectedAt ? daysAgo(connectedAt) : null;

  function handleSync() {
    startSync(async () => {
      try {
        const result = await syncGoogleCalendarNowAction();
        if (result.failed > 0) {
          toast.warning(`Synced with ${result.failed} failure(s) — pushed ${result.pushed}, removed ${result.removed}`);
        } else {
          toast.success(`Synced — pushed ${result.pushed}, removed ${result.removed}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sync failed");
      }
    });
  }

  return (
    <div className="surface p-4">
      <p className="eyebrow">Google Calendar</p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {!configured ? (
          <>
            <XCircle className="h-4 w-4 text-danger" />
            <span>Not configured</span>
          </>
        ) : connected ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Connected{calendarSummary ? ` — ${calendarSummary} calendar` : ""}</span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span>Not connected</span>
          </>
        )}
      </div>

      {!configured ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET (Google Cloud Console — a separate OAuth
          client from YouTube&apos;s, Web application type), then connect below.
        </p>
      ) : connected ? (
        <>
          <p className="mt-1 tabular text-xs text-muted-foreground">
            connected {age}d ago · last synced {lastSyncedAt ? timeAgo(lastSyncedAt) : "never"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" onClick={handleSync} disabled={isSyncing}>
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing…" : "Sync now"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => (window.location.href = "/api/google-calendar/oauth/connect")}>
              Reconnect
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => startDisconnect(() => disconnectGoogleCalendarAction())}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        </>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => (window.location.href = "/api/google-calendar/oauth/connect")}>
          Connect Google Calendar
        </Button>
      )}
    </div>
  );
}
