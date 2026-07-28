import Link from "next/link";
import { Settings } from "lucide-react";
import { CommandPalette } from "@/components/shell/command-palette";
import { QuickActionModal } from "@/components/shell/quick-action-modal";
import type { Database } from "@/lib/supabase/database.types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export function Topbar({ accounts }: { accounts: Account[] }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b border-white/[0.08] bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-1">
        <QuickActionModal accounts={accounts} />
        <CommandPalette />
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground ring-1 ring-border transition-colors hover:bg-white/[0.04] hover:text-foreground md:hidden"
        >
          <Settings className="h-[18px] w-[18px]" />
        </Link>
      </div>
    </header>
  );
}
