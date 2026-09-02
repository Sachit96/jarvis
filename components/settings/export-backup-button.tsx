"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { exportJsonBackupAction } from "@/actions/export-actions";

/** Triggers a real download via a Server Action rather than a plain <a href="/api/export/json"> — that route now requires a bearer token the browser has no way to attach to a link click. */
export function ExportBackupButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = await exportJsonBackupAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const blob = new Blob([res.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jarvis-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" /> {isPending ? "Preparing…" : "Export JSON backup"}
      </button>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
