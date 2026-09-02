# JARVIS — Identity, Voice Mode, and outstanding fixes

Three work orders. A and B are small and unblock the personality side; C is the big one.

---

# WORK ORDER A — Finish the identity work (never got done)

This was specced two rounds ago and skipped. Do it now.

1. **Sidebar footer** currently reads "JARVIS / Personal workspace" with a generated "J" avatar. Change to:
   - Name: **Sachit**
   - Secondary line: **Personal workspace**
   - Avatar: `public/avatar.jpg`, 32px circle, `object-cover`, `border-white/10` ring, `onError` fallback to the letter "S" on a solid background (never a broken-image icon)
   - Source this from one config object (`lib/user.ts` exporting `{ name, workspace, avatar }`), not a hardcoded string. Grep for anywhere else the app renders a user name or initial and point it at the same source.
   - Keep the sidebar *header* as "JARVIS / Personal OS" — that's the product, not the user.
   - If `public/avatar.jpg` doesn't exist yet, build it anyway and tell me — I'll drop the file in.

2. **The floating "Rendering .." pill** overlapping the sidebar footer: if it's a dev indicator, gate it behind `NODE_ENV === "development"`. If it's a real loading state, move it out of the sidebar's stacking context.

---

# WORK ORDER B — JARVIS knows who he is

Right now the assistant has no persona. It should know its name is JARVIS, that it works for Sachit, and what it's for.

## Where the identity lives

Not hardcoded in a prompt string scattered across files. Create **one** exported persona module (`lib/ai/persona.ts`) that composes the system instruction, and have every Gemini call — mentor chat, daily brief, weekly review, nutrition chat — build its system instruction from it.

The persona must include:

- **Name and role:** "You are JARVIS, Sachit's personal operating system and chief of staff. You have access to his business pipeline, finances, health data, goals, habits, and long-term memory."
- **Who Sachit is:** pull from the `memory_entries` table where `type = 'fact'` or `type = 'preference'`, plus any entry with `pinned = true`. This is what the memory module was *for* — wire it in. If memory is empty, degrade gracefully to the base persona.
- **Tone:** direct, concise, no filler or hedging. Speaks to Sachit like a competent operator, not a customer service bot. Never opens with "Great question!" or similar.
- **Honesty rule:** never invent numbers. If asked about revenue, pipeline, or health metrics, use the actual data passed into context — if a number isn't there, say it isn't tracked yet rather than guessing.
- **Self-reference:** answers to "JARVIS" and refers to itself as JARVIS.

Add a seed `memory_entries` row of type `fact`: title "Identity", body describing Sachit (name, that he runs a white-label marketing agency, based in Toronto) — but only insert facts I've actually told you. Don't invent biography.

## Verification

Ask it "who are you?" and "what's my name?" in `/mentor` and confirm both answers are right and come from the persona/memory, not from a hardcoded reply.

---

# WORK ORDER C — Voice Mode

An ambient full-screen mode: wake word, live transcript, spoken replies, and an audio-reactive centerpiece, with real JARVIS data in the corners. Reference screenshots attached — match the *feel* (dark, glowing, data-dense corners, one big living centerpiece), not the specific branding.

## Technology — all free, no new API keys

| Function | Use | Cost |
|---|---|---|
| Speech → text | Web Speech API (`webkitSpeechRecognition`) | Free, browser-native |
| Wake word | Continuous recognition + phrase match on interim results | Free |
| Text → speech | Web Speech API (`speechSynthesis`) | Free, browser-native |
| Audio reactivity | Web Audio API `AnalyserNode` on the mic stream | Free |
| The actual reply | Existing Gemini mentor provider | Only cost in the loop |

Do **not** add ElevenLabs, Whisper, Picovoice, or any paid/keyed service. If browser TTS quality is poor, that's an accepted tradeoff for now — build it behind a thin `speak()` interface so it can be swapped later without touching the UI.

## Gotchas that will make this feel broken if you skip them

These are the whole difficulty of the feature. Handle each explicitly:

1. **Continuous recognition self-terminates.** Chrome stops `SpeechRecognition` after a stretch of silence even with `continuous = true`. You must re-start it in `onend`, with a guard so a deliberate stop doesn't immediately restart. Without this, wake-word listening silently dies after ~30 seconds and the whole feature appears broken.

2. **TTS feeds back into the mic.** When JARVIS speaks, the microphone hears it and recognizes its own output as user speech, causing an infinite loop. You must stop/pause recognition before `speechSynthesis.speak()` and resume it only in the utterance's `onend`. This is the single most important detail in this work order.

3. **`speechSynthesis.getVoices()` is empty on first call.** It populates asynchronously — listen for `voiceschanged` before selecting a voice. Pick a deep/neutral English voice if available, fall back to default.

4. **`speechSynthesis` gives you no analysable audio stream.** You cannot drive the orb from TTS output amplitude. Drive it from the mic analyser while *listening*, and from a synthetic envelope (derived from utterance length + a noise function) while *speaking*. Don't spend time trying to tap the TTS output.

5. **Mic requires a secure context.** Works on `localhost` and HTTPS only. Fine in dev, fine on Netlify.

