"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Briefcase,
  Check,
  HeartPulse,
  ListChecks,
  Loader2,
  Mic,
  Paperclip,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RadarMark } from "@/components/shell/radar-mark";
import { MentorBriefSections } from "@/components/mentor/mentor-brief-sections";
import {
  generateBriefForConsoleAction,
  sendOperatorMessageAction,
  type BriefPayload,
  type OperatorChatResult,
} from "@/actions/mentor-actions";
import type { Database } from "@/lib/supabase/database.types";

type MentorMessage = Database["public"]["Tables"]["mentor_messages"]["Row"];

interface TraceEntry {
  name: string;
  label: string;
  ok: boolean;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
  /** Tools this reply ran, listed above it so the answer is auditable. */
  trace?: TraceEntry[];
  /** Set when the turn is a generated daily brief rather than a plain reply. */
  brief?: BriefPayload;
}

interface PendingConfirmation {
  toolName: string;
  summary: string;
  args: Record<string, unknown>;
  /** The message that triggered it, replayed verbatim on approval. */
  sourceMessage: string;
}

/**
 * The four things worth doing from a cold start.
 *
 * Three are ordinary prompts. The brief is not: it is a stored artifact that
 * the weekly review and the scheduled job both read, so its chip runs the
 * real generator and renders the result as a turn, rather than asking the
 * operator to improvise something brief-shaped that nothing else can see.
 */
/** Icons are the sidebar's, so a chip visibly points at the module it will touch. */
const QUICK_ACTIONS: { icon: LucideIcon; label: string; prompt?: string; kind?: "brief" }[] = [
  {
    icon: Sparkles,
    label: "Generate today's brief & focus areas",
    kind: "brief",
  },
  {
    icon: Briefcase,
    label: "Review current open pipeline",
    prompt: "Review my current open pipeline — which deals are stalling and what should I do next?",
  },
  {
    icon: ListChecks,
    label: "Log a new task or routine",
    prompt: "I want to log a new task. Ask me what it is, then add it.",
  },
  {
    icon: HeartPulse,
    label: "Analyze weekly health & workout volume",
    prompt: "Analyse my training over the last week — volume by muscle group, and what I'm neglecting.",
  },
];

/**
 * The Mentor as one full-bleed console.
 *
 * Replaces a split screen that put a long brief in the left column and a
 * narrow chat in the right. The brief has not gone anywhere — it is the
 * first quick action, and it arrives in the conversation where you can
 * immediately ask a follow-up about it, which is the thing the two-column
 * version made you scroll away from.
 *
 * The activity trace stays. A reply that silently changed the user's data is
 * worse than no reply, so every tool a turn ran is listed above the answer,
 * and the authorisation gate is a real gate — the executor refuses the call
 * until it is approved.
 */
