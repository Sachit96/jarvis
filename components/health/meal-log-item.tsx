"use client";

import { useTransition } from "react";
import { Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteNutritionLogAction } from "@/actions/health-actions";
import type { Database } from "@/lib/supabase/database.types";

type NutritionLog = Database["public"]["Tables"]["nutrition_logs"]["Row"];

export function MealLogItem({ log }: { log: NutritionLog }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(() => deleteNutritionLogAction(log.id));
  }

  return (
    <li className={cn("flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3", isPending && "opacity-50")}>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm">
          {log.source === "chatbot" ? <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand" /> : null}
          {log.description}
        </p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
          {log.calories} kcal · P{Number(log.protein_g)} · C{Number(log.carbs_g)} · F{Number(log.fat_g)}
        </p>
      </div>
      <button onClick={handleDelete} aria-label="Delete meal" className="shrink-0 text-muted-foreground hover:text-danger">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