6. **The mic stays hot during wake-word mode.** This is a real privacy consideration and Chrome sends audio to Google's servers for recognition. Show a persistent, unmistakable indicator when listening, and make the off switch obvious and one click. Voice mode must default to **off** and require an explicit user action to start — never auto-start on page load.

7. **Free-tier rate limits.** Voice makes it trivially easy to fire many Gemini calls quickly. Add a client-side guard: ignore a new request while one is in flight, and on a 429 speak a short "rate limited, one moment" and back off rather than failing silently.

8. **Interim vs final results.** Show interim transcript live (greyed) so it feels responsive, but only send the **final** result to Gemini. Sending interims will fire multiple calls per sentence.

## The interaction model

- Voice mode is a route (`/voice`) or a full-screen overlay toggled from anywhere with a keyboard shortcut and a sidebar button. Escape exits.
- **Idle:** orb breathes slowly. Status reads `LISTENING FOR "HEY JARVIS"`.
- **Wake detected:** orb brightens and tightens, status → `LISTENING`, transcript area goes live.
- **Thinking:** orb churns faster, status → `THINKING`, transcript freezes showing what was heard.
- **Speaking:** orb pulses with the synthetic envelope, reply text streams in below the transcript, status → `SPEAKING`.
- **Barge-in:** if the user speaks while JARVIS is talking, cancel `speechSynthesis` immediately and go back to listening. (Requires resuming recognition carefully — see gotcha 2.)
- A **push-to-talk** fallback: hold spacebar to talk, no wake word needed. Build this first, actually — it's simpler and it's how you'll debug everything else.

## The visual

**Centerpiece:** a particle sphere. Three.js `Points` with a few thousand vertices on a sphere, displaced by simplex noise, with the noise amplitude and rotation speed driven by the current audio level. Additive blending, cyan/blue palette matching the existing JARVIS accent. If Three.js perf is bad on the target display, a 2D canvas particle field is an acceptable fallback — say so if you go that way.

Do not reproduce the specific branding, wordmarks, or layout of the reference screenshots — take the aesthetic direction (dark field, glowing centerpiece, monospace corner readouts, thin bordered panels) and build it in JARVIS's own visual language using the existing accent colors and type scale.

**Corner panels — all real data, no invented numbers:**

- **Top left:** LAST 7 DAYS — new clients onboarded, MRR, cash collected. Pull from `contracts`/`deals`/`transactions`. If these are zero, show zero. Do not fabricate sample figures like the reference screenshots do.
- **Top right:** TODAY — tasks completed / total, habits completed / total, calories logged, workouts.
- **Right rail:** system status list — Memory, Business, Health, Finance, Goals, Voice, TTS each showing LIVE / OFF based on actual state (is the module configured, is there data, is TTS available in this browser). This is a real health check, not decoration.
- **Bottom:** live transcript, the mic status line, and a clock.
- **Top center:** current status pill (IDLE / LISTENING / THINKING / SPEAKING).

Everything monospace, uppercase labels, `tabular-nums`, thin borders, low-opacity panel backgrounds over the particle field.

## Scope boundary for v1

Build: push-to-talk, wake word, TTS replies, the orb, the corner panels, barge-in.

Do **not** build: multi-turn voice memory beyond the existing chat history, voice-triggered actions ("JARVIS, add a task"), speaker identification, or custom voice cloning. Those come after the basic loop is solid.

## Verification — in the browser, not by reasoning

- Push-to-talk: hold space, speak, confirm transcript appears and a spoken reply comes back.
- Wake word: say "Hey JARVIS" from across the room, confirm it wakes. Then wait 2 full minutes in idle and confirm it *still* wakes — this is the test that catches gotcha 1.
- Feedback loop: ask a question that produces a long reply and confirm JARVIS does not hear itself and re-trigger. This catches gotcha 2.
- Barge-in: interrupt mid-reply, confirm it stops immediately.
- Turn voice mode off and confirm the mic indicator in the browser tab actually goes away.
- Confirm every corner panel number matches what the corresponding JARVIS page shows.

---

# WORK ORDER D — Dashboard layout regression (still outstanding)

From two rounds ago, still unfixed: Goals grew to 14 entries and became the tallest element, forcing every column to stretch, leaving ~210px of void in Today's Routine and ~260px in Health.

- Filler cards need `overflow-hidden` on the card and `min-h-0 overflow-y-auto` on the scrollable child — without both, they grow instead of scrolling.
- Cap Goals to the 6 nearest-deadline or lowest-completion entries, scrollable, "All Goals →" pinned bottom with `mt-auto`.
- Ceiling the grid at `2xl:max-h-[calc(100vh-220px)]` so columns scroll internally instead of the page running to 1600px.
- Verify: no card has more than 24px of empty space below its last content element.

---

# Order and reporting

Do A and B first — they're small and they make everything else feel like JARVIS instead of a generic app. Then D (quick). Then C, which is the real build.

Report after each. For C specifically, I want to know which of the eight gotchas actually bit you during the build, because that tells me what to watch for when I use it.
