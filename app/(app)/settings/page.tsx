import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GroqStatusCard } from "@/components/settings/groq-status-card";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { MENTOR_MODEL } from "@/lib/ai/groq";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">System</p>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Profile</p>
        <p className="mt-2 text-sm">{user?.email}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
          Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
        </p>
        <ChangePasswordForm />
      </div>

      <GroqStatusCard hasKey={hasGroqKey} model={MENTOR_MODEL} />

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Data export</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Download every record you own across all modules as a single JSON file.
        </p>
        <a
          href="/api/export/json"
          download
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80"
        >
          <Download className="h-3.5 w-3.5" /> Export JSON backup
        </a>
      </div>
    </div>
  );
}
