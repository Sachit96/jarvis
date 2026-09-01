"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SIDEBAR_ITEMS } from "@/lib/nav-items";
import {
  globalSearchAction,
  getRecentSearchItemsAction,
  type SearchGroup,
  type SearchResult,
} from "@/actions/search-actions";
import { runUniCommandAction } from "@/actions/uni-command-actions";

const PAGES: SearchResult[] = SIDEBAR_ITEMS.filter((i) => i.href !== "/").map((i) => ({
  id: i.href,
  title: i.label,
  href: i.href,
  updatedAt: "",
}));

function pagesGroup(query: string): SearchGroup {
  const q = query.trim().toLowerCase();
  const items = q ? PAGES.filter((p) => p.title.toLowerCase().includes(q)) : PAGES;
  return { key: "pages", label: "Pages", items: items.slice(0, 5), total: items.length };
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [recent, setRecent] = useState<SearchResult[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isCommandPending, startCommandTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // Voice Mode — ⌘/Ctrl+J from anywhere in the app, same pattern as ⌘K above.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        router.push("/voice");
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    // Empty-query state needs the "recently modified" list — fetch once per open.
    startTransition(async () => {
      const r = await getRecentSearchItemsAction();
      setRecent(r);
    });
  }, [open]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setGroups([]);
      setHighlighted(0);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setHighlighted(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setGroups([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearchAction(value);
        setGroups(r.groups);
      });
    }, 250);
  }

  const showingRecent = query.trim().length < 2;

  // Single flattened list drives both rendering order and keyboard nav — group headers
  // are inserted for display but never receive a highlight index themselves.
  const displayGroups: SearchGroup[] = useMemo(() => {
    if (showingRecent) {
      return [pagesGroup(""), { key: "recent", label: "Recently updated", items: recent, total: recent.length }];
    }
    const withPages = [pagesGroup(query), ...groups];
    return withPages.filter((g) => g.items.length > 0);
  }, [showingRecent, query, groups, recent]);

  const flatItems = useMemo(() => displayGroups.flatMap((g) => g.items), [displayGroups]);
  const totalKnown = displayGroups.reduce((sum, g) => sum + (g.total || g.items.length), 0);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${highlighted}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  function navigateTo(item: SearchResult) {
    setOpen(false);
    router.push(item.href);
  }

  /**
   * UniOS command bar extension (Work Order 3) — opt-in, not automatic on
   * every keystroke: this only runs when the user explicitly picks the
   * "Ask JARVIS" row, both to avoid a Gemini call per debounced keystroke
   * and because the palette's default job is search; natural-language
   * actions are a deliberate escalation from that, never a silent guess.
   */
  function runCommand() {
    const text = query.trim();
    if (!text) return;
    startCommandTransition(async () => {
      const result = await runUniCommandAction(text);
      if (result.matched) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast(result.message);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[highlighted];
      if (item) navigateTo(item);
    }
  }

  let runningIndex = -1;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search everything"
        className="hidden h-8 w-56 items-center gap-2 rounded-lg px-2.5 text-muted-foreground ring-1 ring-border transition-colors hover:bg-white/[0.04] hover:text-foreground sm:flex lg:w-72"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate text-left text-caption">Search anything...</span>
        <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search everything"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground ring-1 ring-border transition-colors hover:bg-white/[0.04] hover:text-foreground sm:hidden"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[560px] gap-0 p-0 sm:max-w-[560px]" showCloseButton={false}>
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search goals, tasks, notes, memory, finance…"
              className="h-auto border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
              autoFocus
            />
            <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              Esc
            </kbd>
          </div>

          <div ref={listRef} className="max-h-[420px] space-y-3 overflow-y-auto p-2">
            {!showingRecent && isPending && flatItems.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Searching…</p>
            ) : !showingRecent && flatItems.length === 0 ? (
              <div className="px-2 py-6 text-center">
                <p className="text-sm text-foreground">No matches for &ldquo;{query}&rdquo;</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ⌘K searches goals, tasks, habits, notes, memory, and finance.
                </p>
              </div>
            ) : (
              displayGroups.map((group) => (
                <div key={group.key}>
                  <p className="px-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {group.label}
                    {group.total > group.items.length ? (
                      <span className="ml-1 normal-case text-muted-foreground/70">
                        (showing {group.items.length} of {group.total})
                      </span>
                    ) : null}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      runningIndex += 1;
                      const index = runningIndex;
                      const isHighlighted = index === highlighted;
                      return (
                        <li key={`${group.key}-${item.id}`} data-index={index}>
                          <button
                            onClick={() => navigateTo(item)}
                            onMouseEnter={() => setHighlighted(index)}
                            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                              isHighlighted ? "bg-brand/15 text-foreground" : "hover:bg-white/[0.04]"
                            }`}
                          >
                            {group.key === "pages" ? (
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : null}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{item.title}</span>
                              {item.subtitle ? (
                                <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          {query.trim().length >= 3 ? (
            <div className="border-t border-border p-2">
              <button
                onClick={runCommand}
                disabled={isCommandPending}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {isCommandPending ? "Asking JARVIS…" : <>Ask JARVIS: &ldquo;{query}&rdquo;</>}
                </span>
              </button>
            </div>
          ) : null}

          {!showingRecent && totalKnown > 20 ? (
            <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
              Showing top {Math.min(flatItems.length, 20)} of {totalKnown} matches
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
