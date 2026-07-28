import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/app-shell";
import { ReconnectingScreen } from "@/components/shell/reconnecting-screen";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session yet — middleware's automatic sign-in hasn't resolved (see
  // lib/supabase/middleware.ts). Show a clean reconnecting state rather than
  // rendering the app shell with no user context, which would otherwise mean
  // every RLS-scoped query silently returns empty.
  if (!user) {
    return <ReconnectingScreen />;
  }

  return <AppShell>{children}</AppShell>;
}
