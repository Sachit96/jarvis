import Link from "next/link";
import { Settings } from "lucide-react";
import { signOutAction } from "@/actions/auth-actions";
import { CommandPalette } from "@/components/shell/command-palette";
import { QuickActionModal } from "@/components/shell/quick-action-modal";
import type { Database } from "@/lib/supabase/database.types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export function Topbar({ email, accounts }: { email: string | undefined; accounts: Account[] }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-background/80 px-4 backdrop-blur-sm md:px-6">
      {/* Sidebar already shows email + sign-out on desktop — this is the mobile-only fallback. */}
      {email ? <span className="font-mono text-caption text-muted-foreground md:hidden">{email}</span> : null}
      <div className="ml-auto flex items-center gap-1">
        <QuickActionModal accounts={accounts} />
        <CommandPalette />
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          <Settings className="h-[18px] w-[18px]" />
        </Link>
        {email ? (
          <form action={signOutAction} className="md:hidden">
            <button
              type="submit"
              className="flex h-8 items-center rounded-lg px-2.5 text-caption text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        ) : null}
      </div>
    </header>
  );
}
