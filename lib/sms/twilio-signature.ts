import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio's request-validation algorithm, implemented against Twilio's own
 * published spec (twilio.com/docs/usage/security#validating-requests) —
 * NOT verified live tonight. No Twilio account/keys exist yet to test
 * against (per the work order: "No new API keys exist tonight"). This
 * needs a real end-to-end test — a live webhook hit with a real
 * X-Twilio-Signature header — the first time TWILIO_AUTH_TOKEN is
 * actually set; flagged explicitly in the morning report as something
 * built to spec but not exercised against the real service.
 *
 * For a POST with form-encoded params: HMAC-SHA1(authToken, url + sorted
 * "key"+"value" pairs concatenated with no separators), base64-encoded,
 * compared to the X-Twilio-Signature header.
 */
export function validateTwilioSignature(authToken: string, signature: string, url: string, params: Record<string, string>): boolean {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(signature);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

/** Minimal TwiML for a one-line text reply — the only response shape this webhook ever needs to send. */
export function twiMlReply(message: string): string {
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

export function emptyTwiMl(): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
}
