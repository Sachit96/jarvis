"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, Send, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadarMark } from "@/components/shell/radar-mark";
import { sendOperatorMessageAction, type OperatorChatResult } from "@/actions/mentor-actions";
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
  /** Tools this reply ran, shown above it so the answer is auditable. */
  trace?: TraceEntry[];
}

interface PendingConfirmation {
  toolName: string;
  summary: string;
  args: Record<string, unknown>;
  /** The message that triggered it, replayed verbatim on approval. */
  sourceMessage: string;
}

/**
 * The tool-enabled Mentor chat.
 *
 * Separate from MentorChatWidget rather than replacing it: that widget backs
 * the nutrition chat, which has one tool and no confirmation UI, and folding
 * both into one component would mean a prop that switches between two
 * different server actions and two different result shapes.
 *
 * The activity trace exists because a reply that silently changed the user's
 * data is worse than no reply. Every tool the turn ran is listed above the
 * answer, so "I've added that" is checkable rather than trusted.
 *
 * Presented as a console rather than a chat app (§13): a system header with
 * live state, an execution trace on its own indented rail, and an
 * authorisation gate that looks like one. The restraint is deliberate — a
 * developer console is not the goal, so the terminal influence is limited to
 * the trace rail and the uppercase system labels, and the conversation
 * itself stays comfortable to read.
 */
export function OperatorChat({
  initialMessages,
  hasKey,
}: {
  initialMessages: MentorMessage[];
  hasKey: boolean;
}) {
  const [messages, setMessages] = useState<LocalMessage[]>(
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

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
    setPending(
      result.pendingConfirmation
        ? { ...result.pendingConfirmation, sourceMessage }
        : null,
    );
    scrollToEnd();
  }

  function send() {
    const content = input.trim();
    if (!content || isPending) return;
    setInput("");
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
    <div className="surface-raised flex flex-col overflow-hidden">
      <div className="relative flex items-center gap-3 overflow-hidden border-b border-border px-5 py-4">
        <RadarMark size={34} sweep={isPending} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">JARVIS operator</p>
          <p className="mt-1 truncate text-caption text-foreground-tertiary">
            Tasks · Goals · Finance · Business · University · Health
          </p>
        </div>
        {/* System state, not decoration: this is the one place the user can
            tell whether the operator can actually act right now. */}
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] tracking-[0.16em] uppercase",
            hasKey ? "bg-white/[0.05] text-foreground-secondary" : "bg-warn/10 text-warn",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              hasKey ? "bg-success shadow-[0_0_6px_var(--success)]" : "bg-warn",
            )}
          />
          {hasKey ? (isPending ? "Working" : "Online") : "Offline"}
        </span>
      </div>

      {!hasKey ? (
        <Alert className="mx-5 mt-3 w-auto border-warn/30 bg-warn/10 text-warn">
          <TriangleAlert />
          <AlertDescription className="text-warn/90">
            GEMINI_API_KEY isn&apos;t configured yet, so JARVIS can&apos;t respond right now.
          </AlertDescription>
        </Alert>
      ) : null}

      <div ref={scrollRef} className="min-h-40 space-y-4 overflow-y-auto p-5 xl:max-h-[calc(100vh-22rem)]">
        {messages.length === 0 ? (
          <div className="space-y-2 py-2">
            <p className="eyebrow">Awaiting instruction</p>
            <p className="text-body text-foreground-tertiary">
              Ask what to focus on today, what&apos;s due this week, or which deals need a follow-up —
              or just tell JARVIS to add a task.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="space-y-1.5">
              {m.trace && m.trace.length > 0 ? (
                <ul className="space-y-1 border-l border-border pl-3">
                  {m.trace.map((entry, i) => (
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

              <div className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-body",
                    m.role === "user"
                      ? "gradient-brand text-white shadow-[0_4px_20px_-8px_var(--brand)]"
                      : m.failed
                        ? "bg-danger/10 text-danger"
                        : "bg-white/[0.05] text-foreground-secondary shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05)]",
                  )}
                >
                  {m.content}
                </p>
              </div>
            </div>
          ))
        )}

        {isPending ? (
          <p className="flex items-center gap-2 text-foreground-tertiary">
            <Loader2 className="size-3 animate-spin" />
            <span className="eyebrow">Executing</span>
          </p>
        ) : null}

        {/* The confirmation gate's user-facing half. The executor refuses the
            call until this is approved, so this is not advisory UI — declining
            genuinely leaves the data untouched. */}
        {pending ? (
          <div className="rounded-xl border border-warn/30 bg-warn/[0.08] p-4 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)]">
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

      <div className="flex items-center gap-2 border-t border-border bg-white/[0.02] p-3.5">
        <Input
          className="rounded-full border-white/[0.1] bg-white/[0.03]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          placeholder={hasKey ? "What should I focus on today?" : "JARVIS not configured"}
          disabled={!hasKey || isPending}
        />
        <Button
          size="sm"
          onClick={send}
          disabled={!hasKey || isPending || !input.trim()}
          aria-label="Send"
          className="gradient-brand size-9 shrink-0 rounded-full p-0 text-white"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
