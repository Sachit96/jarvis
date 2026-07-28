"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { globalSearchAction, type GlobalSearchResults } from "@/actions/search-actions";

const EMPTY: GlobalSearchResults = { tasks: [], trades: [], transactions: [], journal: [] };

const SECTIONS: { key: keyof GlobalSearchResults; label: string }[] = [
  { key: "tasks", label: "Tasks" },
  { key: "trades", label: "Trades" },
  { key: "transactions", label: "Financial Ledger" },
  { key: "journal", label: "Notes" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults(EMPTY);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults(EMPTY);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearchAction(value);
        setResults(r);
      });
    }, 250);
  }

  const totalResults = SECTIONS.reduce((sum, s) => sum + results[s.key].length, 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search everything"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground ring-1 ring-border transition-colors hover:bg-white/[0.04] hover:text-foreground"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Search everything</DialogTitle>
          </DialogHeader>
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search tasks, trades, transactions, notes…"
            autoFocus
          />
          <div className="max-h-80 space-y-4 overflow-y-auto">
            {query.trim().length < 2 ? (
              <p className="text-sm text-muted-foreground">Type at least 2 characters…</p>
            ) : isPending ? (
              <p className="text-sm text-muted-foreground">Searching…</p>
            ) : totalResults === 0 ? (
              <p className="text-sm text-muted-foreground">No matches.</p>
            ) : (
              SECTIONS.map((section) => {
                const items = results[section.key];
                if (items.length === 0) return null;
                return (
                  <div key={section.key}>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{section.label}</p>
                    <ul className="mt-1 space-y-1">
                      {items.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                          >
                            <span className="block truncate">{item.title}</span>
                            {item.subtitle ? (
                              <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
