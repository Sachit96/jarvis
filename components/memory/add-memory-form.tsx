"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { createMemoryEntryAction } from "@/actions/memory-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { MEMORY_TYPES, MEMORY_TYPE_LABEL } from "@/lib/validations/memory";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ActionState = {};

export function AddMemoryForm() {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, isPending] = useActionState(createMemoryEntryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      setExpanded(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-xl bg-card px-4 py-2.5 text-left text-body text-muted-foreground ring-1 ring-border transition-colors hover:bg-white/[0.04] hover:text-foreground"
      >
        + Add memory…
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border"
    >
      <div className="grid grid-cols-[140px_1fr] gap-3">
        <Select name="type" defaultValue="fact">
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
        <div>
          <Input name="title" placeholder="Title" required autoFocus {...fieldAria(state, "title")} />
          <FieldError id="title-error" message={state.fieldErrors?.title} />
        </div>
      </div>
      <div>
        <Textarea name="body" placeholder="What should JARVIS remember?" rows={3} required {...fieldAria(state, "body")} />
        <FieldError id="body-error" message={state.fieldErrors?.body} />
      </div>
      <div>
        <Input name="tags" placeholder="Tags (comma separated, optional)" {...fieldAria(state, "tags")} />
        <FieldError id="tags-error" message={state.fieldErrors?.tags} />
      </div>
      {state.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setExpanded(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