export function MentorConsole({
  initialMessages,
  initialBrief,
  hasKey,
  model,
}: {
  initialMessages: MentorMessage[];
  /** Today's brief, if one already exists, seeded as the opening turn. */
  initialBrief: BriefPayload | null;
  hasKey: boolean;
  /** The real model behind the operator, shown in the status line. */
  model: string;
}) {
  const [messages, setMessages] = useState<LocalMessage[]>(() => {
    const history: LocalMessage[] = initialMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    if (!initialBrief) return history;
    return [
      { id: `brief-${initialBrief.recDate}`, role: "assistant", content: "", brief: initialBrief },
      ...history,
    ];
  });
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const handedOff = useRef(false);

  const isEmpty = messages.length === 0;

  function scrollToEnd() {
    queueMicrotask(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
    );
  }

  function applyResult(result: OperatorChatResult, sourceMessage: string) {
    if (result.error) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: result.error!, failed: true },
      ]);
      scrollToEnd();
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.reply ?? "…",
        trace: result.trace,
      },
    ]);
    setPending(result.pendingConfirmation ? { ...result.pendingConfirmation, sourceMessage } : null);
    scrollToEnd();
  }

  function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isPending || !hasKey) return;
    if (!text) setInput("");
    // A new message supersedes any outstanding approval — otherwise an
    // ignored confirmation would stay armed and could attach to a later,
    // unrelated turn.
    setPending(null);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content }]);
    scrollToEnd();
    startTransition(async () => {
      applyResult(await sendOperatorMessageAction(content), content);
    });
  }

  function runQuickAction(action: (typeof QUICK_ACTIONS)[number]) {
    if (isPending || !hasKey) return;
    if (action.kind !== "brief") {
      send(action.prompt);
      return;
    }
    setPending(null);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: action.label },
    ]);
    scrollToEnd();
    startTransition(async () => {
      const result = await generateBriefForConsoleAction();
      setMessages((prev) => [
        ...prev,
        "error" in result
          ? { id: crypto.randomUUID(), role: "assistant", content: result.error, failed: true }
          : {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "",
              brief: result.brief,
              trace: [{ name: "daily_brief", label: "Wrote today's brief", ok: true }],
            },
      ]);
      scrollToEnd();
    });
  }

  /**
   * A question handed over from the command palette.
   *
   * The palette's "Ask JARVIS" row navigates here with ?q= rather than
   * running the turn itself, because the operator can return a
   * confirmation gate and the palette has nowhere to render one.
   *
   * The ref guards against a second send: this effect re-runs whenever the
   * transition settles, and the URL is only cleaned afterwards.
   */
  useEffect(() => {
    const handoff = searchParams.get("q");
    if (!handoff || handedOff.current || !hasKey) return;
    handedOff.current = true;
    send(handoff);
    router.replace("/mentor");
    // send/router are stable enough for this one-shot; re-running on every
    // render would re-ask the question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, hasKey]);

  function approve() {
    if (!pending || isPending) return;
    const { sourceMessage, toolName, args } = pending;
    setPending(null);
    startTransition(async () => {
      applyResult(await sendOperatorMessageAction(sourceMessage, { toolName, args }), sourceMessage);
    });
  }

  function decline() {
    setPending(null);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", content: "Cancelled — nothing was changed." },
    ]);
  }

  return (
    // fixed-viewport, not h-screen: the shell already spends height on the
    // command bar above and (under md) the tab bar below, and a raw 100vh
    // here would push the input bar underneath both. It also resolves
    // through 100dvh, so mobile browser chrome cannot hide the composer.
    <div className="fixed-viewport relative flex flex-col">
      <header className="flex shrink-0 items-center gap-3 pb-4">
        <RadarMark size={30} sweep={isPending} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-title leading-tight">Jarvis Mentor</h1>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-caption text-foreground-tertiary">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                hasKey ? "bg-success shadow-[0_0_6px_var(--success)]" : "bg-warn",
              )}
            />
            <span className="truncate">
              {hasKey ? (isPending ? "Working" : "Agent ready") : "Offline — no API key"}
              {/* The model is the first thing to give up when the row is
                  tight: at 390px it was rendering under the Weekly review
                  pill, half a word wide. */}
              <span className="hidden sm:inline"> · {model}</span>
            </span>
          </p>
        </div>
        {/* Weekly Review is its own route. Without this the tab row's removal
            would orphan it. */}
        <Link
          href="/mentor/weekly-review"
          className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-caption text-foreground-secondary backdrop-blur-md transition-colors hover:border-brand/50 hover:bg-white/10"
        >
          Weekly review
        </Link>
      </header>

      {/* min-h-0 is what lets this shrink instead of forcing the column
          taller than the viewport and pushing the composer off screen. */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyStage hasKey={hasKey} isPending={isPending} onRun={runQuickAction} />
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-5 pb-6">
            {messages.map((m) => (
              <Turn key={m.id} message={m} />
            ))}

            {isPending ? (
              <p className="flex items-center gap-2 text-foreground-tertiary">
                <Loader2 className="size-3 animate-spin" />
                <span className="eyebrow">Executing</span>
              </p>
            ) : null}

            {pending ? (
              <div className="rounded-[var(--radius)] border border-warn/30 bg-warn/[0.08] p-4 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)]">
                <p className="flex items-center gap-2 text-warn">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span className="text-[11px] tracking-[0.2em] uppercase">Authorisation required</span>
                </p>
                <p className="mt-2 text-body text-foreground">{pending.summary}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={approve} disabled={isPending}>
                    <Check className="size-4" />
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={decline} disabled={isPending}>
                    <X className="size-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => send()}
        disabled={!hasKey || isPending}
        placeholder={hasKey ? "Ask Jarvis anything, or give it an instruction…" : "JARVIS not configured"}
        inputRef={inputRef}
      />
    </div>
  );
}

/** The cold-start screen: identity, then the four things worth doing. */
function EmptyStage({
  hasKey,
  isPending,
  onRun,
}: {
  hasKey: boolean;
  isPending: boolean;
  onRun: (action: (typeof QUICK_ACTIONS)[number]) => void;
}) {
  return (
    // Tighter below sm on purpose. At 390 the desktop rhythm ran the fourth
    // chip under the composer, which reads as a broken grid rather than as
    // something to scroll to.
    <div className="flex min-h-full flex-col items-center justify-center px-2 py-4 text-center sm:py-8">
      <div className="rise">
        {/* The glow is a pooled brand light behind the mark, not a ring on
            it — a hard ring at this size reads as a loading spinner. */}
        <div className="relative mx-auto w-fit">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 scale-[2.2] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand)_38%,transparent),transparent_70%)] blur-xl"
          />
          <RadarMark size={56} />
        </div>

        <h2 className="mt-4 text-display sm:mt-6">Jarvis</h2>
        <p className="mt-1.5 text-body text-foreground-tertiary">
          Multi-model personal assistant and command center
        </p>
      </div>

      {!hasKey ? (
        <p className="mt-4 flex items-center gap-2 rounded-full border border-warn/30 bg-warn/10 px-3.5 py-1.5 text-caption text-warn">
          <TriangleAlert className="size-3.5 shrink-0" />
          GEMINI_API_KEY isn&apos;t configured yet, so these can&apos;t run.
        </p>
      ) : null}

      <div className="mt-5 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:mt-8 sm:gap-3 sm:grid-cols-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onRun(action)}
            disabled={!hasKey || isPending}
            className="group/chip flex items-start gap-3 rounded-[var(--radius)] border border-white/10 bg-white/5 p-3.5 text-left sm:p-4 backdrop-blur-md transition-all duration-200 ease-[var(--ease-jarvis)] hover:-translate-y-0.5 hover:border-brand/50 hover:bg-white/10 focus-visible:border-brand/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:border-white/10 disabled:hover:bg-white/5"
          >
            <action.icon
              className="mt-0.5 size-4 shrink-0 text-foreground-tertiary transition-colors group-hover/chip:text-brand"
              strokeWidth={2}
            />
            <span className="text-body text-foreground-secondary">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** One turn: its activity trace, then the message or the brief it produced. */
