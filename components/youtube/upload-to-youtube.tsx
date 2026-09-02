"use client";

import { useState, useTransition } from "react";
import { Upload, Globe, Lock } from "lucide-react";
import { uploadVideoToYouTubeAction, approveToPublishAction } from "@/actions/youtube-upload-actions";
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

export function UploadToYoutube({ scriptId, title, description, youtubeVideoId, privacyStatus, connected }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUpload() {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("script_id", scriptId);
    formData.set("title", title);
    formData.set("description", description);
    formData.set("video", file);
    startTransition(async () => {
      const res = await uploadVideoToYouTubeAction(formData);
      if (!res.ok) setError(res.error ?? "Upload failed");
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
        <div className="mt-2 flex items-center gap-2">
          <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-8 text-xs" />
          <Button size="sm" className="gap-1.5 shrink-0" onClick={handleUpload} disabled={isPending || !file}>
            <Upload className="h-3.5 w-3.5" /> {isPending ? "Uploading…" : "Upload (private)"}
          </Button>
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
