"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createMaterialAction } from "@/actions/uni-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { MATERIAL_TYPES } from "@/lib/validations/uni";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const TYPE_LABEL: Record<(typeof MATERIAL_TYPES)[number], string> = {
  slides: "Slides",
  notes: "Notes",
  reading: "Reading",
  practice_exam: "Practice exam",
  syllabus: "Syllabus",
  other: "Other",
};

const initialState: ActionState = {};

export function MaterialForm({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createMaterialAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="secondary" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add material
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add material</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="course_id" value={courseId} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required autoFocus {...fieldAria(state, "title")} />
              <FieldError id="title-error" message={state.fieldErrors?.title} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue="notes">
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t} label={TYPE_LABEL[t]}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Content</Label>
            <Textarea id="body" name="body" rows={8} placeholder="Paste notes, reading text, or syllabus content here…" required {...fieldAria(state, "body")} />
            <FieldError id="body-error" message={state.fieldErrors?.body} />
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Add material"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