function Turn({ message }: { message: LocalMessage }) {
  return (
    <div className="space-y-1.5">
      {message.trace && message.trace.length > 0 ? (
        <ul className="space-y-1 border-l border-white/10 pl-3">
          {message.trace.map((entry, i) => (
            <li
              key={`${entry.name}-${i}`}
              className="flex items-center gap-2 text-caption text-foreground-tertiary"
            >
              <Check
                className={cn("size-3 shrink-0", entry.ok ? "text-success" : "text-warn")}
                strokeWidth={2.5}
              />
              <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-foreground-secondary">
                {entry.name}
              </span>
              <span className="min-w-0 truncate">{entry.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {message.brief ? (
        <BriefTurn brief={message.brief} />
      ) : (
        <div className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
          <p
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-body whitespace-pre-wrap",
              message.role === "user"
                ? "gradient-brand text-white shadow-[0_4px_20px_-8px_var(--brand)]"
                : message.failed
                  ? "bg-danger/10 text-danger"
                  : "bg-white/[0.05] text-foreground-secondary shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05)]",
            )}
          >
            {message.content}
          </p>
        </div>
      )}
    </div>
  );
}

/** A generated brief, rendered in the conversation rather than beside it. */
function BriefTurn({ brief }: { brief: BriefPayload }) {
  const tags: { label: string; items: string[]; tone: string }[] = [
    {
      label: "Focus areas",
      items: brief.focusAreas,
      tone: "bg-[color-mix(in_oklab,var(--brand)_22%,transparent)] text-white",
    },
    { label: "Strengths", items: brief.strengths, tone: "bg-success/12 text-success" },
    { label: "Weaknesses", items: brief.weaknesses, tone: "bg-warn/12 text-warn" },
  ].filter((t) => t.items.length > 0);

  return (
    <div className="space-y-4 rounded-[var(--radius)] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <MentorBriefSections markdownBody={brief.markdownBody} />
      {tags.length > 0 ? (
        <div className="space-y-3 border-t border-white/[0.08] pt-3.5">
          {tags.map((t) => (
            <div key={t.label}>
              <p className="eyebrow">{t.label}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.items.map((item, i) => (
                  <span key={i} className={cn("rounded-full px-2.5 py-1 text-caption font-medium", t.tone)}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The composer.
 *
 * A textarea rather than an input so a multi-line instruction is readable as
 * you type it; Enter still sends, Shift+Enter breaks the line. It grows to a
 * cap and then scrolls, so a long paste cannot push the whole console off
 * screen.
 */
function Composer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div className="shrink-0 pt-3">
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[calc(var(--radius)*1.25)] border border-white/10 bg-white/5 p-2 backdrop-blur-md shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),0_8px_32px_-12px_rgb(0_0_0/0.8)] focus-within:border-brand/50">
        {/* Attachment and voice are wired to their real destinations rather
            than being dead ornaments: attachments have no upload path on this
            route yet, so the control says so instead of silently doing
            nothing, and the mic hands off to Voice Mode, which is a whole
            route already built for it. */}
        <button
          type="button"
          disabled
          title="Attachments aren't supported here yet"
          aria-label="Attach a file (not available yet)"
          className="grid size-9 shrink-0 place-items-center rounded-full text-foreground-tertiary transition-colors disabled:opacity-40"
        >
          <Paperclip className="size-4" />
        </button>

        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            autoGrow(e.currentTarget);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Message Jarvis"
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-body text-foreground placeholder:text-foreground-tertiary focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        <Link
          href="/voice"
          aria-label="Open Voice Mode"
          title="Open Voice Mode"
          className="grid size-9 shrink-0 place-items-center rounded-full text-foreground-tertiary transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <Mic className="size-4" />
        </Link>

        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label="Send"
          className="gradient-brand grid size-9 shrink-0 place-items-center rounded-full text-white transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-35"
        >
          <ArrowUp className="size-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
