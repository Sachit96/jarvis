"use client";

import { useEffect, useRef, useState } from "react";

/** 0-100 per region — computed in voice-mode-client.tsx from state the app already has, never randomized. */
export interface RegionActivity {
  sensory_cortex: number;
  language: number;
  prefrontal: number;
  hippocampus: number;
  association: number;
  motor_cortex: number;
  concept_layer: number;
  feature_layer: number;
}

type RegionKey = keyof RegionActivity;

interface RegionConfig {
  key: RegionKey;
  label: string;
  neurons: number;
  color: [number, number, number];
  angle: number;
  radiusFactor: number;
  pointCount: number;
}

function deg(d: number) {
  return (d * Math.PI) / 180;
}

// Colors reuse the app's existing category palette verbatim (lib/category-colors.ts,
// app/globals.css --cat-*/--brand/--warn) — nothing new invented for this.
const VIOLET: [number, number, number] = [139, 92, 246]; // --cat-business
const RED: [number, number, number] = [239, 68, 68]; // --cat-health / --danger
const ORANGE: [number, number, number] = [249, 115, 22]; // --cat-finance
const MAGENTA: [number, number, number] = [236, 72, 153]; // --cat-habits
const GREEN: [number, number, number] = [34, 197, 94]; // --cat-money / --success
const CYAN: [number, number, number] = [34, 211, 238]; // --brand
const AMBER: [number, number, number] = [245, 158, 11]; // --warn
const BLUE: [number, number, number] = [59, 130, 246]; // --cat-goals

const REGIONS: RegionConfig[] = [
  { key: "prefrontal", label: "PREFRONTAL", neurons: 340, color: VIOLET, angle: deg(-62), radiusFactor: 0.6, pointCount: 90 },
  { key: "motor_cortex", label: "MOTOR CORTEX", neurons: 150, color: RED, angle: deg(-15), radiusFactor: 0.7, pointCount: 55 },
  { key: "association", label: "ASSOCIATION", neurons: 220, color: ORANGE, angle: deg(28), radiusFactor: 0.68, pointCount: 70 },
  { key: "hippocampus", label: "HIPPOCAMPUS", neurons: 180, color: BLUE, angle: deg(78), radiusFactor: 0.62, pointCount: 65 },
  { key: "language", label: "LANGUAGE", neurons: 170, color: AMBER, angle: deg(132), radiusFactor: 0.6, pointCount: 60 },
  { key: "feature_layer", label: "FEATURE LAYER", neurons: 160, color: CYAN, angle: deg(182), radiusFactor: 0.66, pointCount: 55 },
  { key: "concept_layer", label: "CONCEPT LAYER", neurons: 190, color: MAGENTA, angle: deg(-148), radiusFactor: 0.7, pointCount: 65 },
  { key: "sensory_cortex", label: "SENSORY CORTEX", neurons: 260, color: GREEN, angle: deg(-100), radiusFactor: 0.58, pointCount: 80 },
];

const STAR_COUNT = 240;
const CONNECTION_DISTANCE = 34;
const CELL_SIZE = CONNECTION_DISTANCE;

interface Point {
  bx: number; // base x offset from cluster center
  by: number;
  phase: number;
  speed: number;
  amp: number;
}

interface Star {
  x: number;
  y: number;
  depth: number; // 0.2-1, cheap parallax + twinkle
  phase: number;
}

interface Streak {
  regionIndex: number;
  t: number; // 0-1 progress
  speed: number;
  curve: number;
  spreadAngle: number;
}

