import * as React from 'react'

const MOBILE_BREAKPOINT = 1280

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

/**
 * True below the sidebar's mobile breakpoint.
 *
 * NOT `useState(() => window.innerWidth < BREAKPOINT)`, which is what this
 * was. That initialiser returns undefined on the server and the real value
 * on the client, so the client's FIRST render — the hydration render —
 * disagreed with the server HTML on every viewport under 1280px. React
 * responded the way it must: threw away the server-rendered tree and
 * re-rendered the whole app on the client (error #418), on every route, on
 * every phone and tablet.
 *
 * Nothing about that was visible on screen, which is why it survived. It
 * showed up as a page error in rendered QA: 62 of 64 sub-desktop
 * route/viewport combinations, and zero desktop ones.
 *
 * `getServerSnapshot` returns false so the server and the first client
 * render agree; the real value arrives immediately afterwards through the
 * store. The mobile sidebar is a sheet that is closed until the user opens
 * it, so there is nothing to flash.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}
