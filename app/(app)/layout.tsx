import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Toaster } from "@/components/ui/sonner";

// The Supabase service-role client (lib/supabase/server.ts) never touches
// cookies()/headers(), so nothing here implicitly signals per-request
// rendering to Next.js — without this, every page below would get
// prerendered once at build time with stale data baked into static HTML.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      {/* Mounted once here — no ThemeProvider exists (the app is hard-coded dark-mode-only), so sonner falls back to its own default theming; the app's own dark CSS variables (--popover etc.) already drive its actual colors regardless. First real consumer: the command palette's "Ask JARVIS" result toast. */}
      <Toaster />
    </>
  );
}
