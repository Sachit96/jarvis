import { CheckCircle2, XCircle } from "lucide-react";

export function SmsStatusCard({ configured, ownerNumber, recentCount }: { configured: boolean; ownerNumber: string | null; recentCount: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">SMS Logging (Twilio)</p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {configured ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}
        <span>{configured ? "Configured" : "Not configured"}</span>
      </div>
      {configured ? (
        <>
          <p className="mt-1 font-mono text-xs text-muted-foreground">owner: {ownerNumber}</p>
          <p className="mt-1 text-xs text-muted-foreground">{recentCount} message(s) in the last 24h</p>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and OWNER_PHONE_NUMBER, then point that
          Twilio number&apos;s webhook at /api/sms/webhook.
        </p>
      )}
    </div>
  );
}
