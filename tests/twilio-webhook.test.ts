import { test } from "node:test";
import assert from "node:assert/strict";
import { samePhoneNumber, twilioRequestUrl } from "../lib/sms/twilio-signature.ts";

/**
 * The numbers here are 555-01xx, the block reserved for fiction in the North
 * American plan. Deliberately not the real one: Netlify's secret scanner
 * compares the VALUES of the site's environment variables against every file
 * in the repo, so a real TWILIO_PHONE_NUMBER written into a test fails the
 * deploy — which is exactly what it did.
 */
test("owner number matching", async (t) => {
  await t.test("matches E.164 against the same digits without a plus", () => {
    // Twilio always sends "+1...". The env var is typed by a person.
    assert.equal(samePhoneNumber("+12025550123", "12025550123"), true);
  });

  await t.test("matches a number written the way a person types it", () => {
    assert.equal(samePhoneNumber("+12025550123", "(202) 555-0123"), true);
    assert.equal(samePhoneNumber("+12025550123", "202-555-0123"), true);
  });

  await t.test("treats the North American country code as optional", () => {
    assert.equal(samePhoneNumber("2025550123", "+12025550123"), true);
  });

  await t.test("still rejects a genuinely different number", () => {
    assert.equal(samePhoneNumber("+12025550123", "+12025550124"), false);
    assert.equal(samePhoneNumber("+12025550123", "+442025550123"), false);
  });

  await t.test("rejects empty input rather than matching everything", () => {
    assert.equal(samePhoneNumber("", "+12025550123"), false);
    assert.equal(samePhoneNumber("+12025550123", "   "), false);
  });
});

test("the URL Twilio signed", async (t) => {
  const req = (url: string, headers: Record<string, string> = {}) => ({
    url,
    headers: new Headers(headers),
  });

  await t.test("rebuilds the public URL from forwarded headers", () => {
    assert.equal(
      twilioRequestUrl(
        req("http://127.0.0.1:8888/api/sms/webhook", {
          "x-forwarded-host": "jarvis.example.com",
          "x-forwarded-proto": "https",
        }),
      ),
      "https://jarvis.example.com/api/sms/webhook",
    );
  });

  await t.test("takes the first hop when a header carries a list", () => {
    assert.equal(
      twilioRequestUrl(
        req("http://internal/api/sms/webhook", {
          "x-forwarded-host": "jarvis.example.com, internal-lb",
          "x-forwarded-proto": "https, http",
        }),
      ),
      "https://jarvis.example.com/api/sms/webhook",
    );
  });

  await t.test("leaves the URL alone with no proxy in front", () => {
    assert.equal(
      twilioRequestUrl(req("https://jarvis.example.com/api/sms/webhook")),
      "https://jarvis.example.com/api/sms/webhook",
    );
  });
});
