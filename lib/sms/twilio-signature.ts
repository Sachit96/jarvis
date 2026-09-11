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
/**
 * The URL Twilio actually signed.
 *
 * Twilio computes its HMAC over the public URL it POSTed to. Behind
 * Netlify's proxy, `request.url` is the INTERNAL one — a different host,
 * and usually http rather than https — so hashing it produces a signature
 * that cannot match, every request is rejected, and the webhook answers
 * with empty TwiML. From the phone that looks exactly like "Jarvis ignores
 * my texts", which is the symptom reported.
 *
 * `x-forwarded-host` is the host the client asked for; `x-forwarded-proto`
 * the scheme it used. Both are set by the platform edge and are the only
 * record of what Twilio saw. Falls back to request.url when neither is
 * present (local dev, direct hits), where request.url IS the public URL.
 */
export function twilioRequestUrl(request: { url: string; headers: Headers }): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const host = forwardedHost.split(",")[0].trim();
    // hostname + port, not `host`: the WHATWG host setter leaves the
    // existing port in place when the value it is given has none, so
    // assigning "jarvis.example.com" to a URL parsed from
    // "http://127.0.0.1:8888/…" yields "jarvis.example.com:8888" — a URL
    // Twilio never signed, which is the bug this whole function exists to
    // fix, reintroduced one line lower down.
    const [hostname, port] = host.split(":");
    url.hostname = hostname;
    url.port = port ?? "";
  }
  if (forwardedProto) url.protocol = `${forwardedProto.split(",")[0].trim()}:`;

  return url.toString();
}

/**
 * Compare two phone numbers by their digits.
 *
 * Twilio always sends E.164, "+1" then ten digits. The same number written
 * into the environment without the plus, or with the punctuation a person
 * would type, fails a strict === against it — and the route's
 * response to an unrecognised sender is deliberate silence, so the
 * mismatch produces no error anywhere. Only a `rejected_sender` row in
 * sms_messages, which nothing surfaces.
 *
 * A leading country code is optional on both sides: a 10-digit North
 * American number matches its own 11-digit form.
 */
export function samePhoneNumber(a: string, b: string): boolean {
  const digits = (s: string) => s.replace(/\D/g, "");
  const x = digits(a);
  const y = digits(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const trim = (s: string) => (s.length === 11 && s.startsWith("1") ? s.slice(1) : s);
  return trim(x) === trim(y);
}

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
