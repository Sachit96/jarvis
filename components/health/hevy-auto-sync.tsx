"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncHevyAction } from "@/actions/hevy-actions";

const THROTTLE_KEY = "hevy-last-auto-sync";
const THROTTLE_MS = 5 * 60 * 1000;

/**
 * Triggers a Hevy sync in the background after the page has already
 * rendered, instead of the page's own data fetch awaiting it — the sync
 * itself takes several real seconds (an external API call plus a handful of
 * upserts), and none of that should sit between the user and their existing
 * data. Renders nothing; refreshes the page's server data once the sync
 * completes so newly-synced workouts show up without a manual reload.
 * Throttled per browser session so navigating between pages doesn't refire
 * it constantly.
 */
export function HevyAutoSync() {
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const last = Number(sessionStorage.getItem(THROTTLE_KEY) ?? 0);
    if (Date.now() - last < THROTTLE_MS) return;

    syncHevyAction()
      .then((result) => {
        sessionStorage.setItem(THROTTLE_KEY, String(Date.now()));
        if (result.ok) router.refresh();
      })
      .catch(() => {
        // Best-effort — a Hevy outage should never surface to the user here.
      });
  }, [router]);

  return null;
}
