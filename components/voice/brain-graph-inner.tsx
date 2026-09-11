"use client";

import type { ComponentProps, RefObject } from "react";
import ForceGraph3D from "react-force-graph-3d";

/**
 * A thin pass-through whose only job is to forward a ref.
 *
 * `next/dynamic` does not forward refs to the component it loads, so
 * `<DynamicForceGraph ref={…}>` leaves the ref null forever — and every
 * camera call silently no-ops. The symptom is a graph that lays out
 * correctly and then sits at the library's default camera distance, which
 * for a handful of nodes is a few specks in the middle of an empty screen.
 *
 * Taking the ref as an ordinary prop sidesteps the whole question.
 */
export default function BrainGraphInner({
  graphRef,
  ...props
}: ComponentProps<typeof ForceGraph3D> & { graphRef: RefObject<unknown> }) {
  return <ForceGraph3D ref={graphRef as never} {...props} />;
}
