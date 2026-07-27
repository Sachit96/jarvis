import { cn } from "@/lib/utils";

interface MacroBarProps {
  label: string;
  value: number;
  target: number;
  unit: string;
}

function MacroBar({ label, value, target, unit }: MacroBarProps) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const over = target > 0 && value > target;

  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-mono", over ? "text-danger" : "text-brand")}>
          {Math.round(value)} / {target} {unit}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", over ? "bg-danger" : "bg-brand")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function MacroProgressBars({
  totals,
  targets,
}: {
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  targets: { target_calories: number; target_protein_g: number; target_carbs_g: number; target_fat_g: number } | null;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <MacroBar label="Calories" value={totals.calories} target={targets?.target_calories ?? 2000} unit="kcal" />
      <MacroBar label="Protein" value={totals.protein_g} target={targets?.target_protein_g ?? 150} unit="g" />
      <MacroBar label="Carbs" value={totals.carbs_g} target={targets?.target_carbs_g ?? 200} unit="g" />
      <MacroBar label="Fat" value={totals.fat_g} target={targets?.target_fat_g ?? 65} unit="g" />
    </div>
  );
}
