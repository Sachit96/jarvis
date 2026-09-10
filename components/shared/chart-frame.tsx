"use client";

import type { ComponentProps } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * The one way a chart fills its parent box.
 *
 * `<ResponsiveContainer width="100%" height="100%">` with no
 * `initialDimension` renders a 0×0 placeholder until its ResizeObserver
 * fires. `ChartContainer` (components/ui/chart.tsx) already passes one; the
 * five charts that used a bare container did not, so they had a frame of
 * blankness on first paint and no size at all in any environment where the
 * observer is slow to fire.
 *
 * This exists so that is settled in one place rather than five, and so the
 * next chart added to the app inherits the fix instead of rediscovering it.
 */
export function ChartFrame({
  height,
  width = 320,
  children,
}: {
  /** The height of the box this chart is being dropped into, in px. */
  height: number;
  /**
   * The width to draw at before the observer reports the real one. Pass the
   * box's actual width whenever it is capped — a donut in a `max-w-[16rem]`
   * box drawn at the 320px default renders offset from its own centre and
   * overlapping its centre label, which is exactly what it did on tablet.
   */
  width?: number;
  children: ComponentProps<typeof ResponsiveContainer>["children"];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width, height }}>
      {children}
    </ResponsiveContainer>
  );
}
