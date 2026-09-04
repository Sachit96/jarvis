"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getYtConnection } from "@/lib/db/queries/youtube";
import { initiateResumableSession, setVideoPublic } from "@/lib/youtube/upload";

export async function disconnectYouTubeAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.from("yt_connections").delete().eq("id", true);
  revalidatePath("/settings");
}

export interface InitiateUploadResult {
  ok: boolean;
  error?: string;
  sessionUri?: string;
  accessToken?: string;
}

/**
 * Step 1 only — hands the browser a resumable session URI + a short-lived
 * access token, then gets out of the way. The video bytes themselves never
 * reach this server: the browser PUTs them directly to sessionUri (see
 * components/youtube/upload-to-youtube.tsx). This is the actual fix for
 * the old uploadVideoToYouTubeAction, which routed the full multipart body
 * (metadata + video bytes, one request) through this Server Action —
 * Netlify's real function body ceiling is ~6MB (confirmed against
 * Netlify's own docs, not assumed), regardless of the 100MB Next.js
 * bodySizeLimit config, so anything past a few MB would 413 before ever
 * reaching YouTube. This request is metadata-only (title/description/file
 * size/mime type as JSON, no bytes) — comfortably small regardless of how
 * large the actual video is.
 */
export async function initiateUploadAction(scriptId: string, title: string, description: string, fileSizeBytes: number, mimeType: string): Promise<InitiateUploadResult> {
  if (!scriptId || !title) return { ok: false, error: "Missing script or title" };

  const supabase = await createClient();
  const connection = await getYtConnection(supabase);
  if (!connection) return { ok: false, error: "YouTube isn't connected — connect it in Settings first." };

  try {
    const session = await initiateResumableSession(connection, { title, description, fileSizeBytes, mimeType });
    return { ok: true, sessionUri: session.sessionUri, accessToken: session.accessToken };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't start the upload" };
  }
}

/**
 * Step 2's follow-up — called by the browser after it PUTs the video bytes
 * directly to YouTube and gets a real video id back. This is just a DB
 * write (no bytes, no external call), recording what the browser already
 * confirmed happened.
 */
export async function recordUploadedVideoAction(scriptId: string, videoId: string): Promise<{ ok: boolean; error?: string }> {
  if (!scriptId || !videoId) return { ok: false, error: "Missing script or video id" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("yt_scripts")
    .update({ youtube_video_id: videoId, youtube_privacy_status: "private", status: "used" })
    .eq("id", scriptId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/youtube");
  return { ok: true };
}

/**
 * The ONLY UI action that can make a video public. No video ever goes
 * public as a side effect of upload, a cron job, or any other automated
 * path — this is a deliberate, explicit click every time.
 */
export async function approveToPublishAction(scriptId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: script, error: fetchError } = await supabase.from("yt_scripts").select("youtube_video_id").eq("id", scriptId).maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!script?.youtube_video_id) return { ok: false, error: "This script hasn't been uploaded to YouTube yet" };

  const connection = await getYtConnection(supabase);
  if (!connection) return { ok: false, error: "YouTube isn't connected — connect it in Settings first." };

  try {
    await setVideoPublic(connection, script.youtube_video_id);
    await supabase.from("yt_scripts").update({ youtube_privacy_status: "public" }).eq("id", scriptId);
    revalidatePath("/youtube");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Publish failed" };
  }
}
