"use client";

import { useRef, useState, useTransition } from "react";
import { Send, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sendGeneralMentorMessageAction } from "@/actions/mentor-actions";
import type { Database } from "@/lib/supabase/database.types";

type MentorMessage = Database["public"]["Tables"]["mentor_messages"]["Row"];

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
}

export function MentorChatWidget({ initialMessages, hasKey }: { initialMessages: MentorMessage[]; hasKey: boolean }) {
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
      const result = await sendGeneralMentorMessageAction(content);
      if (result.error) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: result.error!, failed: true },
        ]);
      } else if (result.reply) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: result.reply! }]);
      }
      queueMicrotask(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    });
  }

  return (
    <div className="flex flex-col rounded-2xl bg-card ring-1 ring-border">
      <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-5 py-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15">
          <Sparkles className="h-4 w-4 text-brand" />
        </span>
        <p className="text-body font-medium">Ask your Mentor</p>
      </div>

      {!hasKey ? (
        <Alert className="mx-5 mt-3 w-auto border-warn/30 bg-warn/10 text-warn">
          <TriangleAlert />
          <AlertDescription className="text-warn/90">
            GEMINI_API_KEY isn&apos;t configured yet, so the AI Mentor can&apos;t respond right now.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Sized against the viewport, not a fixed 20rem. The widget sits in a
          sticky column beside the brief now, so it should use the height the
          column actually has; a fixed short box left most of that column
          empty and made the transcript scroll after three exchanges. */}
      <div ref={scrollRef} className="min-h-32 space-y-3 overflow-y-auto p-5 xl:max-h-[calc(100vh-19rem)]">
        {messages.length === 0 ? (
          <p className="text-body text-muted-foreground">
            Ask about your tasks, habits, finances, health, or pipeline — the Mentor sees your whole dashboard.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex animate-in fade-in-0 slide-in-from-bottom-1 duration-300", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <p
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-body",
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
        {isPending ? (
          <p className="text-label text-muted-foreground after:inline-block after:animate-pulse after:content-['…']">
            Mentor is thinking
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-white/[0.08] p-3.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={hasKey ? "How's my week looking?" : "AI Mentor not configured"}
          disabled={!hasKey || isPending}
        />
        <Button size="sm" onClick={handleSend} disabled={!hasKey || isPending || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
