import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/database.types";

type GhlSyncLog = Database["public"]["Tables"]["ghl_sync_logs"]["Row"];

export function GhlSyncLogs({ logs }: { logs: GhlSyncLog[] }) {
  if (logs.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Recent GHL sync activity</p>
      <ul className="mt-2 space-y-1.5">
        {logs.map((log) => (
          <li key={log.id} className="flex items-center gap-2 text-xs">
            <Badge
              variant="outline"
              className={cn("text-[10px] uppercase", log.status === "success" ? "text-success border-success/40" : "text-danger border-danger/40")}
            >
              {log.status}
            </Badge>
            <span className="text-muted-foreground">{log.direction}</span>
            <span className="min-w-0 flex-1 truncate">{log.event_type}</span>
            <span className="shrink-0 font-mono text-muted-foreground">
              {new Date(log.created_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
