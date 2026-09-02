"use client";

import { useTransition } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { disconnectYouTubeAction } from "@/actions/youtube-upload-actions";
import { Button } from "@/components/ui/button";
import { TESTING_MODE_TOKEN_LIFETIME_DAYS } from "@/lib/youtube/constants";

interface Props {
  configured: boolean;
  connected: boolean;
  channelTitle: string | null;
  connectedAt: string | null;
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function YoutubeConnectionCard({ configured, connected, channelTitle, connectedAt }: Props) {
  const [isPending, startTransition] = useTransition();

  const age = connectedAt ? daysAgo(connectedAt) : null;
  // While the OAuth consent screen is unpublished ("Testing" status),
  // Google expires the refresh token after this many days regardless of
  // use — warn before it silently breaks rather than after.
  const nearingExpiry = age !== null && age >= TESTING_MODE_TOKEN_LIFETIME_DAYS - 2;
  const likelyExpired = age !== null && age > TESTING_MODE_TOKEN_LIFETIME_DAYS;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">YouTube Upload</p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {!configured ? (
          <>
            <XCircle className="h-4 w-4 text-danger" />
            <span>Not configured</span>
          </>
        ) : connected ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Connected{channelTitle ? ` — ${channelTitle}` : ""}</span>
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
          Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET (Google Cloud Console — OAuth client ID, Web application
          type), then connect below.
        </p>
      ) : connected ? (
        <>
          <p className="mt-1 font-mono text-xs text-muted-foreground">connected {age}d ago</p>
          {likelyExpired ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-danger">
              <AlertTriangle className="h-3.5 w-3.5" />
              Likely expired — Testing-mode refresh tokens last {TESTING_MODE_TOKEN_LIFETIME_DAYS} days. Reconnect below.
            </p>
          ) : nearingExpiry ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-warn">
              <AlertTriangle className="h-3.5 w-3.5" />
              Expires around day {TESTING_MODE_TOKEN_LIFETIME_DAYS} while the consent screen is in Testing mode — reconnect soon.
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => (window.location.href = "/api/youtube/oauth/connect")}>
              Reconnect
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => startTransition(() => disconnectYouTubeAction())}
              disabled={isPending}
            >
              {isPending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        </>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => (window.location.href = "/api/youtube/oauth/connect")}>
          Connect YouTube
        </Button>
      )}
    </div>
  );
}
