import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { MentorFab } from "@/components/shell/mentor-fab";
import { Topbar } from "@/components/shell/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/db/queries/finance";

export async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const accounts = await getAccounts(supabase);

  // Read the collapsed state on the server so the sidebar renders at its
  // final width in the first paint. The previous localStorage approach
  // could only know after hydration, so a collapsed sidebar visibly
  // snapped shut on every navigation.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <Topbar accounts={accounts} />
        {/* pb-20 clears the mobile bottom bar; md+ has no bottom bar to clear. */}
        <main className="min-w-0 flex-1 pb-20 md:pb-6">
          <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-8 md:px-6 2xl:max-w-[1800px]">{children}</div>
        </main>
      </SidebarInset>
      <BottomNav />
      <MentorFab />
    </SidebarProvider>
  );
}
