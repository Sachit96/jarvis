"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Trash2, Search, BrainCircuit } from "lucide-react";
import { setScriptStatusAction, deleteScriptAction } from "@/actions/youtube-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { YT_STATUSES } from "@/lib/validations/youtube";
import { UploadToYoutube } from "@/components/youtube/upload-to-youtube";
import type { Database } from "@/lib/supabase/database.types";

type Script = Database["public"]["Tables"]["yt_scripts"]["Row"];

export function ScriptCard({ script, youtubeConnected }: { script: Script; youtubeConnected: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();
  const sections = (script.sections as { label: string; startSec: number; content: string }[] | null) ?? [];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-heading font-semibold text-foreground">{script.suggested_titles[0] ?? script.topic}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-caption text-muted-foreground">
            {script.niche ? `${script.niche} · ` : ""}
            {script.estimated_runtime_sec ? `~${Math.round(script.estimated_runtime_sec / 60)}min` : ""}
            {script.research_grounded ? (
              <span className="flex items-center gap-1 text-success"><Search className="h-3 w-3" /> web-grounded</span>
            ) : (
              <span className="flex items-center gap-1"><BrainCircuit className="h-3 w-3" /> AI-reasoned, not web-searched</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select value={script.status} onValueChange={(v) => v && startTransition(() => setScriptStatusAction(script.id, v))}>
            <SelectTrigger className="h-7 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YT_STATUSES.map((s) => (
                <SelectItem key={s} value={s} label={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button onClick={() => startTransition(() => deleteScriptAction(script.id))} className="relative after:absolute after:-inset-3.5 text-muted-foreground/60 hover:text-danger" aria-label="Delete script">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setExpanded((e) => !e)} className="relative after:absolute after:-inset-3.5 text-muted-foreground hover:text-foreground" aria-label="Toggle details">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div>
            <p className="text-caption uppercase tracking-wide text-muted-foreground">Research summary</p>
            <p className="mt-1 text-sm text-muted-foreground">{script.research_summary}</p>
          </div>
          <div>
            <p className="text-caption uppercase tracking-wide text-muted-foreground">Hook</p>
            <p className="mt-1 text-sm font-medium text-foreground">{script.hook}</p>
          </div>
          <div>
            <p className="text-caption uppercase tracking-wide text-muted-foreground">Sections</p>
            <ul className="mt-1 space-y-1.5">
              {sections.map((s, i) => (
                <li key={i} className="text-sm">
                  <span className="font-mono text-caption text-muted-foreground">{Math.floor(s.startSec / 60)}:{String(s.startSec % 60).padStart(2, "0")}</span>{" "}
                  <span className="font-medium text-foreground">{s.label}</span>
                  <p className="text-caption text-muted-foreground">{s.content}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-caption uppercase tracking-wide text-muted-foreground">Full script</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{script.script_body}</p>
          </div>
          <div>
            <p className="text-caption uppercase tracking-wide text-muted-foreground">Titles</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {script.suggested_titles.map((t, i) => (
                <Badge key={i} variant={i === 0 ? "default" : "outline"}>{t}</Badge>
              ))}
            </div>
          </div>

          <UploadToYoutube
            scriptId={script.id}
            title={script.suggested_titles[0] ?? script.topic}
            description={script.script_body ?? ""}
            youtubeVideoId={script.youtube_video_id}
            privacyStatus={script.youtube_privacy_status}
            connected={youtubeConnected}
          />
        </div>
      ) : null}
    </Card>
  );
}
