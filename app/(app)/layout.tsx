import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";

// The Supabase service-role client (lib/supabase/server.ts) never touches
// cookies()/headers(), so nothing here implicitly signals per-request
// rendering to Next.js — without this, every page below would get
// prerendered once at build time with stale data baked into static HTML.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
