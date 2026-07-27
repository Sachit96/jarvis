import Link from "next/link";
import { Settings } from "lucide-react";
import { signOutAction } from "@/actions/auth-actions";
import { CommandPalette } from "@/components/shell/command-palette";
import { QuickActionModal } from "@/components/shell/quick-action-modal";
import type { Database } from "@/lib/supabase/database.types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export function Topbar({ email, accounts }: { email: string | undefined; accounts: Account[] }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4">
      <span className="hidden font-mono text-sm text-muted-foreground sm:inline">
        {email}
      </span>
      <div className="flex items-center gap-4">
        <QuickActionModal accounts={accounts} />
        <CommandPalette />
        <Link href="/settings" aria-label="Settings" className="text-muted-foreground hover:text-foreground">
          <Settings className="h-[18px] w-[18px]" />
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
