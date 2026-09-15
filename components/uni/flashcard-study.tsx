"use client";

import { useState, useTransition } from "react";
import { Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { generateFlashcardsAction, reviewFlashcardAction, getFlashcardsForMaterialAction } from "@/actions/uni-flashcard-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Database } from "@/lib/supabase/database.types";

type Flashcard = Database["public"]["Tables"]["uni_flashcards"]["Row"];

export function FlashcardStudy({ materialId, courseId }: { materialId: string; courseId: string }) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function load() {
    startTransition(async () => {
      const existing = await getFlashcardsForMaterialAction(materialId);
      setCards(existing);
      setIndex(0);
      setFlipped(false);
    });
  }

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await generateFlashcardsAction(materialId, courseId);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      load();
    });
  }

  function handleAnswer(correct: boolean) {
    const card = cards[index];
    if (!card) return;
    startTransition(() => reviewFlashcardAction(card.id, correct));
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  const current = cards[index];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <DialogTrigger
        render={
          <button type="button" className="text-muted-foreground/60 hover:text-brand" aria-label="Study flashcards">
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Flashcards</DialogTitle>
        </DialogHeader>

        {error ? <p className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

        {cards.length === 0 ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">No flashcards yet for this material.</p>
            <Button onClick={handleGenerate} disabled={isPending} className="gap-1.5">
              <Sparkles className="h-4 w-4" /> {isPending ? "Generating…" : "Generate flashcards"}
            </Button>
          </div>
        ) : !current ? (
          <div className="space-y-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">Done — no more cards in this session.</p>
            <Button variant="secondary" size="sm" onClick={() => { setIndex(0); setFlipped(false); }}>
              Review again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="flex min-h-[140px] w-full items-center justify-center rounded-xl bg-white/[0.04] p-6 text-center text-sm text-foreground transition-colors hover:bg-white/[0.06]"
            >
              {flipped ? current.answer : current.question}
            </button>
            <p className="text-center text-xs text-muted-foreground">{flipped ? "Answer" : "Question"} · {index + 1}/{cards.length} · tap to flip</p>
            {flipped ? (
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1 gap-1.5" onClick={() => handleAnswer(false)}>
                  <ThumbsDown className="h-4 w-4" /> Missed it
                </Button>
                <Button className="flex-1 gap-1.5" onClick={() => handleAnswer(true)}>
                  <ThumbsUp className="h-4 w-4" /> Got it
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
