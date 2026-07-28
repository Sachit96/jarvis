#!/usr/bin/env node
// Regenerates public/jarvis-index.html by scanning the actual codebase —
// re-run with `node scripts/generate-sitemap.mjs` any time routes/files
// change, so the map never drifts from reality.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const REPO = "https://github.com/Sachit96/jarvis/blob/main";

function walk(dir, filterExt) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, filterExt));
    } else if (entry.name.endsWith(filterExt)) {
      out.push(full);
    }
  }
  return out;
}

function toRepoRelative(absPath) {
  return relative(ROOT, absPath).split(sep).join("/");
}

// ---------------------------------------------------------------- Pages
function routeFromPagePath(absPath) {
  const rel = toRepoRelative(absPath); // e.g. app/(app)/life/tasks/page.tsx
  const withoutApp = rel.replace(/^app\//, "").replace(/\/page\.tsx$/, "");
  const segments = withoutApp.split("/").filter((seg) => !/^\(.*\)$/.test(seg));
  const route = "/" + segments.join("/");
  return route === "/" ? "/" : route;
}

function moduleFromRoute(route) {
  if (route === "/") return "Command Center";
  const seg = route.split("/")[1];
  return { life: "Life OS", finance: "Finance OS", health: "Health OS", business: "Business OS", mentor: "AI Mentor", settings: "System", dashboard: "Command Center" }[seg] ?? seg;
}

const pageFiles = walk(join(ROOT, "app"), "page.tsx").sort();
const pages = pageFiles.map((f) => ({
  route: routeFromPagePath(f),
  file: toRepoRelative(f),
  module: moduleFromRoute(routeFromPagePath(f)),
}));

const pagesByModule = new Map();
for (const p of pages) {
  const list = pagesByModule.get(p.module) ?? [];
  list.push(p);
  pagesByModule.set(p.module, list);
}

// ---------------------------------------------------------------- API routes
const apiFiles = walk(join(ROOT, "app", "api"), "route.ts").sort();
const apiRoutes = apiFiles.map((f) => {
  const rel = toRepoRelative(f);
  const route = "/" + rel.replace(/^app\//, "").replace(/\/route\.ts$/, "");
  const source = readFileSync(f, "utf8");
  const methods = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1]);
  let auth = "None — single-user, no auth";
  if (source.includes("GHL_WEBHOOK_SECRET")) auth = "Shared secret (?secret= query param)";
  else if (source.includes("CRON_SECRET")) auth = "Shared secret (Authorization: Bearer)";
  return { route, file: rel, methods, auth };
});

// ---------------------------------------------------------------- Components / lib / actions
function listGroup(dir) {
  return walk(join(ROOT, dir), ".ts").concat(walk(join(ROOT, dir), ".tsx")).sort().map((f) => toRepoRelative(f));
}

const componentDirs = ["components/business", "components/dashboard", "components/finance", "components/health", "components/life", "components/mentor", "components/settings", "components/shared", "components/shell", "components/ui"];
const componentGroups = componentDirs.map((d) => ({ label: d.replace("components/", ""), files: listGroup(d) })).filter((g) => g.files.length > 0);

const libDirs = ["lib/ai", "lib/db/queries", "lib/providers", "lib/supabase", "lib/validations"];
const libGroups = libDirs.map((d) => ({ label: d.replace("lib/", ""), files: listGroup(d) })).filter((g) => g.files.length > 0);
const libRootFiles = walk(join(ROOT, "lib"), ".ts").map(toRepoRelative).filter((f) => f.split("/").length === 2);
if (libRootFiles.length > 0) libGroups.unshift({ label: "lib (root)", files: libRootFiles.sort() });

const actionFiles = listGroup("actions");

const migrationFiles = walk(join(ROOT, "supabase", "migrations"), ".sql").sort().map(toRepoRelative);

// ---------------------------------------------------------------- HTML
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pageRow(p) {
  return `<li><a href="${esc(p.route)}" class="route">${esc(p.route)}</a><a class="src" href="${REPO}/${esc(p.file)}" target="_blank" rel="noopener">source</a></li>`;
}

function apiRow(a) {
  return `<li><span class="methods">${a.methods.map((m) => `<span class="method m-${m}">${m}</span>`).join("")}</span><a href="${esc(a.route)}" class="route">${esc(a.route)}</a><span class="auth">${esc(a.auth)}</span><a class="src" href="${REPO}/${esc(a.file)}" target="_blank" rel="noopener">source</a></li>`;
}

function fileRow(f) {
  return `<li><a class="src" href="${REPO}/${esc(f)}" target="_blank" rel="noopener">${esc(f)}</a></li>`;
}

const moduleOrder = ["Command Center", "Life OS", "Finance OS", "Health OS", "Business OS", "AI Mentor", "System"];
const pageSections = moduleOrder
  .filter((m) => pagesByModule.has(m))
  .map((m) => `<section><h3>${esc(m)}</h3><ul class="pages">${pagesByModule.get(m).map(pageRow).join("")}</ul></section>`)
  .join("\n");

const apiSection = `<ul class="api">${apiRoutes.map(apiRow).join("")}</ul>`;

const componentSections = componentGroups
  .map((g) => `<section><h4>${esc(g.label)} <span class="count">${g.files.length}</span></h4><ul class="files">${g.files.map(fileRow).join("")}</ul></section>`)
  .join("\n");

const libSections = libGroups
  .map((g) => `<section><h4>${esc(g.label)} <span class="count">${g.files.length}</span></h4><ul class="files">${g.files.map(fileRow).join("")}</ul></section>`)
  .join("\n");

