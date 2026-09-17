"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteLifeScheduleBlockAction } from "@/actions/life-actions";

export function DeleteLifeScheduleBlockButton({ id }: { id: string }) {
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => deleteLifeScheduleBlockAction(id))}
      className="relative after:absolute after:-inset-3.5 text-muted-foreground/60 hover:text-danger"
      aria-label="Delete block"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
