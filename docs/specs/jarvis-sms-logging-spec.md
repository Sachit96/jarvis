# JARVIS — SMS logging via Twilio

Text a number, JARVIS parses what you meant, logs it to the right table, texts back a confirmation. "went to the gym" → workout logged. "had a chicken bowl for lunch" → nutrition logged. "finished the pipeline task" → task completed.

## Cost reality — read before building

Twilio's free trial gives starting credit, but it is **not permanently free** like your Gemini setup. After the trial: a phone number runs roughly $1/month, plus a small per-message cost (low cents, US numbers). Reuses your existing Gemini tiering for the parsing itself, which stays free. Flagging this now so it's not a surprise later — same reasoning as the Gemini billing situation earlier this session.

## Setup (you do this part)

1. twilio.com → sign up, verify your own phone number
2. Get a trial phone number with SMS capability
3. Note the **Account SID** and **Auth Token** from the console
4. Don't paste either into this chat — same rule as every other credential this session. Put them straight into `.env.local`

## Env vars

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SACHIT_PHONE_NUMBER=   # your own number, E.164 format e.g. +14165551234
```

## Build

### 1. Webhook endpoint

`app/api/sms/webhook/route.ts` — Twilio POSTs here (form-encoded, not JSON) whenever a text arrives. Set this URL in the Twilio console once it's deployed.

**Security, both required, not optional:**
- Validate the `X-Twilio-Signature` header against `TWILIO_AUTH_TOKEN` using Twilio's documented HMAC scheme. Reject anything that doesn't match — this proves the request actually came from Twilio, not someone who found the URL.
- Check the `From` number against `SACHIT_PHONE_NUMBER`. If it doesn't match, don't process it — just return an empty TwiML response. This is a single-user tool; nobody else's texts should ever write to your data.

### 2. Parsing — reuse the existing tool-calling pattern

This is the same shape as the nutrition chatbot's `log_nutrition_entry` function-calling loop, generalized to route across domains. Define multiple tool declarations and let Gemini pick:

- `log_workout` (workouts/workout_sets — keep it minimal for SMS: exercise name, sets/reps if mentioned, otherwise just log a session)
- `log_nutrition` (reuse the existing tool exactly as built for the nutrition chatbot)
- `complete_task` (match against open tasks by fuzzy title match; if nothing matches confidently, don't guess — see fallback below)
- `add_journal_entry` (freeform text that doesn't fit the above)

Per Phase 0 findings from earlier this session, tool calling is reliable on the Gemma tier — route this there, not Flash-Lite. It's exactly the kind of high-frequency, simple-schema call Gemma is good for.

**Fallback, this matters:** if the model isn't confident which tool applies (ambiguous text, or it doesn't match anything), do not guess. Fall back to `add_journal_entry` with the raw text and say so in the reply — "Wasn't sure what to log, saved as a journal note." A wrong guess silently logged as a workout when you meant something else is worse than an honest "I wasn't sure."

### 3. Reply

Respond with TwiML containing a one-line confirmation of what got logged — mirror the nutrition chatbot's existing confirmation style ("Logged: chest workout, 3 exercises" / "Logged: chicken bowl, ~650 cal"). Twilio sends this back as the reply text automatically; no separate outbound API call needed for the reply itself.

### 4. Rate/abuse guard

Even with the phone-number allowlist, add a simple check: no more than ~20 processed messages per hour. Protects against a stuck loop or an accidental spam-text scenario burning through Gemma's daily budget for no reason.

## Verification

- Text the number from your real phone, confirm the webhook fires (check logs)
- Confirm signature validation actually rejects a forged request (curl the endpoint directly without a valid signature, expect it to no-op)
- Confirm a text from a different number is silently ignored
- Test all four tool paths for real: a workout mention, a meal mention, a task-completion mention, and something ambiguous — confirm the ambiguous one falls back to journal rather than misfiring
- Confirm the reply SMS actually arrives and matches what was logged in the DB