const actionsSection = `<ul class="files">${actionFiles.map(fileRow).join("")}</ul>`;
const migrationsSection = `<ul class="files">${migrationFiles.map(fileRow).join("")}</ul>`;

const totalCount = pages.length + apiRoutes.length + componentGroups.reduce((s, g) => s + g.files.length, 0) + libGroups.reduce((s, g) => s + g.files.length, 0) + actionFiles.length + migrationFiles.length;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>JARVIS — Codebase Index</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    --bg-base: #05070A;
    --bg-surface: #0D1117;
    --border-subtle: #1F2732;
    --accent: #22D3EE;
    --accent-warn: #F59E0B;
    --accent-danger: #F43F5E;
    --accent-success: #34D399;
    --text: #E6EDF3;
    --text-muted: #8B98A5;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg-base);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  header {
    padding: 32px 24px 16px;
    border-bottom: 1px solid var(--border-subtle);
    position: sticky;
    top: 0;
    background: rgba(5,7,10,0.92);
    backdrop-filter: blur(6px);
    z-index: 10;
  }
  h1 {
    margin: 0;
    font-family: "SF Mono", "JetBrains Mono", ui-monospace, monospace;
    letter-spacing: 0.15em;
    color: var(--accent);
    font-size: 20px;
  }
  header p { color: var(--text-muted); margin: 6px 0 0; }
  nav.toc {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  nav.toc a {
    color: var(--text);
    text-decoration: none;
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 12px;
  }
  nav.toc a:hover { border-color: var(--accent); color: var(--accent); }
  main { max-width: 1000px; margin: 0 auto; padding: 24px; }
  h2 {
    color: var(--accent);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 8px;
    margin-top: 48px;
  }
  h3 {
    font-size: 13px;
    color: var(--text);
    margin: 20px 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  h4 {
    font-size: 12px;
    color: var(--text-muted);
    margin: 16px 0 6px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .count {
    font-family: ui-monospace, monospace;
    color: var(--text-muted);
    font-weight: normal;
  }
  ul { list-style: none; margin: 0; padding: 0; }
  ul.pages li, ul.api li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 6px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    margin-bottom: 4px;
    flex-wrap: wrap;
  }
  ul.files { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 4px; margin-bottom: 8px; }
  ul.files li {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 5px 8px;
  }
  a.route {
    font-family: ui-monospace, monospace;
    color: var(--text);
    text-decoration: none;
    font-size: 13px;
  }
  a.route:hover { color: var(--accent); }
  a.src {
    margin-left: auto;
    color: var(--text-muted);
    font-size: 11px;
    text-decoration: none;
    font-family: ui-monospace, monospace;
    border-bottom: 1px dotted var(--border-subtle);
  }
  a.src:hover { color: var(--accent); }
  .auth { color: var(--text-muted); font-size: 11px; }
  .methods { display: flex; gap: 4px; }
  .method {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  .m-GET { background: rgba(52,211,153,0.15); color: var(--accent-success); }
  .m-POST { background: rgba(34,211,238,0.15); color: var(--accent); }
  .m-PUT, .m-PATCH { background: rgba(245,158,11,0.15); color: var(--accent-warn); }
  .m-DELETE { background: rgba(244,63,94,0.15); color: var(--accent-danger); }
  .note {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-left: 3px solid var(--accent);
    padding: 10px 14px;
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 12.5px;
    margin-top: 12px;
  }
  footer {
    text-align: center;
    color: var(--text-muted);
    font-size: 11px;
    padding: 40px 24px;
    font-family: ui-monospace, monospace;
  }
</style>
</head>
<body>
<header>
  <h1>JARVIS — CODEBASE INDEX</h1>
  <p>${totalCount} files/routes mapped across pages, API endpoints, components, services, and migrations.</p>
  <nav class="toc">
    <a href="#pages">Pages</a>
    <a href="#api">API Routes</a>
    <a href="#components">Components</a>
    <a href="#lib">Lib / Services</a>
    <a href="#actions">Server Actions</a>
    <a href="#migrations">DB Migrations</a>
  </nav>
</header>
<main>
  <div class="note">
    Route links (<a class="route" href="#" style="border-bottom:1px dotted var(--border-subtle)">/like/this</a>) only resolve when this file is served by the running JARVIS app — open it at <code>/jarvis-index.html</code> on localhost or the deployed site, not as a standalone local file. "source" links open the file on GitHub (private repo — requires your GitHub login).
  </div>

  <h2 id="pages">Pages (${pages.length})</h2>
  ${pageSections}

  <h2 id="api">API Routes (${apiRoutes.length})</h2>
  ${apiSection}

  <h2 id="components">Components (${componentGroups.reduce((s, g) => s + g.files.length, 0)})</h2>
  ${componentSections}

  <h2 id="lib">Lib / Services (${libGroups.reduce((s, g) => s + g.files.length, 0)})</h2>
  ${libSections}

  <h2 id="actions">Server Actions (${actionFiles.length})</h2>
  ${actionsSection}

  <h2 id="migrations">Database Migrations (${migrationFiles.length})</h2>
  ${migrationsSection}
</main>
<footer>Generated by scripts/generate-sitemap.mjs — re-run after adding routes/files to refresh this page.</footer>
</body>
</html>
`;

const outPath = join(ROOT, "public", "jarvis-index.html");
writeFileSync(outPath, html);
console.log(`Wrote ${outPath} (${totalCount} entries: ${pages.length} pages, ${apiRoutes.length} API routes, ${componentGroups.reduce((s, g) => s + g.files.length, 0)} components, ${libGroups.reduce((s, g) => s + g.files.length, 0)} lib files, ${actionFiles.length} actions, ${migrationFiles.length} migrations)`);
