import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getIntegrationStatuses,
  getIntegrationStatus,
  isUsable,
  describeUnusable,
} from "../lib/integrations/status.ts";
import { getBrightspaceStatus, getAuthorizationUrl } from "../lib/integrations/brightspace/index.ts";

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

describe("brightspace adapter", () => {
  test("with no app registered it needs configuration and offers no auth URL", () => {
    assert.equal(getBrightspaceStatus().state, "configuration_required");
    // A half-formed authorize URL would send the user to a broken page.
    assert.equal(getAuthorizationUrl("https://example.com/cb"), null);
  });

  test("a registered app is disconnected — configured, but not yet authorised", () => {
    process.env.BRIGHTSPACE_HOST = "https://lms.example.edu";
    process.env.BRIGHTSPACE_CLIENT_ID = "abc";
    process.env.BRIGHTSPACE_CLIENT_SECRET = "shh";

    const status = getBrightspaceStatus();
    assert.equal(status.state, "disconnected");
    assert.match(status.actionHint ?? "", /authorise/i);
  });

  test("the authorization URL is OAuth code flow, read-only, and takes no password", () => {
    process.env.BRIGHTSPACE_HOST = "https://lms.example.edu";
    process.env.BRIGHTSPACE_CLIENT_ID = "abc";
    process.env.BRIGHTSPACE_CLIENT_SECRET = "shh";

    const url = getAuthorizationUrl("https://jarvis.example.com/callback");
    assert.ok(url);
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.equal(parsed.searchParams.get("client_id"), "abc");
    assert.equal(parsed.searchParams.get("redirect_uri"), "https://jarvis.example.com/callback");
    // Read-only scopes: this integration reads coursework, never submits.
    assert.match(parsed.searchParams.get("scope") ?? "", /read/);
    // The secret must never ride along in a front-channel redirect.
    assert.doesNotMatch(url, /shh/);
    // And there is no password parameter anywhere in this flow.
    assert.equal(parsed.searchParams.get("password"), null);
  });

  test("brightspace is not usable, so callers must not treat it as a data source", () => {
    assert.equal(isUsable(getBrightspaceStatus().state), false);
  });
});
