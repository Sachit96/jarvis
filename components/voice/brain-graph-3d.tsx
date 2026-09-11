"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  buildBrainGraph,
  colorForCategory,
  focusTargetFor,
  searchBrain,
  ROOT_ID,
  type BrainEntry,
  type BrainNode,
} from "@/lib/voice/brain-graph";

/**
 * react-force-graph-3d touches `window` and WebGL at module scope, so it
 * cannot be server-rendered at all — not "renders badly", throws. ssr:false
 * is load-bearing, and the loading fallback is what the page shows for the
 * second or two the ~13MB chunk takes to arrive.
 *
 * Loaded through a wrapper because dynamic() does not forward refs — see
 * brain-graph-inner.tsx.
 */
const ForceGraph3D = dynamic(() => import("@/components/voice/brain-graph-inner"), {
  ssr: false,
  loading: () => null,
});

/** The node shape react-force-graph hands back, once it has laid the graph out. */
type PositionedNode = BrainNode & { x?: number; y?: number; z?: number };

export interface BrainGraphHandle {
  /** Fly to whatever node a spoken phrase names, if any. */
  focusOn: (text: string) => void;
}

/**
 * The knowledge network, in three dimensions.
 *
 * Nodes are real memory entries clustered under their categories — see
 * lib/voice/brain-graph.ts, which does all the thinking. This file is only
 * the rendering and the camera.
 *
 * Deliberately not interactive-by-default: the graph is the backdrop to a
 * voice conversation, so it drifts on its own and only moves decisively
 * when JARVIS says something that names a cluster.
 */
export function BrainGraph3D({
  entries,
  active,
  search,
  onReady,
}: {
  entries: BrainEntry[];
  /** True while JARVIS is thinking or speaking — drives the pulse. */
  active: boolean;
  /** Current search term; non-matching nodes dim rather than disappear. */
  search: string;
  onReady?: (handle: BrainGraphHandle) => void;
}) {
  const graph = useMemo(() => buildBrainGraph(entries), [entries]);
  const visible = useMemo(() => searchBrain(graph, search), [graph, search]);
  const fgRef = useRef<{
    cameraPosition: (pos: { x: number; y: number; z: number }, lookAt?: unknown, ms?: number) => void;
    d3Force: (name: string) => { distance?: (d: number) => void; strength?: (s: number) => void } | undefined;
    zoomToFit: (ms?: number, padding?: number) => void;
  } | null>(null);
  // Set once the user or a spoken phrase has moved the camera, so the
  // settle-time auto-fit cannot yank the view back out from under them.
  const cameraMoved = useRef(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // Rendered as a data attribute so the QA harness can assert the graph
  // actually laid out and framed itself, rather than inferring it from a
  // screenshot that looks plausible either way.
  const [settled, setSettled] = useState<"no" | "fitted" | "no-ref">("no");
  const wrapRef = useRef<HTMLDivElement>(null);

  // The graph needs explicit pixel dimensions; it does not observe its own
  // parent. Without this it renders at the library's 
  // default and sits off-centre in anything that is not exactly that size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * Fly the camera to a node.
   *
   * Positioned along the vector from the origin through the node so the
   * cluster is framed against empty space rather than through the rest of
   * the graph, and pulled back by a fixed distance so a node near the
   * centre does not end up inside the camera.
   */
  const focusNode = useCallback((node: PositionedNode) => {
    const fg = fgRef.current;
    if (!fg || node.x == null || node.y == null || node.z == null) return;
    cameraMoved.current = true;
    const distance = 130;
    const magnitude = Math.hypot(node.x, node.y, node.z) || 1;
    const ratio = 1 + distance / magnitude;
    fg.cameraPosition(
      { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
      node,
      1400,
    );
  }, []);

  useEffect(() => {
    if (!onReady) return;
    onReady({
      focusOn: (text: string) => {
        const target = focusTargetFor(graph, text);
        if (!target) return;
        const positioned = graph.nodes.find((n) => n.id === target.id) as PositionedNode | undefined;
        if (positioned) focusNode(positioned);
      },
    });
  }, [graph, focusNode, onReady]);

  /**
   * Configure the simulation and frame the graph on the first tick.
   *
   * Not in an effect: fgRef is only populated once the dynamically-imported
   * chunk has mounted, which is after any effect keyed on `graph` has
   * already run and found null. The first tick is the earliest moment the
   * instance is guaranteed to exist.
   */
  const ticks = useRef(0);
  const onTick = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    ticks.current += 1;

    if (ticks.current === 1) {
      // Spread the clusters apart. At the library's defaults every category
      // sits inside every other one and the whole thing reads as one blob.
      fg.d3Force("link")?.distance?.(38);
      fg.d3Force("charge")?.strength?.(-95);
      return;
    }

    // Framed partway through the layout, not on the first tick: at tick 1
    // every node is still stacked at the origin, so fitting there zooms the
    // camera inside a single sphere. By 40 ticks the clusters have
    // separated and the bounding box means something.
    if (ticks.current === 40 && !cameraMoved.current) {
      fg.zoomToFit(600, 90);
      setSettled("fitted");
    }
  }, []);


  const nodeColor = useCallback(
    (node: object) => {
      const n = node as BrainNode;
      const dimmed = !visible.has(n.id);
      if (n.kind === "root") return dimmed ? "#3b1d5e" : "#ffffff";
      const base = colorForCategory(n.category);
      // Dimming rather than hiding: a node that vanishes takes its edges
      // with it and the graph appears to restructure itself as you type.
      return dimmed ? `${base}22` : base;
    },
    [visible],
  );

  if (!size) return <div ref={wrapRef} className="size-full" />;

  return (
    <div ref={wrapRef} className="size-full" data-brain={settled}>
      <ForceGraph3D
        graphRef={fgRef as never}
        width={size.width}
        height={size.height}
        graphData={graph as never}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        nodeId="id"
        nodeLabel={(node: object) => {
          const n = node as BrainNode;
          return n.detail ? `${n.label} — ${n.detail.slice(0, 120)}` : n.label;
        }}
        nodeVal={(node: object) => (node as BrainNode).size}
        nodeColor={nodeColor}
        nodeOpacity={0.95}
        nodeResolution={16}
        // Larger than the default 4: these are landmarks in a mostly-empty
        // space, not data points in a dense scatter.
        nodeRelSize={6}
        linkColor={(link: object) => {
          const target = (link as { target: BrainNode | string }).target;
          const id = typeof target === "string" ? target : target.id;
          return visible.has(id) ? "rgba(190,120,255,0.55)" : "rgba(156,53,240,0.07)";
        }}
        linkWidth={1.1}
        // Particles travel the edges only while JARVIS is working, so motion
        // on this screen always means something is happening.
        linkDirectionalParticles={active ? 2 : 0}
        linkDirectionalParticleWidth={1.4}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleColor={() => "#ec4899"}
        enableNodeDrag={false}
        onNodeClick={(node: object) => focusNode(node as PositionedNode)}
        cooldownTicks={80}
        warmupTicks={20}
        onEngineTick={onTick}
        // Frame the graph once the simulation settles. Without this the
        // camera sits at the library's fixed default distance, which is
        // right for a few hundred nodes and leaves a handful of them as
        // specks in the middle of an empty screen — exactly what a new
        // account has.
        onEngineStop={() => {
          if (cameraMoved.current) return;
          const fg = fgRef.current;
          if (!fg?.zoomToFit) {
            setSettled("no-ref");
            return;
          }
          fg.zoomToFit(900, 90);
          setSettled("fitted");
        }}
      />
    </div>
  );
}

export { ROOT_ID };
