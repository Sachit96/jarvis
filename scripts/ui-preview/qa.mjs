/**
 * Rendered visual QA driver. See ./README.md.
 *
 * Boots the stub PostgREST + `next dev` pointed at it, then walks the real
 * routes in a real Chromium and writes a screenshot plus a computed-style
 * report for each. This is the only way the two defects found in the
 * previous phase were findable at all.
 *
 *   node scripts/ui-preview/qa.mjs --scenario populated --viewport desktop
 *   node scripts/ui-preview/qa.mjs --routes /,/health/workouts
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const scenario = argOf("scenario", "populated");
/**
 * "prod" builds the app and serves it with `next start`; "dev" runs
 * `next dev`.
 *
 * prod is the default, and not just for fidelity. In `next dev` this
 * sandbox's HMR websocket fails its handshake, and with it the dev
 * bootstrap — the page renders its server HTML and then never hydrates, so
 * no effect ever runs and every client component looks broken. Confirmed
 * with an explicit hydration probe: charts, the scroll-aware command bar
 * and the sidebar's active state were all "broken" in dev QA and entirely
 * fine in the production build. Dev QA is kept only for quick iteration on
 * pure-CSS changes, where hydration does not matter.
 */
const mode = argOf("mode", "prod");
const outDir = argOf("out", ".ui-qa");
const dbPort = Number(argOf("db-port", "54329"));
const appPort = Number(argOf("app-port", "3111"));

const VIEWPORTS = {
  desktop: { width: 1512, height: 950 },
  tablet: { width: 900, height: 1000 },
  mobile: { width: 390, height: 844 },
};
const viewportNames = argOf("viewport", "desktop").split(",");

const ALL_ROUTES = [
  "/",
  "/business/dashboard",
  "/business/leads",
  "/business/pipeline",
  "/business/clients",
  "/business/revenue",
  "/finance/overview",
  "/finance/transactions",
  "/finance/accounts",
  "/finance/budgets",
  "/finance/trades",
  "/finance/analysis",
  "/health/workouts",
  "/health/nutrition",
  "/health/body",
  "/life/goals",
  "/life/tasks",
  "/life/habits",
  "/life/journal",
  "/uni",
  "/uni/courses",
  "/uni/timetable",
  "/uni/attendance",
  "/uni/calendar",
  "/uni/assessments",
  "/uni/deadlines",
  "/mentor",
  "/mentor/weekly-review",
  "/voice",
  "/youtube",
  "/memory",
  "/settings",
  // Detail routes, with ids that exist in the stub fixtures. Without these
  // three the audit covered every list and no record — and the detail pages
  // are where the densest layouts live.
  "/business/pipeline/deal-0000-0000-0000-000000000002",
  "/business/clients/con-0000-0000-0000-000000000001",
  "/uni/courses/crs-0000-0000-0000-000000000001",
];
const evalExpr = argOf("eval", "").trim() || null;
/**
 * --click "<selector>" performs a REAL Playwright click before --eval runs.
 *
 * Not the same as clicking from inside --eval: Base UI's controls (the
 * checkbox, the select) are driven by pointer events, so an element.click()
 * dispatched from page script moves nothing and the component reads as
 * broken when it is fine. Anything interactive has to be driven with real
 * input to be believed.
 */
const clickSelector = argOf("click", "").trim() || null;
/**
 * --naming audit writes `<page>-<viewport>.png` (home-desktop.png) instead of
 * the default `<viewport>__<slug>.png`. The audit output is a deliverable a
 * person reads, so the files are named the way a person would name them.
 */
const naming = argOf("naming", "default");
const PAGE_NAMES = {
  "/": "home",
  "/business/dashboard": "business",
  "/business/leads": "business-leads",
  "/business/pipeline": "business-pipeline",
  "/business/clients": "business-clients",
  "/business/revenue": "business-revenue",
  "/finance/overview": "finance",
  "/finance/transactions": "finance-transactions",
  "/finance/accounts": "finance-accounts",
  "/finance/budgets": "finance-budgets",
  "/finance/trades": "finance-trades",
  "/finance/analysis": "finance-analysis",
  "/health/workouts": "health",
  "/health/nutrition": "health-nutrition",
  "/health/body": "health-body",
  "/life/goals": "goals",
  "/life/tasks": "tasks",
  "/life/habits": "tasks-routine",
  "/life/journal": "tasks-journal",
  "/uni": "university",
  "/uni/courses": "university-courses",
  "/uni/timetable": "university-timetable",
  "/uni/attendance": "university-attendance",
  "/uni/calendar": "university-calendar",
  "/uni/assessments": "university-assessments",
  "/uni/deadlines": "university-deadlines",
  "/mentor": "mentor",
  "/mentor/weekly-review": "mentor-weekly-review",
  "/voice": "voice",
  "/youtube": "youtube",
  "/memory": "memory",
  "/settings": "settings",
  "/business/pipeline/deal-0000-0000-0000-000000000002": "business-deal-detail",
  "/business/clients/con-0000-0000-0000-000000000001": "business-client-detail",
  "/uni/courses/crs-0000-0000-0000-000000000001": "university-course-detail",
};
const clickWaitMs = Number(argOf("click-wait", "4000"));
const routes = argOf("routes", "").trim() ? argOf("routes", "").split(",") : ALL_ROUTES;

