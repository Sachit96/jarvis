import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { CommandPalette } from "@/components/shell/command-palette";
import { QuickActionModal } from "@/components/shell/quick-action-modal";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Database } from "@/lib/supabase/database.types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export function Topbar({ accounts }: { accounts: Account[] }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mx-1 hidden data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center sm:block"
      />
      {/* The trail collapses to the current page alone on narrow screens
          (see Breadcrumbs) so it never competes with the search box. */}
      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-2">
        <CommandPalette />
        <QuickActionModal accounts={accounts} />
      </div>
    </header>
  );
}
