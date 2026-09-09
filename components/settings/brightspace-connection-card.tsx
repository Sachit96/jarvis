import Link from "next/link";
import { GraduationCap, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getBrightspaceConnectionStatus } from "@/lib/integrations/brightspace";

/**
 * Connect / reconnect Brightspace.
 *
 * Server component so the stored-connection lookup happens where the
 * service-role client lives; nothing about the token reaches the browser.
 *
 * The three states are deliberately distinct, because each needs a
 * different action from the user: no registered app (an admin task at the
 * institution), a registered app with no grant (one click), and an expired
 * grant (one click, but for a different reason).
 */
export async function BrightspaceConnectionCard() {
  const status = await getBrightspaceConnectionStatus();
  const needsAppRegistration = status.state === "configuration_required";

  return (
    <Card padding="slotted">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="size-4 text-brand" strokeWidth={2} />
          Brightspace
        </CardTitle>
        <CardDescription>{status.message}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {status.actionHint ? (
          <p className="text-caption text-muted-foreground">{status.actionHint}</p>
        ) : null}

        {needsAppRegistration ? (
          <>
            <Alert className="border-warn/30 bg-warn/10 text-warn">
              <TriangleAlert />
              <AlertDescription className="text-warn/90">
                No OAuth application is registered yet, so there is nothing to connect to. Many
                institutions do not offer student app registration — if yours does not, University
                stays on manually-entered data and everything else keeps working.
              </AlertDescription>
            </Alert>
            {/* Names only — printing a value would put a secret into
                server-rendered HTML. */}
            <p className="font-mono text-caption text-muted-foreground/60">
              {status.requires?.join(" · ")}
            </p>
          </>
        ) : (
          <Button size="sm" render={<Link href="/api/brightspace/oauth/connect" />}>
            {status.state === "connected" ? "Reconnect" : "Connect Brightspace"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
