/**
 * Ambient lighting behind a page.
 *
 * Deliberately NOT applied globally: §7 of the brief is explicit that aurora
 * belongs on Home, AI Mentor, Voice and major overview surfaces — putting it
 * behind every card turns environmental lighting into wallpaper, and the
 * moment it is everywhere it stops signalling anything.
 *
 * Pure CSS, no Framer Motion. The drift is a single keyframe on a blurred
 * radial gradient, so it costs one composited layer rather than a JS
 * animation loop running behind an operating system people work in. It is
 * also switched off wholesale by prefers-reduced-motion in globals.css.
 *
 * `fixed` + `-z-10` + pointer-events-none: it can never intercept a click and
 * never scrolls with content, so it reads as light in the room rather than as
 * an element on the page.
 */
export function AuroraBackdrop({ intensity = "ambient" }: { intensity?: "ambient" | "focal" }) {
  const scale = intensity === "focal" ? "opacity-100" : "opacity-60";
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${scale}`}>
      <div className="aurora-orb aurora-orb-brand -left-[10%] -top-[15%] size-[42rem]" />
      <div className="aurora-orb aurora-orb-accent -right-[12%] top-[20%] size-[34rem]" />
      {/* A third, dimmer orb low on the page stops the lower half reading as
          a different, unlit surface on tall dashboards. */}
      <div className="aurora-orb aurora-orb-brand bottom-[-20%] left-[30%] size-[38rem] opacity-[0.10]" />
    </div>
  );
}
