"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { updateContactNotesAction } from "@/actions/business-actions";
import { type ActionState } from "@/lib/validation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

/** Notes is also the wikilink source text (see lib/obsidian/wikilinks.ts) — [[Title]] here creates a real backlink on save. */
export function ContactNotesEditor({ contactId, notes }: { contactId: string; notes: string | null }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateContactNotesAction, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) setEditing(false);
    wasPending.current = isPending;
  }, [isPending, state.error]);

  if (!editing) {
    return (
      <div className="group/notes">
        <div className="flex items-center justify-between">
          <p className="text-label uppercase tracking-wide text-muted-foreground">Notes</p>
          <button onClick={() => setEditing(true)} className="text-muted-foreground opacity-0 hover:text-foreground group-hover/notes:opacity-100">
            <Pencil className="h-3 w-3" />
          </button>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
          {notes || <span className="italic">No notes yet — add one to link this to memory entries, courses, or journal entries with [[wikilinks]].</span>}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={contactId} />
      <p className="text-label uppercase tracking-wide text-muted-foreground">Notes</p>
      <Textarea name="notes" defaultValue={notes ?? ""} rows={4} placeholder="Notes… use [[Title]] to link to a memory entry, course, or journal entry" />
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
