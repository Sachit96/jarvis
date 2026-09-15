"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteScheduleBlockAction, deleteMaterialAction, deleteDeadlineAction } from "@/actions/uni-actions";

export function DeleteScheduleBlockButton({ id }: { id: string }) {
  const [, startTransition] = useTransition();
  return (
    <button type="button" onClick={() => startTransition(() => deleteScheduleBlockAction(id))} className="relative after:absolute after:-inset-3.5 text-muted-foreground/60 hover:text-danger" aria-label="Delete class time">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

export function DeleteMaterialButton({ id, courseId }: { id: string; courseId: string }) {
  const [, startTransition] = useTransition();
  return (
    <button type="button" onClick={() => startTransition(() => deleteMaterialAction(id, courseId))} className="relative after:absolute after:-inset-3.5 text-muted-foreground/60 hover:text-danger" aria-label="Delete material">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

export function DeleteDeadlineButton({ id }: { id: string }) {
  const [, startTransition] = useTransition();
  return (
    <button type="button" onClick={() => startTransition(() => deleteDeadlineAction(id))} className="relative after:absolute after:-inset-3.5 text-muted-foreground/60 hover:text-danger" aria-label="Delete deadline">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
