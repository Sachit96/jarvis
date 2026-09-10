import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AuroraBackdrop } from "@/components/shell/aurora-backdrop";
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
      {/* bg-transparent: the body already paints the canvas, and an
          opaque background here would sit on top of the aurora. */}
      <SidebarInset className="min-w-0 bg-transparent">
        {/* Ambient light for the whole OS, not per page. Pages that are the
            product's front doors (Home, Voice, AI Mentor) mount their own
            `focal` backdrop on top; everything else inherits this one, which
            is what stops a secondary route from reading as a different,
            unlit application. Kept at ambient strength precisely so the
            interface does not become "purple" — it is a black room with the
            light on somewhere off-screen. */}
        <AuroraBackdrop />
        <Topbar accounts={accounts} />
        {/* pb-20 clears the mobile bottom bar; md+ has no bottom bar to clear. */}
        <main className="relative z-10 min-w-0 flex-1 pb-20 md:pb-6">
          <div className="mx-auto w-full max-w-6xl px-4 pt-3 pb-8 md:px-6 2xl:max-w-[1800px]">{children}</div>
        </main>
      </SidebarInset>
      <BottomNav />
      <MentorFab />
    </SidebarProvider>
  );
}
