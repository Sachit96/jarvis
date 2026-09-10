"use client";

import { useState, useTransition } from "react";
import { Layers, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { getDueFlashcardsAction, reviewFlashcardAction } from "@/actions/uni-flashcard-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type DueCard = Awaited<ReturnType<typeof getDueFlashcardsAction>>[number];

/**
 * What spaced repetition says to review right now, across every course.
 *
 * Reviewing a card has always pushed its next_review date out, but nothing
 * ever read that schedule back — cards fell due and sat there, and studying
 * meant remembering which material to open. This is the other half of the
 * loop.
 *
 * The count is loaded on demand rather than server-rendered so /uni does not
 * pay two extra queries on every visit for a card most days shows zero.
 */
export function DueFlashcardsCard() {
  const [cards, setCards] = useState<DueCard[] | null>(null);
  const [studying, setStudying] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isPending, startTransition] = useTransition();

  function load(thenStudy: boolean) {
    startTransition(async () => {
      const due = await getDueFlashcardsAction();
      setCards(due);
      setIndex(0);
      setFlipped(false);
      if (thenStudy && due.length > 0) setStudying(true);
    });
  }

  function answer(correct: boolean) {
    const card = cards?.[index];
    if (!card) return;
    startTransition(() => reviewFlashcardAction(card.id, correct));
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  const current = cards?.[index];
  const remaining = cards ? Math.max(0, cards.length - index) : 0;

  return (
    <>
      <Card padding="slotted">
        <div className="px-(--card-spacing)">
          <SectionHeader
            title="Review queue"
            description="Flashcards whose spaced-repetition interval has come round."
            action={
              <Button
                size="sm"
                variant={cards && cards.length > 0 ? "default" : "secondary"}
                disabled={isPending}
                onClick={() => load(true)}
              >
                {isPending ? "Checking…" : cards === null ? "Check due" : "Study"}
              </Button>
            }
          />
        </div>

        <div className="px-(--card-spacing)">
          {cards === null ? (
            <EmptyState
              compact
              icon={Layers}
              title="Not checked yet"
              description="Check what's due and study straight through it — cards you get right move further out, cards you miss come back tomorrow."
            />
          ) : cards.length === 0 ? (
            <EmptyState
              compact
              icon={RotateCcw}
              title="Nothing due"
              description="Every card you have generated is scheduled further out. Add materials to a course to generate more."
            />
          ) : (
            <p className="text-body text-foreground-secondary">
              <span className="tabular font-display text-metric text-foreground">{remaining}</span>{" "}
              {remaining === 1 ? "card" : "cards"} due now.
            </p>
          )}
        </div>
      </Card>

      <Dialog open={studying} onOpenChange={setStudying}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {current ? `Review · ${remaining} left` : "Review complete"}
            </DialogTitle>
          </DialogHeader>

          {current ? (
            <div className="space-y-4">
              {current.courseCode ? (
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: current.courseColor ?? "var(--brand)" }}
                  />
                  <span className="eyebrow">{current.courseCode}</span>
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="surface surface-interactive w-full p-6 text-left"
              >
                <p className="text-body text-foreground">{current.question}</p>
                {flipped ? (
                  <p className="mt-4 border-t border-white/[0.07] pt-4 text-body text-foreground-secondary">
                    {current.answer}
                  </p>
                ) : (
                  <p className="mt-4 text-caption text-foreground-tertiary">Tap to reveal</p>
                )}
              </button>

              {/* Grading before revealing the answer is how a review session
                  becomes meaningless, so the buttons wait for the flip. */}
              {flipped ? (
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1 gap-1.5" onClick={() => answer(false)}>
                    <ThumbsDown className="size-4" /> Missed
                  </Button>
                  <Button className="flex-1 gap-1.5" onClick={() => answer(true)}>
                    <ThumbsUp className="size-4" /> Got it
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <EmptyState
                compact
                icon={RotateCcw}
                title="Queue cleared"
                description="Everything due has been reviewed. Each card comes back on its own schedule."
              />
              <Button variant="secondary" className="w-full" onClick={() => setStudying(false)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