// Playwright's bundled build does not match the Chromium preinstalled in
// this image, so point at the real binary rather than downloading one.
const EXECUTABLE = process.env.QA_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

function waitForHttp(url, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.status < 500) return resolve();
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) return reject(new Error(`timed out waiting for ${url}`));
      setTimeout(tick, 700);
    };
    tick();
  });
}

const children = [];
function spawnChild(cmd, cmdArgs, env) {
  // detached so each child leads its own process group: `npx next dev` forks
  // the actual server, and killing only the npx wrapper leaves that server
  // holding the port, which makes the very next QA run fail with EADDRINUSE.
  const child = spawn(cmd, cmdArgs, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  children.push(child);
  return child;
}
const cleanup = () => {
  for (const c of children) {
    if (c.killed || c.pid == null) continue;
    try {
      process.kill(-c.pid, "SIGTERM");
    } catch {
      try {
        c.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    }
  }
};
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

/** Style facts worth asserting on. Read from the live render, not the CSS. */
const PROBE = `(() => {
  const pick = (el, props) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
  };
  const doc = document.documentElement;
  const glass = document.querySelector('[data-slot="card"], .glass');
  const h1 = document.querySelector("h1");
  const scroller = document.scrollingElement;
  return {
    bodyBg: getComputedStyle(document.body).backgroundColor,
    brand: getComputedStyle(doc).getPropertyValue("--brand").trim(),
    gradient: getComputedStyle(doc).getPropertyValue("--gradient-brand").trim(),
    card: pick(glass, ["background-color", "backdrop-filter", "border-radius", "box-shadow"]),
    h1: pick(h1, ["font-family", "font-size", "letter-spacing", "color"]),
    h1Text: h1 ? h1.textContent.trim().slice(0, 60) : null,
    horizontalOverflow: scroller.scrollWidth - scroller.clientWidth,
    errorOverlay: Boolean(document.querySelector("nextjs-portal")),
    // React marks the root once it has hydrated. Without this the whole
    // report silently describes server HTML with no client behaviour.
    hydrated: Boolean(
      document.querySelector("[data-reactroot], #__next") ||
        Object.keys(document.body).some((k) => k.startsWith("__react")) ||
        document.body.firstElementChild != null,
    ),
  };
})()`;

/** Refuse to start on top of a previous run rather than half-starting. */
async function assertPortFree(port) {
  const { createServer } = await import("node:net");
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(new Error(`port ${port} is in use — another QA run is still up. Stop it first.`)),
    );
    probe.once("listening", () => probe.close(() => resolve()));
    probe.listen(port, "127.0.0.1");
  });
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  await assertPortFree(dbPort);
  await assertPortFree(appPort);

  console.log(`[qa] stub db :${dbPort} (${scenario})`);
  const db = spawnChild("node", ["scripts/ui-preview/server.mjs", "--port", String(dbPort), "--scenario", scenario]);
  db.stderr.on("data", (d) => process.stderr.write(`[db] ${d}`));

  const appEnv = {
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${dbPort}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "ui-preview-not-a-real-key",
    SUPABASE_SERVICE_ROLE_KEY: "ui-preview-not-a-real-key",
  };
  let devLog = "";
  const capture = (d) => {
    devLog += d;
  };

  if (mode === "prod") {
    console.log("[qa] next build (this is the slow part)");
    const build = spawnChild("npx", ["next", "build"], appEnv);
    build.stdout.on("data", capture);
    build.stderr.on("data", capture);
    const code = await new Promise((resolve) => build.on("exit", resolve));
    if (code !== 0) {
      writeFileSync(`${outDir}/dev.log`, devLog);
      throw new Error(`next build failed (exit ${code}) — see ${outDir}/dev.log`);
    }
  }

  console.log(`[qa] next ${mode === "prod" ? "start" : "dev"} :${appPort}`);
  const app = spawnChild(
    "npx",
    mode === "prod"
      ? ["next", "start", "--port", String(appPort)]
      : ["next", "dev", "--port", String(appPort)],
    appEnv,
  );
  app.stdout.on("data", capture);
  app.stderr.on("data", capture);

  await waitForHttp(`http://127.0.0.1:${appPort}/`);

  // --no-proxy-server is not optional here. This sandbox exports HTTPS_PROXY,
  // Chromium inherits it, and the dev server's own client assets and HMR
  // socket then get routed through a proxy that cannot reach 127.0.0.1 — so
  // the page renders its server HTML and NEVER HYDRATES. Every client
  // component's effect-driven output is missing in that state, which made
  // every chart in the app look broken when nothing was wrong with them.
  // Verified with an explicit hydration probe, not assumed.
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    args: ["--no-proxy-server"],
    proxy: { server: "direct://" },
  });
  const report = [];

  for (const viewportName of viewportNames) {
    const viewport = VIEWPORTS[viewportName];
    if (!viewport) throw new Error(`unknown viewport: ${viewportName}`);
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "dark" });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 300)));
    // A failed JS chunk means the page never hydrates, which would make every
    // "this component renders nothing" finding a harness artifact rather than
    // an app bug. Worth knowing which it is.
    const failedRequests = [];
    page.on("requestfailed", (r) => failedRequests.push(`${r.failure()?.errorText} ${r.url().slice(0, 120)}`));
    page.on("response", (r) => {
      if (r.status() >= 400) failedRequests.push(`HTTP ${r.status()} ${r.url().slice(0, 140)}`);
    });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));

    for (const route of routes) {
      consoleErrors.length = 0;
      failedRequests.length = 0;
      const slug = route === "/" ? "home" : route.slice(1).replaceAll("/", "_");
      const file =
        naming === "audit"
          ? `${outDir}/${PAGE_NAMES[route] ?? slug}-${viewportName}.png`
          : `${outDir}/${viewportName}__${slug}.png`;
      let entry = { route, viewport: viewportName, file };
      try {
        // Not networkidle: some routes hold a connection open (the Hevy
        // auto-sync poll, prefetches) and never go idle, which times the
        // whole route out instead of photographing it. Load + an explicit
        // settle below is both faster and more reliable.
        const res = await page.goto(`http://127.0.0.1:${appPort}${route}`, {
          waitUntil: "load",
          timeout: 45_000,
        });
        entry.status = res?.status() ?? 0;
        // recharts sizes itself from a ResizeObserver callback, so a
        // screenshot taken at networkidle can catch a chart at zero height
        // and photograph an empty card. Wait for the surface to have real
        // dimensions before believing what is on screen.
        await page
          .waitForFunction(
            () => {
              // Check the CONTAINERS, not the surfaces. Checking surfaces
              // treated "recharts rendered no chart at all" as success — which
              // is exactly the failure mode being hunted, and it sailed through
              // the first version of this wait.
              const containers = document.querySelectorAll(".recharts-responsive-container");
              if (containers.length === 0) return true;
              return [...containers].every((el) => {
                const surface = el.querySelector(".recharts-surface");
                return surface != null && surface.getBoundingClientRect().height > 4;
              });
            },
            { timeout: 8000 },
          )
          .catch(() => {
            entry.chartsNeverSized = true;
          });
        await page.waitForTimeout(500);
        entry.probe = await page.evaluate(PROBE);
        // --eval '<expression>' runs an arbitrary expression in the page and
        // records the result per route. This is the workhorse for "why does
        // this card look empty" questions, which the screenshot poses and
        // only the live DOM answers.
        if (clickSelector) {
          try {
            await page.click(clickSelector, { timeout: 10_000 });
            await page.waitForTimeout(clickWaitMs);
            entry.clicked = clickSelector;
          } catch (err) {
            entry.clickError = String(err).slice(0, 200);
          }
        }
        if (evalExpr) entry.eval = await page.evaluate(evalExpr);
        await page.screenshot({ path: file, fullPage: true });
      } catch (err) {
        entry.error = String(err).slice(0, 300);
      }
      if (consoleErrors.length) entry.consoleErrors = [...new Set(consoleErrors)].slice(0, 5);
      if (failedRequests.length) entry.failedRequests = [...new Set(failedRequests)].slice(0, 8);
      report.push(entry);
      const flag = entry.error || entry.status !== 200 ? "FAIL" : entry.probe?.horizontalOverflow > 0 ? "OVERFLOW" : "ok";
      console.log(`[qa] ${viewportName} ${route} → ${flag}`);
    }
    await context.close();
  }

  await browser.close();
  writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
  writeFileSync(`${outDir}/dev.log`, devLog);
  console.log(`[qa] wrote ${outDir}/report.json`);
  cleanup();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  cleanup();
  process.exit(1);
});
