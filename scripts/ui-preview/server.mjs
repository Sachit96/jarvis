/**
 * A stand-in for PostgREST, for visual QA only. See ./README.md.
 *
 * Speaks just enough of the protocol that @supabase/supabase-js is happy:
 * table reads, the single/maybeSingle object representation, exact counts,
 * and RPC. Writes are accepted and thrown away — nothing here persists
 * anything, and this process has no database driver of any kind.
 */
import { createServer } from "node:http";
import { fixtures, rpcResults } from "./fixtures.mjs";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const port = Number(argOf("port", "54321"));
const scenario = argOf("scenario", "empty");

/** Every table resolves; unknown tables are empty rather than a 404, so a
 *  page reading a table the fixtures forgot renders its empty state instead
 *  of a 500 that would look like a bug in the page. */
function rowsFor(table) {
  if (scenario === "empty") return [];
  return fixtures[table] ?? [];
}

/** PostgREST reserves these; everything else in the query string is a filter. */
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function coerce(raw) {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  const unquoted = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  const n = Number(unquoted);
  return unquoted !== "" && !Number.isNaN(n) ? n : unquoted;
}

/**
 * Apply the subset of PostgREST filtering the app actually uses.
 *
 * This matters more than it looks: without it the harness hands pages rows
 * the real database would have excluded, and they crash on assumptions that
 * hold in production. The first run of this harness "found" a null-timestamp
 * crash on Home that was purely the stub ignoring `.not("completed_at", "is", null)`.
 */
function matches(row, column, expr) {
  let negate = false;
  let rest = expr;
  if (rest.startsWith("not.")) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf(".");
  const op = dot === -1 ? rest : rest.slice(0, dot);
  const raw = dot === -1 ? "" : rest.slice(dot + 1);
  const actual = row[column];
  let hit;
  switch (op) {
    case "is":
      hit = actual === coerce(raw);
      break;
    case "eq":
      hit = String(actual) === String(coerce(raw));
      break;
    case "neq":
      hit = String(actual) !== String(coerce(raw));
      break;
    case "gt":
      hit = actual > coerce(raw);
      break;
    case "gte":
      hit = actual >= coerce(raw);
      break;
    case "lt":
      hit = actual < coerce(raw);
      break;
    case "lte":
      hit = actual <= coerce(raw);
      break;
    case "in": {
      const list = raw.replace(/^\(|\)$/g, "").split(",").map((v) => String(coerce(v)));
      hit = list.includes(String(actual));
      break;
    }
    case "like":
    case "ilike": {
      const pattern = new RegExp(`^${raw.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`, op === "ilike" ? "i" : "");
      hit = pattern.test(String(actual ?? ""));
      break;
    }
    case "cs":
      hit = Array.isArray(actual) && raw.replace(/^\{|\}$/g, "").split(",").every((v) => actual.includes(v));
      break;
    default:
      // An operator the harness does not model must not silently drop rows.
      hit = true;
  }
  return negate ? !hit : hit;
}

function applyQuery(rows, url) {
  let out = rows;
  for (const [key, value] of url.searchParams) {
    if (RESERVED.has(key) || key.startsWith("or(")) continue;
    out = out.filter((row) => matches(row, key, value));
  }

  const order = url.searchParams.get("order");
  if (order) {
    const specs = order.split(",").map((part) => {
      const [column, ...mods] = part.split(".");
      return { column, desc: mods.includes("desc") };
    });
    out = [...out].sort((a, b) => {
      for (const { column, desc } of specs) {
        const av = a[column];
        const bv = b[column];
        if (av === bv) continue;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : 1;
        return desc ? -cmp : cmp;
      }
      return 0;
    });
  }

  const limit = url.searchParams.get("limit");
  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (offset) out = out.slice(offset);
  if (limit) out = out.slice(0, Number(limit));
  return out;
}

/**
 * PostgREST returns 406/PGRST116 for `.single()` against zero rows;
 * supabase-js turns that into `data: null` for `.maybeSingle()` and an
 * error for `.single()`. Emulating it is what keeps pages that read a
 * settings row rendering their "not configured yet" branch.
 */
function respondObject(res, rows) {
  if (rows.length === 0) {
    res.writeHead(406, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        code: "PGRST116",
        details: "The result contains 0 rows",
        hint: null,
        message: "JSON object requested, multiple (or no) rows returned",
      }),
    );
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(rows[0]));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  const accept = req.headers.accept ?? "";
  const wantsObject = accept.includes("vnd.pgrst.object");
  const path = url.pathname.replace(/^\/rest\/v1\/?/, "");

  // Drain the body so the client's write is not left hanging, then discard it.
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    if (path.startsWith("rpc/")) {
      const fn = path.slice(4);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(rpcResults[fn] ?? null));
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      const rows = applyQuery(rowsFor(path), url);
      if (wantsObject) return respondObject(res, rows);
      res.writeHead(200, {
        "content-type": "application/json",
        "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
      });
      res.end(req.method === "HEAD" ? "" : JSON.stringify(rows));
      return;
    }

    // Writes: acknowledged, never stored. Echoing the payload back is what
    // `.insert(...).select().single()` expects, so an action that renders
    // its result does not crash the page under QA.
    let echoed = [];
    try {
      const parsed = body ? JSON.parse(body) : [];
      echoed = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      echoed = [];
    }
    if (wantsObject) return respondObject(res, echoed.length ? echoed : [{}]);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(echoed));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[ui-preview] stub PostgREST on :${port} (scenario: ${scenario})`);
});
