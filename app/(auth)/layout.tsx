import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center font-mono text-2xl font-semibold tracking-widest text-brand">
          JARVIS
        </p>
        {children}
      </div>
    </div>
  );
}
