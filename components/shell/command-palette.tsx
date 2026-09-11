"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, Sparkles } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { SIDEBAR_ITEMS } from "@/lib/nav-items";
import {
  globalSearchAction,
  getRecentSearchItemsAction,
  type SearchGroup,
  type SearchResult,
} from "@/actions/search-actions";

const PAGES: SearchResult[] = SIDEBAR_ITEMS.filter((i) => i.href !== "/").map((i) => ({
  id: i.href,
  title: i.label,
  href: i.href,
  updatedAt: "",
}));

const MIN_QUERY = 2;
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Rebuilt on cmdk. The previous implementation hand-rolled keyboard
 * navigation, highlight state, a flattened index to map arrow keys onto
 * grouped rendering, and scroll-into-view — all of which cmdk does, with
 * correct ARIA combobox semantics the hand-rolled version never had.
 *
 * Server results arrive already filtered, so cmdk's own fuzzy filter is off
 * (shouldFilter={false}); leaving it on would filter the results a second
 * time against the same query and silently drop rows the server matched on
 * a field the title doesn't contain.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [recent, setRecent] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // Voice Mode — ⌘/Ctrl+J from anywhere in the app, same pattern as ⌘K.
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
      setRecent(await getRecentSearchItemsAction());
    });
  }, [open]);

  // Any pending debounce belongs to a query the user has moved on from, so
  // it's cleared on unmount as well as on every keystroke — without this a
  // late timer fires setState after the dialog is gone.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setGroups([]);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < MIN_QUERY) {
      setGroups([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearchAction(value);
        setGroups(r.groups);
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  const showingRecent = query.trim().length < MIN_QUERY;

  const pageMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = q ? PAGES.filter((p) => p.title.toLowerCase().includes(q)) : PAGES;
    return items.slice(0, 5);
  }, [query]);

  const resultGroups = useMemo(
    () => (showingRecent ? [] : groups.filter((g) => g.items.length > 0)),
    [showingRecent, groups],
  );

  const navigateTo = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  /**
   * Hand the question to the Mentor rather than answering it here.
   *
   * This row used to call a University-only action that could create an
   * assessment or plan a study night — four hard-coded academic verbs, and
   * nothing else. With that module gone the capability moves to the
   * operator, which reaches tasks, goals, finance, business and health.
   *
   * It navigates instead of executing in place: the operator can return a
   * confirmation gate for anything destructive, and the palette has no way
   * to render one. Running it here would mean either dropping the gate or
   * approving on the user's behalf from a toast.
   */
  function askJarvis() {
    const text = query.trim();
    if (!text) return;
    setOpen(false);
    router.push(`/mentor?q=${encodeURIComponent(text)}`);
  }

  const hasResults = pageMatches.length > 0 || resultGroups.length > 0 || (showingRecent && recent.length > 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search everything"
        className="relative hidden h-8 w-56 items-center gap-2 rounded-lg px-2.5 text-muted-foreground ring-1 ring-border transition-colors after:absolute after:-inset-y-2 hover:bg-white/[0.04] hover:text-foreground sm:flex lg:w-72"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 truncate text-left text-caption">Search anything...</span>
        <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search everything"
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground ring-1 ring-border transition-colors after:absolute after:-inset-1.5 hover:bg-white/[0.04] hover:text-foreground sm:hidden"
      >
        <Search className="size-[18px]" />
      </button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Search"
        description="Search goals, tasks, notes, memory and finance"
        commandProps={{ shouldFilter: false }}
      >
        <CommandInput
          value={query}
          onValueChange={handleQueryChange}
          placeholder="Search goals, tasks, notes, memory, finance…"
        />
        <CommandList>
          {!hasResults && !isPending ? (
            <CommandEmpty>
              {showingRecent ? (
                "Start typing to search."
              ) : (
                <>
                  <p>No matches for &ldquo;{query}&rdquo;</p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    ⌘K searches goals, tasks, habits, notes, memory, and finance.
                  </p>
                </>
              )}
            </CommandEmpty>
          ) : null}

          {pageMatches.length > 0 ? (
            <CommandGroup heading="Pages">
              {pageMatches.map((page) => (
                <CommandItem
                  key={page.href}
                  value={`page-${page.href}`}
                  onSelect={() => navigateTo(page.href)}
                >
                  <FileText />
                  {page.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {showingRecent && recent.length > 0 ? (
            <CommandGroup heading="Recently updated">
              {recent.map((item) => (
                <CommandItem key={item.id} value={`recent-${item.id}`} onSelect={() => navigateTo(item.href)}>
                  <FileText />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {resultGroups.map((group) => (
            <CommandGroup
              key={group.key}
              heading={
                group.total > group.items.length
                  ? `${group.label} · showing ${group.items.length} of ${group.total}`
                  : group.label
              }
            >
              {group.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${group.key}-${item.id}`}
                  onSelect={() => navigateTo(item.href)}
                >
                  <FileText />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          {!showingRecent ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Actions">
                <CommandItem value="ask-jarvis" onSelect={askJarvis}>
                  <Sparkles />
                  {`Ask JARVIS to “${query.trim()}”`}
                  <CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
