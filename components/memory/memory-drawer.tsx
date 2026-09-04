"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fieldAria, type ActionState } from "@/lib/validation";
import { updateMemoryEntryAction, deleteMemoryEntryAction, getMemoryEntryBacklinksAction } from "@/actions/memory-actions";
import { Backlinks } from "@/components/shared/backlinks";
import type { Backlink } from "@/lib/obsidian/wikilinks";
import { MEMORY_TYPES, MEMORY_TYPE_LABEL, type MemoryType } from "@/lib/validations/memory";
import { MemoryTypeBadge } from "@/components/memory/memory-type-badge";
import { MarkdownBody } from "@/components/memory/markdown-body";
import type { MemoryEntry } from "@/lib/db/queries/memory";

const initialState: ActionState = {};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function MemoryDrawer({
  entry,
  onClose,
}: {
  entry: MemoryEntry | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [state, formAction, isPending] = useActionState(updateMemoryEntryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      setMode("view");
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  useEffect(() => {
    if (!entry) {
      const id = setTimeout(() => setBacklinks([]), 0);
      return () => clearTimeout(id);
    }
    let cancelled = false;
    getMemoryEntryBacklinksAction(entry.id).then((result) => {
      if (!cancelled) setBacklinks(result);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  if (!entry) return null;

  function handleDelete() {
    startDelete(async () => {
      await deleteMemoryEntryAction(entry!.id);
      onClose();
    });
  }

  return (
    <Sheet open={Boolean(entry)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-[480px]">
        <SheetHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div className="min-w-0 flex-1">
            <MemoryTypeBadge type={entry.type as MemoryType} className="mb-1.5" />
            <SheetTitle className="truncate">{entry.title}</SheetTitle>
          </div>
          {mode === "view" ? (
            <div className="flex shrink-0 items-center gap-1 pr-8">
              <button
                onClick={() => setMode("edit")}
                aria-label="Edit"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setConfirmingDelete(true)}
                aria-label="Delete"
                className="relative after:absolute after:-inset-3.5 rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {confirmingDelete ? (
            <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3">
              <p className="text-sm font-medium text-danger">Delete this memory?</p>
              <p className="mt-1 text-caption text-danger/80">
                JARVIS will stop using this in mentor briefs and search — this can&apos;t be undone.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="destructive" disabled={isDeleting} onClick={handleDelete}>
                  {isDeleting ? "Deleting…" : "Delete"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {mode === "view" ? (
            <div className="space-y-4">
              <MarkdownBody body={entry.body} />

              {entry.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {entry.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="space-y-1 border-t border-border pt-3 text-caption text-muted-foreground">
                <p>Source: {entry.source === "captured" ? "Auto-captured" : "Manual"}</p>
                {entry.confidence !== null ? <p>Confidence: {entry.confidence}%</p> : null}
                {entry.expires_at ? <p>Expires: {entry.expires_at}</p> : null}
                <p>Created {formatDate(entry.created_at)}</p>
                <p>Updated {formatDate(entry.updated_at)}</p>
              </div>

              <Backlinks backlinks={backlinks} />

              <div className="border-t border-border pt-3">
                <p className="text-label uppercase tracking-wide text-muted-foreground">Referenced by</p>
                <p className="mt-1 text-body text-muted-foreground">
                  Not tracked yet — JARVIS doesn&apos;t currently record which mentor briefs or pages pull from
                  each memory. This is next to instrument.
                </p>
              </div>
            </div>
          ) : (
            <form ref={formRef} action={formAction} className="space-y-3">
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="source" value={entry.source} />
              <div>
                <Select name="type" defaultValue={entry.type}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMORY_TYPES.map((t) => (
                      <SelectItem key={t} value={t} label={MEMORY_TYPE_LABEL[t]}>
                        {MEMORY_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input name="title" defaultValue={entry.title} required {...fieldAria(state, "title")} />
                <FieldError id="title-error" message={state.fieldErrors?.title} />
              </div>
              <div>
                <Textarea name="body" defaultValue={entry.body} rows={10} required {...fieldAria(state, "body")} />
                <FieldError id="body-error" message={state.fieldErrors?.body} />
              </div>
              <div>
                <Input name="tags" defaultValue={entry.tags.join(", ")} placeholder="Tags (comma separated)" {...fieldAria(state, "tags")} />
                <FieldError id="tags-error" message={state.fieldErrors?.tags} />
              </div>
              <div>
                <Input
                  name="confidence"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Confidence % (optional)"
                  defaultValue={entry.confidence ?? ""}
                  {...fieldAria(state, "confidence")}
                />
                <FieldError id="confidence-error" message={state.fieldErrors?.confidence} />
              </div>
              <div>
                <Input name="expires_at" type="date" defaultValue={entry.expires_at ?? ""} {...fieldAria(state, "expires_at")} />
                <FieldError id="expires_at-error" message={state.fieldErrors?.expires_at} />
              </div>
              {state.error ? (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
              ) : null}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Saving…" : "Save changes"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setMode("view")}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
