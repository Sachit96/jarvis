import { StatTile } from "@/components/shared/stat-tile";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="text-sm text-muted-foreground">
          Your cross-module command center.
        </p>
      </div>

      <div className="rounded-lg border border-brand/40 bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-brand">
          Mentor&apos;s take
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Coming in Phase 5 — the AI Mentor reads every module below and
          surfaces a daily recommendation here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Life" value="—" delta="Phase 1" />
        <StatTile label="Finance" value="—" delta="Phase 2" />
        <StatTile label="Health" value="—" delta="Phase 3" />
        <StatTile label="Business" value="—" delta="Phase 4" />
      </div>
    </div>
  );
}
