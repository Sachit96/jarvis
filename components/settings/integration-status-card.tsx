import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getIntegrationStatuses, type IntegrationState } from "@/lib/integrations/status";

/**
 * One board showing every external service and whether it can actually do
 * anything, replacing per-integration cards that each decided for themselves
 * what "connected" meant.
 *
 * Reads the same function the AI tools read, so what this page claims and
 * what JARVIS tells you in chat cannot diverge.
 */

const STATE_LABEL: Record<IntegrationState, string> = {
  connected: "Connected",
  disconnected: "Not connected",
  configuration_required: "Setup required",
  syncing: "Syncing",
  error: "Error",
  unavailable: "Unavailable",
};

/**
 * Colour is never the only signal — each row carries the state in words too,
 * which is also what makes the amber/green distinction survive a colour-
 * vision difference.
 */
const STATE_DOT: Record<IntegrationState, string> = {
  connected: "bg-success",
  disconnected: "bg-muted-foreground/50",
  configuration_required: "bg-warn",
  syncing: "bg-brand animate-pulse",
  error: "bg-danger",
  unavailable: "bg-muted-foreground/50",
};

export function IntegrationStatusCard() {
  const statuses = getIntegrationStatuses();

  return (
    <Card padding="slotted">
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          What JARVIS can reach. Anything not connected is simply unavailable — no data is
          invented in its place.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ul className="-my-1 divide-y divide-border">
          {statuses.map((status) => (
            <li key={status.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-body font-medium">{status.label}</p>
                <p className="text-caption text-muted-foreground">{status.message}</p>
                {status.actionHint ? (
                  <p className="mt-0.5 text-caption text-muted-foreground/80">{status.actionHint}</p>
                ) : null}
                {/* Names only. Printing a value here would put a secret into
                    server-rendered HTML. */}
                {status.requires && status.state !== "connected" ? (
                  <p className="mt-1 font-mono text-caption text-muted-foreground/60">
                    {status.requires.join(" · ")}
                  </p>
                ) : null}
              </div>

              <span className="flex shrink-0 items-center gap-1.5 text-caption text-muted-foreground">
                <span className={cn("size-1.5 shrink-0 rounded-full", STATE_DOT[status.state])} />
                {STATE_LABEL[status.state]}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
