# JARVIS — YouTube Automation: reality check + phased build

You asked for all of it, including real uploads. That's the right end goal. But two technical walls and one judgment call determine the order, so read this before picking what to build first.

## The two hard walls

**1. OAuth, not an API key.** Places/PageSpeed/Gemini all used a simple API key. YouTube's upload API requires a full OAuth2 consent flow tied to your Google account — a Google Cloud project, an OAuth consent screen, and a one-time browser authorization that issues a refresh token JARVIS stores and reuses. More setup than anything built so far, but it's a one-time cost, not ongoing complexity.

**2. Quota caps real uploads hard.** YouTube Data API v3 gives 10,000 quota units/day by default. A single video upload (`videos.insert`) costs **1,600 units**. That's a real ceiling of **~6 uploads/day**, full stop, free or not — this isn't a pricing tier issue like Gemini, it's Google's hard default for this specific API. Raising it requires an API audit application to Google, which takes real time and isn't guaranteed. For anything short of running a multi-video-per-day channel, 6/day is not a practical constraint.

## The judgment call

Should a finished video ever **auto-publish** with nobody looking at it first?

My recommendation: no, not initially. Set the upload API to `privacyStatus: "private"` or `"unlisted"` by default, and require a manual "approve to publish" step in JARVIS before it goes fully public. Reasoning: an AI-generated script or thumbnail with an error, an off-brand take, or a copyright-adjacent line going live unreviewed on your actual channel is a real, avoidable risk — YouTube strikes and public embarrassment aren't reversible the way a bad CRM entry is. You can turn this off later once you trust the pipeline's output quality. This is a recommendation, not a refusal — say the word and Phase 3 below builds true one-click autonomous publish instead.

## The pipeline, phased

### Phase 1 — Research + script generation (buildable now, spec below)
No YouTube API needed at all. Pure Gemini + web search.

### Phase 2 — Thumbnail/title generation
Needs image generation. `Imagen 4 Generate` has **25 requests/day free** on your same Google AI Studio project (confirmed from the rate-limit table pulled earlier this session) — genuinely free, separate quota from your text-model budget. Title generation is just another Gemini text call, same tiering as everything else.

### Phase 3 — Upload automation
Needs the OAuth setup above. Default to private/unlisted + manual approve, per the judgment call. This is where the quota math (6/day ceiling) actually matters — fine for you, would matter a lot for anyone trying to run a high-volume channel through this.

### Phase 4 — Scheduling + analytics
Once Phase 3 works, scheduling is a timestamp field on the upload call. Analytics reads from YouTube Analytics API — separate scope in the same OAuth consent, small additional setup, not a new wall.

---

# Phase 1 spec — build this now

## What it does

You give it a topic or niche direction. It researches what's currently working in that space, then generates a full script with a hook, structure, and estimated runtime. No YouTube account access needed for this phase — it's research + writing only.

## Build

`app/youtube/research/page.tsx` (or fold into an existing area if you'd rather) — new domain, same pattern as Business/Health/Finance: its own DB table, its own dashboard card eventually.

### Research step
- Web search (already have this tool pattern from Lead Research) for the topic: recent successful videos in the niche, common formats, trending angles
- Pull a handful of real reference points — titles, general structure, what's getting engagement — paraphrased summaries, not scraped transcripts (copyright discipline, same as everywhere else in this build)

### Script generation step
- One Gemini call, STRUCTURED tier (Flash-Lite) since this benefits from reliable formatting, not high volume
- Output: hook (first 15 seconds), full script broken into timestamped sections, estimated total runtime, a suggested title, 3 title alternatives
- Zod-validated output shape, same discipline as every other structured call this session

### Storage
New table, `youtube_scripts`: topic, research_summary, script_body, sections (jsonb), suggested_titles (text[]), status (`draft` | `approved` | `used`), created_at. Simple, no over-engineering — this is Phase 1 of 4, don't build for Phase 4's needs yet.

### UI
A form (topic in, generate), a results view showing the script with sections, a way to mark it approved/edit it. That's it for Phase 1 — no thumbnail, no upload button yet, those are separate phases with their own specs.

## Verification
- Real run: give it an actual topic, confirm the research step returns real, current results (not stale/generic)
- Confirm the script structure is genuinely usable — timestamped sections, not just a wall of text
- Confirm it's tracking Gemini usage under the correct tier per the budget system already built

---

Tell me once Phase 1 is working, or if you'd rather I write Phase 2/3 specs now instead of waiting — your call on order, just not all four at once.
