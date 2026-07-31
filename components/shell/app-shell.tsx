import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { MentorFab } from "@/components/shell/mentor-fab";
import { Topbar } from "@/components/shell/topbar";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/db/queries/finance";

export async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const accounts = await getAccounts(supabase);

  return (
    <div className="flex min-h-full shrink-0">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar accounts={accounts} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <div className="mx-auto w-full max-w-6xl px-6 pt-5 pb-8 2xl:max-w-[1800px]">{children}</div>
        </main>
      </div>
      <BottomNav />
      <MentorFab />
    </div>
  );
}
