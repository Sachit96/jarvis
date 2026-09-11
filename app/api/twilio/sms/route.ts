/**
 * The webhook URL people actually configure.
 *
 * The implementation lives at /api/sms/webhook and always has. Twilio's
 * console, though, is usually pointed at a path shaped like this one, and a
 * webhook aimed at a route that does not exist returns 404 — which Twilio
 * reports as an application error and the phone experiences as silence.
 *
 * A re-export rather than a redirect: Twilio signs the exact URL it POSTs
 * to, and a 307 would make the handler verify the signature against a
 * different path than the one that was signed, turning a working webhook
 * into a rejected one. Both paths are carved out of the site's Basic Auth
 * gate in proxy.ts for the same reason.
 */
export { POST } from "@/app/api/sms/webhook/route";