function buildGrid(points: { x: number; y: number }[]): Map<string, number[]> {
  const grid = new Map<string, number[]>();
  points.forEach((p, i) => {
    const key = `${Math.floor(p.x / CELL_SIZE)}:${Math.floor(p.y / CELL_SIZE)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(i);
    else grid.set(key, [i]);
  });
  return grid;
}

function nearbyIndexes(grid: Map<string, number[]>, x: number, y: number): number[] {
  const cx = Math.floor(x / CELL_SIZE);
  const cy = Math.floor(y / CELL_SIZE);
  const result: number[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = grid.get(`${cx + dx}:${cy + dy}`);
      if (bucket) result.push(...bucket);
    }
  }
  return result;
}

interface LabelPosition {
  key: RegionKey;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

const LABEL_WIDTH = 176;
const LABEL_HEIGHT = 40;

/** Push overlapping label boxes apart along their own leader line until none overlap. Computed once per layout (mount/resize), never per animation frame. */
function resolveLabelCollisions(labels: LabelPosition[]): LabelPosition[] {
  const resolved = labels.map((l) => ({ ...l }));
  const overlaps = (a: LabelPosition, b: LabelPosition) =>
    Math.abs(a.x - b.x) < LABEL_WIDTH && Math.abs(a.y - b.y) < LABEL_HEIGHT;

  for (let pass = 0; pass < 12; pass++) {
    let anyOverlap = false;
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        if (!overlaps(resolved[i], resolved[j])) continue;
        anyOverlap = true;
        const a = resolved[i];
        const dirX = a.x - a.anchorX;
        const dirY = a.y - a.anchorY;
        const len = Math.hypot(dirX, dirY) || 1;
        a.x += (dirX / len) * 14;
        a.y += (dirY / len) * 14;
      }
    }
    if (!anyOverlap) break;
  }
  return resolved;
}

export function NeuralMap({ activity }: { activity: RegionActivity }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef(activity);
  const [labels, setLabels] = useState<LabelPosition[]>([]);
  const [displayActivity, setDisplayActivity] = useState(activity);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  useEffect(() => {
    const id = setTimeout(() => setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches), 0);
    return () => clearTimeout(id);
  }, []);

  // Label percentages are read-heavy (React re-render) but don't need
  // 60fps precision — throttled separately from the canvas's own rAF loop.
  useEffect(() => {
    const id = setInterval(() => setDisplayActivity({ ...activityRef.current }), 150);
    return () => clearInterval(id);
  }, []);

  // Random point/star layout is generated once, in an effect (not render —
  // Math.random() during render is impure and disallowed here) and kept in
  // refs since the draw loop only needs to read them, never re-render on them.
  const clusterPointsRef = useRef<Point[][]>([]);
  const starsRef = useRef<Star[]>([]);
  const [pointsReady, setPointsReady] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      clusterPointsRef.current = REGIONS.map((region) => {
        const points: Point[] = [];
        for (let i = 0; i < region.pointCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 46;
          points.push({
            bx: Math.cos(a) * r,
            by: Math.sin(a) * r,
            phase: Math.random() * Math.PI * 2,
            speed: 0.4 + Math.random() * 0.6,
            amp: 1.5 + Math.random() * 2,
          });
        }
        return points;
      });

      const pts: Star[] = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        pts.push({ x: Math.random(), y: Math.random(), depth: 0.2 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2 });
      }
      starsRef.current = pts;
      setPointsReady(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Layout (cluster centers + label anchors) is recomputed only on
  // mount/resize, not per animation frame.
  useEffect(() => {
    function computeLayout() {
      const container = containerRef.current;
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.min(width, height) / 2;

      const raw: LabelPosition[] = REGIONS.map((region) => {
        const clusterX = cx + Math.cos(region.angle) * scale * region.radiusFactor;
        const clusterY = cy + Math.sin(region.angle) * scale * region.radiusFactor;
        const labelX = cx + Math.cos(region.angle) * scale * Math.min(0.95, region.radiusFactor + 0.22);
        const labelY = cy + Math.sin(region.angle) * scale * Math.min(0.95, region.radiusFactor + 0.22);
        return { key: region.key, x: labelX, y: labelY, anchorX: clusterX, anchorY: clusterY };
      });
      setLabels(resolveLabelCollisions(raw));
    }
    computeLayout();
    window.addEventListener("resize", computeLayout);
    return () => window.removeEventListener("resize", computeLayout);
  }, []);

  useEffect(() => {
    if (!pointsReady) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      const { width, height } = container!.getBoundingClientRect();
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
    }
    resize();
    window.addEventListener("resize", resize);

    const streaks: Streak[] = [];
    let running = true;
    let raf = 0;
    let visible = !document.hidden;

    function onVisibility() {
      visible = !document.hidden;
      if (visible && running) raf = requestAnimationFrame(draw);
    }
    document.addEventListener("visibilitychange", onVisibility);

    function drawStatic() {
      // prefers-reduced-motion: one frame, no animation, no streaks.
      const w = canvas!.width;
      const h = canvas!.height;
      ctx!.fillStyle = "#000000";
      ctx!.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) / 2;
      REGIONS.forEach((region, ri) => {
        const clusterX = cx + Math.cos(region.angle) * scale * region.radiusFactor;
        const clusterY = cy + Math.sin(region.angle) * scale * region.radiusFactor;
        const [r, g, b] = region.color;
        clusterPointsRef.current[ri].forEach((p) => {
          ctx!.beginPath();
          ctx!.fillStyle = `rgba(${r},${g},${b},0.7)`;
          ctx!.arc(clusterX + p.bx * dpr, clusterY + p.by * dpr, 1.4 * dpr, 0, Math.PI * 2);
          ctx!.fill();
        });
      });
    }

    function draw(time: number) {
      if (!visible) return;
      const w = canvas!.width;
      const h = canvas!.height;
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) / 2;
      const t = time / 1000;

      ctx!.fillStyle = "#000000";
      ctx!.fillRect(0, 0, w, h);

      // Starfield — slow drift, cheap depth via size/opacity only.
      for (const star of starsRef.current) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * 0.6 + star.phase);
        const sx = ((star.x + t * 0.002 * star.depth) % 1) * w;
        const sy = star.y * h;
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(255,255,255,${0.15 + star.depth * 0.35 * twinkle})`;
        ctx!.arc(sx, sy, star.depth * 1.1 * dpr, 0, Math.PI * 2);
        ctx!.fill();
      }

      const activityNow = activityRef.current;
      let totalActivity = 0;

      // Leader lines drawn first, underneath everything else.
      ctx!.globalCompositeOperation = "lighter";
      for (const region of REGIONS) {
        const label = labels.find((l) => l.key === region.key);
        if (!label) continue;
        const clusterX = cx + Math.cos(region.angle) * scale * region.radiusFactor;
        const clusterY = cy + Math.sin(region.angle) * scale * region.radiusFactor;
        const [r, g, b] = region.color;
        ctx!.strokeStyle = `rgba(${r},${g},${b},0.25)`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(clusterX, clusterY);
        ctx!.lineTo(label.x * dpr, label.y * dpr);
        ctx!.stroke();
      }

      REGIONS.forEach((region, ri) => {
        const activityValue = Math.max(0, Math.min(100, activityNow[region.key]));
        totalActivity += activityValue;
        const fireFrac = activityValue / 100;
        const clusterX = cx + Math.cos(region.angle) * scale * region.radiusFactor;
        const clusterY = cy + Math.sin(region.angle) * scale * region.radiusFactor;
        const [r, g, b] = region.color;
        const points = clusterPointsRef.current[ri];

        const world = points.map((p) => {
          const jx = Math.sin(t * p.speed + p.phase) * p.amp;
          const jy = Math.cos(t * p.speed * 0.8 + p.phase) * p.amp;
          return { x: clusterX + (p.bx + jx) * dpr, y: clusterY + (p.by + jy) * dpr };
        });

        // Connections — spatial-grid bucketed, not O(n^2) over every pair.
        const grid = buildGrid(world);
        const lineOpacity = 0.06 + fireFrac * 0.35;
        ctx!.strokeStyle = `rgba(${r},${g},${b},${lineOpacity})`;
        ctx!.lineWidth = 1;
        for (let i = 0; i < world.length; i++) {
          const candidates = nearbyIndexes(grid, world[i].x, world[i].y);
          for (const j of candidates) {
            if (j <= i) continue;
            const dx = world[i].x - world[j].x;
            const dy = world[i].y - world[j].y;
            const dist = Math.hypot(dx, dy);
            if (dist < CONNECTION_DISTANCE * dpr) {
              ctx!.beginPath();
              ctx!.moveTo(world[i].x, world[i].y);
              ctx!.lineTo(world[j].x, world[j].y);
              ctx!.stroke();
            }
          }
        }

        // Points.
        const pointAlpha = 0.45 + fireFrac * 0.5;
        const pointSize = (1.1 + fireFrac * 0.9) * dpr;
        ctx!.fillStyle = `rgba(${r},${g},${b},${pointAlpha})`;
        for (const wp of world) {
          ctx!.beginPath();
          ctx!.arc(wp.x, wp.y, pointSize, 0, Math.PI * 2);
          ctx!.fill();
        }

        // Spawn streaks proportional to firing intensity.
        if (fireFrac > 0.02 && Math.random() < fireFrac * 0.35) {
          const count = 1 + Math.floor(Math.random() * Math.min(4, 1 + fireFrac * 4));
          for (let s = 0; s < count; s++) {
            if (streaks.length > 160) break;
            streaks.push({ regionIndex: ri, t: 0, speed: 0.012 + Math.random() * 0.014, curve: (Math.random() - 0.5) * 60, spreadAngle: (Math.random() - 0.5) * 0.35 });
          }
        }
      });

      // Core glow — radius/intensity tracks total system activity.
      const avgActivity = totalActivity / REGIONS.length / 100;
      const coreRadius = (14 + avgActivity * 26) * dpr;
      const gradient = ctx!.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 2.4);
      gradient.addColorStop(0, `rgba(255,255,255,${0.85 + avgActivity * 0.15})`);
      gradient.addColorStop(0.35, `rgba(180,240,255,${0.4 + avgActivity * 0.3})`);
      gradient.addColorStop(1, "rgba(34,211,238,0)");
      ctx!.fillStyle = gradient;
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreRadius * 2.4, 0, Math.PI * 2);
      ctx!.fill();

      // Streaks — white, radiate outward from the core along a curved path, fade as they travel.
      ctx!.strokeStyle = "white";
      for (let i = streaks.length - 1; i >= 0; i--) {
        const streak = streaks[i];
        streak.t += streak.speed;
        if (streak.t >= 1) {
          streaks.splice(i, 1);
          continue;
        }
        const region = REGIONS[streak.regionIndex];
        const targetX = cx + Math.cos(region.angle + streak.spreadAngle) * scale * (region.radiusFactor + 0.05);
        const targetY = cy + Math.sin(region.angle + streak.spreadAngle) * scale * (region.radiusFactor + 0.05);
        const perpAngle = region.angle + Math.PI / 2;
        const bow = Math.sin(streak.t * Math.PI) * streak.curve * dpr;
        const midX = (cx + targetX) / 2 + Math.cos(perpAngle) * bow;
        const midY = (cy + targetY) / 2 + Math.sin(perpAngle) * bow;

        const tailT = Math.max(0, streak.t - 0.12);
        const p0 = quadPoint(cx, cy, midX, midY, targetX, targetY, tailT);
        const p1 = quadPoint(cx, cy, midX, midY, targetX, targetY, streak.t);
        const opacity = Math.sin(streak.t * Math.PI) * 0.9;
        ctx!.globalAlpha = Math.max(0, opacity);
        ctx!.lineWidth = 1.4 * dpr;
        ctx!.beginPath();
        ctx!.moveTo(p0.x, p0.y);
        ctx!.lineTo(p1.x, p1.y);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(draw);
    }

    function quadPoint(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, tt: number) {
      const u = 1 - tt;
      return {
        x: u * u * x0 + 2 * u * tt * x1 + tt * tt * x2,
        y: u * u * y0 + 2 * u * tt * y1 + tt * tt * y2,
      };
    }

    if (reducedMotion) {
      drawStatic();
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pointsReady, labels, reducedMotion]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
      {labels.map((label) => {
        const region = REGIONS.find((r) => r.key === label.key)!;
        const value = Math.max(0, Math.min(100, displayActivity[label.key]));
        const [r, g, b] = region.color;
        return (
          <div
            key={label.key}
            data-region={label.key}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-md bg-black/50 px-2 py-1 font-mono backdrop-blur-[1px]"
            style={{ left: label.x, top: label.y, width: LABEL_WIDTH, border: `1px solid rgba(${r},${g},${b},0.55)` }}
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide" style={{ color: `rgb(${r},${g},${b})` }}>
              {region.label}
            </p>
            <p className="text-[9px] tabular-nums text-white/60">
              {region.neurons} neurons &middot; firing {value.toFixed(1)}%
            </p>
          </div>
        );
      })}
    </div>
  );
}
