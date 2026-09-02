"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getYtConnection } from "@/lib/db/queries/youtube";
import { uploadVideo, setVideoPublic } from "@/lib/youtube/upload";

export async function disconnectYouTubeAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.from("yt_connections").delete().eq("id", true);
  revalidatePath("/settings");
}

export interface UploadVideoResult {
  ok: boolean;
  error?: string;
  videoId?: string;
}

/**
 * The videos.insert call path. Always uploads as privacyStatus: "private"
 * (enforced in lib/youtube/upload.ts, not a parameter here) — going
 * public is exclusively approveToPublishAction's job below.
 */
export async function uploadVideoToYouTubeAction(formData: FormData): Promise<UploadVideoResult> {
  const scriptId = String(formData.get("script_id") ?? "");
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const file = formData.get("video");

  if (!scriptId || !title) return { ok: false, error: "Missing script or title" };
  if (!(file instanceof File)) return { ok: false, error: "No video file provided" };

  const supabase = await createClient();
  const connection = await getYtConnection(supabase);
  if (!connection) return { ok: false, error: "YouTube isn't connected — connect it in Settings first." };

  try {
    const videoBytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadVideo(connection, { title, description, videoBytes, mimeType: file.type || "video/mp4" });

    const { error } = await supabase
      .from("yt_scripts")
      .update({ youtube_video_id: result.videoId, youtube_privacy_status: "private", status: "used" })
      .eq("id", scriptId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/youtube");
    return { ok: true, videoId: result.videoId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed" };
  }
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
