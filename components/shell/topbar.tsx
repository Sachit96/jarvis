import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { CommandPalette } from "@/components/shell/command-palette";
import { QuickActionModal } from "@/components/shell/quick-action-modal";
import { TopbarSurface } from "@/components/shell/topbar-surface";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Database } from "@/lib/supabase/database.types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

/**
 * Context and commands for the current module — never destinations. See
 * TopbarSurface for why the navigation hierarchy is split this way.
 */
export function Topbar({ accounts }: { accounts: Account[] }) {
  return (
    <TopbarSurface>
      <SidebarTrigger className="size-8 rounded-full text-foreground-tertiary hover:bg-white/[0.06] hover:text-white" />
      {/* The trail collapses to the current page alone on narrow screens
          (see Breadcrumbs) so it never competes with the search box. */}
      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-2">
        <CommandPalette />
        <QuickActionModal accounts={accounts} />
      </div>
    </TopbarSurface>
  );
}
