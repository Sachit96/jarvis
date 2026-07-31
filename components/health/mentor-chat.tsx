"use client";

import { useRef, useState, useTransition } from "react";
import { Send, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMentorMessageAction } from "@/actions/health-actions";
import type { Database } from "@/lib/supabase/database.types";

type MentorMessage = Database["public"]["Tables"]["mentor_messages"]["Row"];

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
}

export function MentorChat({ initialMessages, hasKey }: { initialMessages: MentorMessage[]; hasKey: boolean }) {
  const [messages, setMessages] = useState<LocalMessage[]>(
    initialMessages.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })),
  );
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleSend() {
    const content = input.trim();
    if (!content || isPending) return;
    setInput("");
    const userMsg: LocalMessage = { id: crypto.randomUUID(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);

    startTransition(async () => {
      const result = await sendMentorMessageAction(content);
      if (result.error) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: result.error!, failed: true },
        ]);
      } else if (result.reply) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: result.reply! }]);
      }
      queueMicrotask(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    });
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles className="h-4 w-4 text-brand" />
        <p className="text-sm font-medium">AI Nutrition &amp; Health Mentor</p>
      </div>

      {!hasKey ? (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span>
            GEMINI_API_KEY isn&apos;t configured yet, so the AI Mentor can&apos;t respond right now. Set it in your
            environment variables to enable chat.
          </span>
        </div>
      ) : null}

      <div ref={scrollRef} className="max-h-80 min-h-32 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask about your training, describe a meal to log it, or ask a health question.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <p
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  m.role === "user"
                    ? "bg-brand text-primary-foreground"
                    : m.failed
                      ? "bg-danger/10 text-danger"
                      : "bg-muted text-foreground",
                )}
              >
                {m.content}
              </p>
            </div>
          ))
        )}
        {isPending ? <p className="text-xs text-muted-foreground">Mentor is thinking…</p> : null}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={hasKey ? "I had 2 eggs and toast for breakfast…" : "AI Mentor not configured"}
          disabled={!hasKey || isPending}
        />
        <Button size="sm" onClick={handleSend} disabled={!hasKey || isPending || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
