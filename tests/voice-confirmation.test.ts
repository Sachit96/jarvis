import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interpretConfirmation } from "../lib/voice/confirmation.ts";

/**
 * This gates deletions and outbound messages over a channel that mishears
 * things, so the cases that matter most are the ones where it must NOT
 * return "confirmed".
 */

describe("voice confirmation", () => {
  test("accepts the explicit affirmatives", () => {
    for (const phrase of [
      "yes",
      "Yes.",
      "yeah",
      "yep",
      "confirm",
      "do it",
      "go ahead",
      "send it",
      "approve",
      "affirmative",
      "yes please do it",
    ]) {
      assert.equal(interpretConfirmation(phrase), "confirmed", `"${phrase}" should confirm`);
    }
  });

  test("accepts the explicit negatives", () => {
    for (const phrase of ["no", "No!", "nope", "cancel", "stop", "don't", "never mind", "abort"]) {
      assert.equal(interpretConfirmation(phrase), "declined", `"${phrase}" should decline`);
    }
  });

  test("a contradictory utterance is ambiguous, never a yes", () => {
    // The user corrected themselves, or the recogniser merged two
    // utterances. Acting on either reading could delete something.
    for (const phrase of [
      "no wait yes",
      "yes actually no",
      "yeah no",
      "no no yes",
      "cancel that, yes do it",
    ]) {
      assert.equal(interpretConfirmation(phrase), "ambiguous", `"${phrase}" must re-ask`);
    }
  });

  test("does not match a signal word inside another word", () => {
    // Substring matching would read "no" out of "notes" and "yes" out of
    // "yesterday" — both plausible things to say to an assistant.
    assert.equal(interpretConfirmation("open my notes"), "ambiguous");
    assert.equal(interpretConfirmation("what did I do yesterday"), "ambiguous");
    assert.equal(interpretConfirmation("undo iteration three"), "ambiguous");
    assert.equal(interpretConfirmation("nothing"), "ambiguous");
  });

  test("unrecognised speech is ambiguous, not a decline", () => {
    // Treating a misheard phrase as cancellation is safe for the data but
    // teaches the user that JARVIS ignores them.
    for (const phrase of ["what", "hmm", "tell me more", "", "   ", "the weather is nice"]) {
      assert.equal(interpretConfirmation(phrase), "ambiguous", `"${phrase}" should re-ask`);
    }
  });

  test("ignores surrounding punctuation and casing", () => {
    assert.equal(interpretConfirmation("  YES!!  "), "confirmed");
    assert.equal(interpretConfirmation("Cancel, please."), "declined");
  });

  test("keeps apostrophes, which don't depends on", () => {
    assert.equal(interpretConfirmation("don't"), "declined");
    assert.equal(interpretConfirmation("do not"), "declined");
  });
});

describe("one operator, shared by every surface", () => {
  /**
   * A source-level check rather than a behavioural one, because the property
   * being protected is architectural: Voice and the Mentor chat must enter
   * the SAME operator. Voice previously called runGeneralMentorChat, which
   * has no tools, so the same assistant could do more when typed to than
   * when spoken to. Nothing at runtime would catch that regression — both
   * paths would still "work".
   */
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

  test("voice and mentor chat both route through runAgentTurn", () => {
    for (const file of ["../actions/voice-actions.ts", "../actions/mentor-actions.ts"]) {
      assert.match(read(file), /runAgentTurn/, `${file} must use the shared operator`);
    }
  });

  test("voice no longer imports the tool-less mentor chat path", () => {
    // Matches an import specifically, not any mention: the doc comment in
    // that file explains why voice moved off runGeneralMentorChat, and that
    // explanation is worth keeping.
    const source = read("../actions/voice-actions.ts");
    const imports = source.match(/^import[\s\S]*?from\s+"[^"]+";$/gm) ?? [];
    assert.ok(
      !imports.some((line) => line.includes("runGeneralMentorChat")),
      "voice-actions must not import runGeneralMentorChat",
    );
  });

  test("voice passes confirmedCall through rather than deciding for itself", () => {
    // The action must forward an approval, not synthesise one — the gate
    // lives in the executor and voice only relays the user's answer.
    assert.match(read("../actions/voice-actions.ts"), /confirmedCall/);
  });
});
