import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

/**
 * The considered version of "no data yet" — generous whitespace instead of
 * a dashed placeholder box, and copy that sounds like it was actually
 * written rather than defaulted to. Keep titles short and specific to the
 * thing that's missing ("No trades logged yet" beats "No data").
 */
export function EmptyState({ title, description, icon: Icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {Icon ? <Icon className="mb-1 h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} /> : null}
      <p className="text-body font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-xs text-body text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
