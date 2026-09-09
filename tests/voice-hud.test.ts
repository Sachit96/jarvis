import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interpretConfirmation, REPROMPT } from "../lib/voice/confirmation.ts";

/**
 * Voice HUD states and spoken confirmation.
 *
 * The state test exists because waiting_for_confirmation was DECLARED in the
 * union and given a label, but nothing ever set it — so asking "shall I go
 * ahead?" looked identical to any other reply, with no visible sign the turn
 * was blocked on an answer. A declared-but-unreachable state is invisible to
 * typecheck and to every runtime test, so it is checked here at the source.
 */

const CLIENT = readFileSync("components/voice/voice-mode-client.tsx", "utf8");
const HUD = readFileSync("components/voice/hud-panels.tsx", "utf8");

function declaredStates(): string[] {
  const block = HUD.slice(HUD.indexOf("export type VoiceStatusMode"), HUD.indexOf("function money"));
  return [...block.matchAll(/\|\s*"([a-z_]+)"/g)].map((m) => m[1]);
}

describe("voice HUD states", () => {
  test("every state the user asked for exists", () => {
    const required = [
      "idle", "listening", "transcribing", "thinking",
      "executing", "waiting_for_confirmation", "speaking", "error",
    ];
    const declared = declaredStates();
    for (const state of required) assert.ok(declared.includes(state), `${state} is missing from VoiceStatusMode`);
  });

  test("no declared state is unreachable", () => {
    // Reachable means: set with setMode, passed as a landing state to
    // speakReply, or derived for display. Anything else is decoration.
    for (const state of declaredStates()) {
      const reachable =
        CLIENT.includes(`setMode("${state}")`) ||
        CLIENT.includes(`"${state}")`) ||
        CLIENT.includes(`? "${state}"`);
      assert.ok(reachable, `VoiceStatusMode "${state}" is declared but never reached`);
    }
  });

  test("every state has a human-readable label", () => {
    // The HUD must never fall through to an undefined label. Scoped to the
    // STATUS_LABEL block — searching the whole file matches prose in comments.
    const start = HUD.indexOf("const STATUS_LABEL");
    const block = HUD.slice(start, HUD.indexOf("};", start));
    for (const state of declaredStates()) {
      // Either quote style: idle's label contains a double quote, so it is
      // written with single quotes.
      assert.match(block, new RegExp(`\\b${state}: ["']`), `${state} has no STATUS_LABEL`);
    }
  });

  test("the confirmation question lands in waiting_for_confirmation", () => {
    assert.match(CLIENT, /Shall I go ahead\?`, "waiting_for_confirmation"\)/);
  });

  test("an ambiguous answer re-prompts and stays blocked", () => {
    assert.match(CLIENT, /speakReply\(REPROMPT, "waiting_for_confirmation"\)/);
  });
});

describe("spoken confirmation is strict", () => {
  test("the accepted phrases are accepted", () => {
    for (const phrase of ["yes", "send it", "confirm", "do it", "go ahead", "yep", "approve"]) {
      assert.equal(interpretConfirmation(phrase), "confirmed", phrase);
    }
  });

  test("the cancelling phrases cancel", () => {
    for (const phrase of ["no", "cancel", "stop", "never mind", "abort", "don't"]) {
      assert.equal(interpretConfirmation(phrase), "declined", phrase);
    }
  });

  test("anything short of a clear yes does NOT execute", () => {
    // The safety-critical case: a high-risk action must never run on a
    // half-answer, and there is a re-prompt to fall back on.
    for (const phrase of ["maybe", "probably", "okay I guess", "i guess so", "sure why not", "hmm", ""]) {
      assert.equal(interpretConfirmation(phrase), "ambiguous", JSON.stringify(phrase));
    }
    assert.ok(REPROMPT.length > 0);
  });

  test("a self-contradicting answer is ambiguous, not confirmed", () => {
    assert.equal(interpretConfirmation("no wait yes"), "ambiguous");
    assert.equal(interpretConfirmation("yes actually no"), "ambiguous");
  });

  test("a word merely containing 'no' is not a refusal", () => {
    // "notes", "nothing", "November" must not read as "no".
    assert.notEqual(interpretConfirmation("add that to my notes"), "declined");
  });
});
