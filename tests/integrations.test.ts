import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getIntegrationStatuses,
  getIntegrationStatus,
  isUsable,
  describeUnusable,
} from "../lib/integrations/status.ts";

/**
 * Status is read from process.env at call time rather than captured at
 * module load, which is what lets these tests set and clear variables around
 * each case. That is also the behaviour the app needs: a key added to the
 * environment takes effect on the next request, not the next deploy.
 */

const TOUCHED = [
  "HEVY_API_KEY",
  "GEMINI_API_KEY",
  "BRIGHTSPACE_HOST",
  "BRIGHTSPACE_CLIENT_ID",
  "BRIGHTSPACE_CLIENT_SECRET",
];

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of TOUCHED) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of TOUCHED) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("integration status", () => {
  test("every integration reports a state and an actionable message", () => {
    for (const status of getIntegrationStatuses()) {
      assert.ok(status.label.length > 0, `${status.id} needs a label`);
      assert.ok(status.message.length > 0, `${status.id} needs a message`);
    }
  });

  test("a missing key reads as configuration_required, not disconnected", () => {
    // The distinction is the point: "you never set this up" is a different
    // instruction to the user than "this is deliberately off".
    const hevy = getIntegrationStatus("hevy");
    assert.equal(hevy.state, "configuration_required");
    assert.ok(hevy.actionHint, "should tell the user what to set");
    assert.ok(hevy.requires?.includes("HEVY_API_KEY"));
  });

  test("a present key flips the state to connected", () => {
    process.env.HEVY_API_KEY = "test-key";
    assert.equal(getIntegrationStatus("hevy").state, "connected");
  });

  test("status never leaks a credential value", () => {
    process.env.HEVY_API_KEY = "super-secret-value";
    const serialised = JSON.stringify(getIntegrationStatuses());
    assert.doesNotMatch(serialised, /super-secret-value/);
  });

  test("isUsable gates on whether asking is worthwhile", () => {
    assert.equal(isUsable("connected"), true);
    assert.equal(isUsable("syncing"), true);
    for (const state of ["disconnected", "configuration_required", "error", "unavailable"] as const) {
      assert.equal(isUsable(state), false, `${state} should not be usable`);
    }
  });

  test("describeUnusable combines the message and the action", () => {
    const text = describeUnusable(getIntegrationStatus("hevy"));
    assert.match(text, /not connected/i);
    assert.match(text, /HEVY_API_KEY/);
  });
});

