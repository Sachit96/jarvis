"use client";

import { useState, useTransition } from "react";
import { Upload, Globe, Lock } from "lucide-react";
import { initiateUploadAction, recordUploadedVideoAction, approveToPublishAction } from "@/actions/youtube-upload-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  scriptId: string;
  title: string;
  description: string;
  youtubeVideoId: string | null;
  privacyStatus: string | null;
  connected: boolean;
}

/**
 * PUTs the file directly to YouTube's resumable session URI — this is the
 * one place in the whole flow that touches the video bytes, and it never
 * goes through this app's own server (see initiateUploadAction's comment
 * for why). XMLHttpRequest, not fetch, specifically for upload.onprogress
 * — fetch has no upload-progress event, and a multi-minute video upload
 * with no progress indicator reads as hung.
 *
 * accessToken came from a Server Action a few seconds ago and is used
 * exactly once, right here, for this one request — never logged, never
 * stored (not even in component state beyond the single call), and never
 * sent anywhere but googleapis.com.
 */
function putVideoBytes(sessionUri: string, accessToken: string, file: File, onProgress: (pct: number) => void): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sessionUri, true);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (!data.id) throw new Error("no id in response");
          resolve({ id: data.id });
        } catch {
          reject(new Error("YouTube accepted the upload but didn't return a video id"));
        }
      } else {
        reject(new Error(`YouTube upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload — check your connection and try again"));
    xhr.send(file);
  });
}

export function UploadToYoutube({ scriptId, title, description, youtubeVideoId, privacyStatus, connected }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  function handleUpload() {
    if (!file) return;
    setError(null);
    setProgress(0);
    startTransition(async () => {
      const init = await initiateUploadAction(scriptId, title, description, file.size, file.type || "video/mp4");
      if (!init.ok || !init.sessionUri || !init.accessToken) {
        setError(init.error ?? "Couldn't start the upload");
        setProgress(null);
        return;
      }
      try {
        const { id: videoId } = await putVideoBytes(init.sessionUri, init.accessToken, file, setProgress);
        const recorded = await recordUploadedVideoAction(scriptId, videoId);
        if (!recorded.ok) setError(recorded.error ?? "Uploaded, but failed to save — the video is on YouTube as private; refresh to pick it up.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setProgress(null);
      }
    });
  }

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const res = await approveToPublishAction(scriptId);
      if (!res.ok) setError(res.error ?? "Publish failed");
    });
  }

  if (!connected) return null;

  return (
    <div className="border-t border-border pt-4">
      <p className="text-caption uppercase tracking-wide text-muted-foreground">YouTube</p>
      {error ? <p className="mt-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}

      {!youtubeVideoId ? (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-8 text-xs" disabled={isPending} />
            <Button size="sm" className="gap-1.5 shrink-0" onClick={handleUpload} disabled={isPending || !file}>
              <Upload className="h-3.5 w-3.5" /> {progress != null ? `${progress}%` : "Upload (private)"}
            </Button>
          </div>
          {progress != null ? (
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
            </div>
          ) : null}
        </div>
      ) : privacyStatus === "public" ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-success">
          <Globe className="h-3.5 w-3.5" /> Public — youtu.be/{youtubeVideoId}
        </p>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Uploaded, private — youtu.be/{youtubeVideoId}
          </p>
          <Button size="sm" variant="secondary" className="gap-1.5 shrink-0" onClick={handleApprove} disabled={isPending}>
            <Globe className="h-3.5 w-3.5" /> {isPending ? "Publishing…" : "Approve to publish"}
          </Button>
        </div>
      )}
    </div>
  );
}
