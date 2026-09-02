# JARVIS Voice Mode — neural map upgrade

Replace the particle sphere centerpiece with a labeled neural map. Reference screenshot attached: distinct colored clusters, constellation lines within each cluster, white signal streaks radiating outward, a bright core, starfield background.

Keep the 2D canvas approach — it was the right call and this doesn't need Three.js either.

## The core idea, and the reason this feels alive

Do not build a decorative animation that loops regardless of what's happening. **Each region maps to a real JARVIS subsystem and fires when that subsystem is actually doing something.** That's the entire difference between this looking alive and looking like a screensaver.

| Region | Real subsystem | Fires when |
|---|---|---|
| SENSORY CORTEX | Speech recognition | Mic is live; firing rate tracks input amplitude |
| LANGUAGE | TTS output | JARVIS is speaking |
| PREFRONTAL | Gemini call in flight | From request sent until response received |
| HIPPOCAMPUS | `memory_entries` reads | A memory query runs during a request |
| ASSOCIATION | Context assembly | Business/health/finance data pulled into a prompt |
| MOTOR CORTEX | Writes to DB | A task/log/entry is created |
| CONCEPT LAYER | Idle background | Low baseline firing always, so it's never fully dead |
| FEATURE LAYER | Idle background | Same |

Each region's label shows `{n} neurons • firing {x.x}%` where **firing % is a real number derived from actual activity**, not a random walk. Neuron count can be a fixed per-region constant (it's flavour), but the firing rate must mean something. When nothing is happening, most regions should genuinely read near 0.0% — that's honest and it makes the spikes actually land.

## Rendering

- **Starfield:** a few hundred static points, varying opacity, very slow drift. Cheap depth.
- **Clusters:** 8 regions, each a loose blob of 40–120 points positioned around the canvas center with distinct hues (violet, red, orange, magenta, green, cyan, amber, blue — reuse the existing JARVIS accent palette rather than inventing new colors).
- **Intra-cluster lines:** connect points within a cluster when closer than a threshold distance. Line opacity scales with that region's current firing rate — dim when idle, bright when active.
- **Signal streaks:** when a region fires, emit 2–5 white streaks that travel outward from the core along curved paths, fading as they go. These are the white lines in the reference. Spawn rate proportional to firing intensity.
- **Core:** bright additive white/cyan glow at center. Its radius and intensity track total system activity across all regions.
- **Labels:** small monospace boxes with a 1px colored border matching the region, positioned adjacent to their cluster with a short leader line. Uppercase, `tabular-nums` on the stats.

## Performance rules

- Single `requestAnimationFrame` loop, one canvas, `alpha: false` for a cheaper composite.
- Cap total points around 800. Above that, connection-line checks get expensive fast.
- Spatial partition the connection check (simple grid bucket), don't run an O(n²) distance loop over every pair every frame.
- Respect `prefers-reduced-motion`: fall back to a static render with no streaks.
- Pause the entire loop when the tab is hidden (`visibilitychange`) — this thing should not chew battery in the background.

## Labels must not overlap

The reference screenshot has labels colliding, which reads as sloppy. Position label boxes with simple collision avoidance: if two boxes overlap, push one along its leader line until they don't. Recompute only when a label moves, not every frame.

## Subtitle line

Bottom-center, large, high-contrast: the live transcript. Interim results in dim grey, final in white. This is the most functionally important text on the screen — it should be readable across a room, so size it accordingly (24px+), not treated as a caption.

## What stays

The corner HUD panels, status pill, mic indicator, and all the existing voice interaction logic are unchanged. This is purely swapping the centerpiece renderer.

## Verification

- Say something and confirm SENSORY CORTEX firing % actually rises with your voice.
- Ask a question and confirm PREFRONTAL lights up for exactly the duration of the Gemini call.
- Confirm that when idle, most regions read at or near 0.0% rather than fake-idling at 30%.
- Check frame rate stays at 60fps at 1920×1080 with all regions firing at once.
- Confirm the loop stops when you switch tabs.
