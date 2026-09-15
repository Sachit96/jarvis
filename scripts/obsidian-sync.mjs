#!/usr/bin/env node
// Obsidian <-> Supabase bidirectional sync (Session 2, Phase 3).
//
// Runs LOCALLY on your Mac, on demand — this is deliberately NOT part of
// the deployed Next.js app. JARVIS runs on Netlify and cannot read your
// filesystem; your vault is local files. Supabase (memory_entries) stays
// the source of truth; the vault is a mirror this script keeps in sync,
// both directions, in one run.
//
// Usage:
//   node scripts/obsidian-sync.mjs --vault="/path/to/Jarvis memory" [--dry-run]
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
// environment — this script reads process.env only, exactly like every
// other script in this repo; it never opens or writes .env.local itself.
// Load them yourself, e.g.:
//   node --env-file=.env.local scripts/obsidian-sync.mjs --vault="..." --dry-run
//
// Self-contained on purpose — does not import anything from lib/, which
// is full of "server-only"-guarded modules meant for the Next.js runtime
// and throws when required from a plain Node script (confirmed live
// while building this). The wikilink-resync logic below is a deliberately
// small, duplicated subset of lib/obsidian/wikilinks.ts's real logic, not
// the same module reused.
//
// Scope: memory_entries only, in a "Memory/" folder at the vault root.
// The existing hand-curated folders (core/, business/, state/, log/,
// protocols/, schema/) are never touched — they're not backed by any DB
// table, so there's nothing for this script to reconcile them against.
//
// SAFETY:
// - Deletion asymmetry: a vault file missing for a row that was
//   previously synced is reported, never used to delete the DB row.
//   A DB row missing for a still-present vault file with a jarvis_id is
//   reported, never used to delete the vault file. Recovery from either
//   is a decision for you, not this script.
// - Conflicts (both sides changed since the last sync) are written to
//   .conflicts/, both versions, never silently resolved either direction.
// - --dry-run computes and prints the full plan and writes NOTHING to
//   either Supabase or the filesystem — genuinely, not "mostly" safe.

import { createClient } from "@supabase/supabase-js";
import matter from "gray-matter";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

// ============================================================= CLI args

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const vaultArg = args.find((a) => a.startsWith("--vault="));
if (!vaultArg) {
  console.error("Usage: node scripts/obsidian-sync.mjs --vault=\"/path/to/vault\" [--dry-run]");
  process.exit(1);
}
const vaultPath = vaultArg.slice("--vault=".length).replace(/^"|"$/g, "");
const memoryFolder = path.join(vaultPath, "Memory");
const conflictsFolder = path.join(vaultPath, ".conflicts");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the environment.");
  console.error('Run with: node --env-file=.env.local scripts/obsidian-sync.mjs --vault="..." [--dry-run]');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

console.log(`[obsidian-sync] vault: ${vaultPath}${dryRun ? " (DRY RUN — no writes)" : ""}`);

// ========================================================== helpers

function slugify(title) {
  const base = (title || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
  return base;
}

function contentHash(fileText) {
  return createHash("sha256").update(fileText, "utf8").digest("hex");
}

function noteToFileText(entry) {
  const fm = {
    jarvis_id: entry.id,
    type: entry.type,
    tags: entry.tags ?? [],
    pinned: entry.pinned ?? false,
    source: entry.source,
    confidence: entry.confidence ?? null,
    expires_at: entry.expires_at ?? null,
    created: entry.created_at,
    updated: entry.updated_at,
  };
  return matter.stringify(entry.body ?? "", fm);
}

/** The small subset of lib/obsidian/wikilinks.ts's parsing this script needs — see the file-header comment on why this isn't a shared import. */
function parseWikilinkTitles(text) {
  const pattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const titles = [];
  for (const match of text.matchAll(pattern)) {
    const title = match[1].trim();
    if (title) titles.push(title);
  }
  return titles;
}

async function resyncOutgoingLinks(memoryEntryId, bodyText) {
  const titles = parseWikilinkTitles(bodyText || "");
  await supabase.from("note_links").delete().eq("source_type", "memory_entry").eq("source_id", memoryEntryId);
  if (titles.length === 0) return;

  const domains = [
    { type: "memory_entry", table: "memory_entries", fields: ["title"] },
    { type: "contact", table: "contacts", fields: ["company_name", "contact_person"] },
    { type: "uni_course", table: "uni_courses", fields: ["code", "name"] },
    { type: "deal", table: "deals", fields: ["title"] },
    { type: "journal_entry", table: "journal_entries", fields: ["title"] },
  ];
  const seen = new Set();
  for (const title of titles) {
    const needle = title.trim().toLowerCase();
    for (const domain of domains) {
      const { data } = await supabase.from(domain.table).select("id, " + domain.fields.join(", "));
      for (const row of data ?? []) {
        const isMatch = domain.fields.some((f) => typeof row[f] === "string" && row[f].trim().toLowerCase() === needle);
        if (!isMatch) continue;
        if (domain.type === "memory_entry" && row.id === memoryEntryId) continue;
        const key = `${domain.type}:${row.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await supabase.from("note_links").insert({ source_type: "memory_entry", source_id: memoryEntryId, target_type: domain.type, target_id: row.id, link_text: title });
      }
    }
  }
}

async function readVaultFiles() {
  // Genuinely no writes in --dry-run, including creating an empty folder —
  // if Memory/ doesn't exist yet, that's just zero existing vault files,
  // which readdir would otherwise throw ENOENT on.
  if (dryRun) {
    try {
      await stat(memoryFolder);
    } catch {
      return [];
    }
  } else {
    await mkdir(memoryFolder, { recursive: true });
  }
  const filenames = (await readdir(memoryFolder)).filter((f) => f.endsWith(".md"));
  const files = [];
  for (const filename of filenames) {
    const filePath = path.join(memoryFolder, filename);
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    files.push({ filename, filePath, raw, frontmatter: parsed.data, body: parsed.content.trim() });
  }
  return files;
}

// ============================================================ main

async function main() {
  const { data: entries, error: entriesError } = await supabase.from("memory_entries").select("*");
  if (entriesError) {
    console.error("Failed to read memory_entries:", entriesError.message);
    process.exit(1);
  }

  const { data: syncStates, error: syncError } = await supabase.from("obsidian_sync_state").select("*");
  if (syncError) {
    console.error("Failed to read obsidian_sync_state — has migration 0028 been applied?", syncError.message);
    process.exit(1);
  }
  const syncStateByEntryId = new Map(syncStates.map((s) => [s.memory_entry_id, s]));

  const vaultFiles = await readVaultFiles();
  const vaultFileByJarvisId = new Map(vaultFiles.filter((f) => f.frontmatter.jarvis_id).map((f) => [f.frontmatter.jarvis_id, f]));
  const entryById = new Map(entries.map((e) => [e.id, e]));

  const plan = { createInVault: [], createInDb: [], updateVaultFromDb: [], updateDbFromVault: [], conflicts: [], deletedLocally: [], deletedRemotely: [], upToDate: 0 };

  // DB -> vault direction: every memory_entries row.
  for (const entry of entries) {
    const syncState = syncStateByEntryId.get(entry.id);
    const vaultFile = vaultFileByJarvisId.get(entry.id);

    if (!syncState) {
      // Never synced before. If a vault file somehow already claims this
      // id (shouldn't happen without a prior sync, but don't assume),
      // treat it as the first sync rather than a fresh create.
      if (!vaultFile) plan.createInVault.push(entry);
      continue;
    }

    if (!vaultFile) {
      // Was synced before; the file isn't there anymore. Deletion
      // asymmetry — report, never delete the DB row over this.
      plan.deletedLocally.push({ entry, syncState });
      continue;
    }

    const dbChanged = new Date(entry.updated_at).getTime() > new Date(syncState.last_synced_at).getTime();
    const localChanged = contentHash(vaultFile.raw) !== syncState.last_synced_content_hash;

    if (dbChanged && localChanged) {
      plan.conflicts.push({ entry, vaultFile, syncState });
    } else if (dbChanged) {
      plan.updateVaultFromDb.push({ entry, vaultFile, syncState });
    } else if (localChanged) {
      plan.updateDbFromVault.push({ entry, vaultFile, syncState });
    } else {
      plan.upToDate++;
    }
  }

  // vault -> DB direction: files whose jarvis_id doesn't match any current row.
  for (const file of vaultFiles) {
    const id = file.frontmatter.jarvis_id;
    if (!id) {
      plan.createInDb.push(file); // brand-new local note, never synced
    } else if (!entryById.has(id)) {
      plan.deletedRemotely.push(file); // the DB row is gone; the file still claims an id that no longer exists
    }
  }

  // ---- report the plan ----
  console.log(`\nPlan:`);
  console.log(`  create in vault:      ${plan.createInVault.length}`);
  console.log(`  create in DB:         ${plan.createInDb.length}`);
  console.log(`  update vault from DB: ${plan.updateVaultFromDb.length}`);
  console.log(`  update DB from vault: ${plan.updateDbFromVault.length}`);
  console.log(`  CONFLICTS:            ${plan.conflicts.length}`);
  console.log(`  deleted locally (DB row kept, needs your decision):     ${plan.deletedLocally.length}`);
  console.log(`  deleted in DB (vault file kept, needs your decision):   ${plan.deletedRemotely.length}`);
  console.log(`  already in sync:      ${plan.upToDate}`);

  for (const { entry } of plan.deletedLocally) console.log(`    - deleted locally: "${entry.title}" (${entry.id}) — vault file is gone, DB row untouched`);
  for (const file of plan.deletedRemotely) console.log(`    - deleted in DB: "${file.frontmatter.title ?? file.filename}" — vault file untouched, run with the row already gone`);
  for (const { entry } of plan.conflicts) console.log(`    - CONFLICT: "${entry.title}" (${entry.id}) — both sides changed since the last sync`);

  if (dryRun) {
    console.log("\nDry run — no writes made.");
    return;
  }

  // ---- execute ----
  await mkdir(conflictsFolder, { recursive: true });
  const nowIso = new Date().toISOString();

  for (const entry of plan.createInVault) {
    const filename = `${slugify(entry.title)}-${entry.id.slice(0, 8)}.md`;
    const filePath = path.join(memoryFolder, filename);
    const fileText = noteToFileText(entry);
    await writeFile(filePath, fileText, "utf8");
    await supabase.from("obsidian_sync_state").upsert({ memory_entry_id: entry.id, vault_relative_path: path.join("Memory", filename), last_synced_content_hash: contentHash(fileText), last_synced_at: nowIso });
    console.log(`  + wrote vault file for "${entry.title}"`);
  }

  for (const file of plan.createInDb) {
    const id = randomUUID();
    const title = file.frontmatter.title || file.filename.replace(/\.md$/, "");
    const { error } = await supabase.from("memory_entries").insert({
      id,
      type: ["fact", "preference", "person", "project", "protocol", "reference"].includes(file.frontmatter.type) ? file.frontmatter.type : "fact",
      title,
      body: file.body,
      tags: Array.isArray(file.frontmatter.tags) ? file.frontmatter.tags : [],
      source: "manual",
      pinned: Boolean(file.frontmatter.pinned),
    });
    if (error) {
      console.error(`  ! failed to create DB row for "${file.filename}": ${error.message}`);
      continue;
    }
    await resyncOutgoingLinks(id, file.body);
    // Rewrite the file with its new jarvis_id so this maps correctly next run.
    const { data: created } = await supabase.from("memory_entries").select("*").eq("id", id).single();
    const fileText = noteToFileText(created);
    await writeFile(file.filePath, fileText, "utf8");
    await supabase.from("obsidian_sync_state").upsert({ memory_entry_id: id, vault_relative_path: path.relative(vaultPath, file.filePath), last_synced_content_hash: contentHash(fileText), last_synced_at: nowIso });
    console.log(`  + created DB row for "${title}"`);
  }

  for (const { entry, vaultFile } of plan.updateVaultFromDb) {
    const fileText = noteToFileText(entry);
    await writeFile(vaultFile.filePath, fileText, "utf8");
    await supabase.from("obsidian_sync_state").upsert({ memory_entry_id: entry.id, vault_relative_path: path.relative(vaultPath, vaultFile.filePath), last_synced_content_hash: contentHash(fileText), last_synced_at: nowIso });
    console.log(`  > updated vault file for "${entry.title}" (DB was newer)`);
  }

  for (const { entry, vaultFile } of plan.updateDbFromVault) {
    const title = vaultFile.frontmatter.title || entry.title;
    const { error } = await supabase
      .from("memory_entries")
      .update({ title, body: vaultFile.body, tags: Array.isArray(vaultFile.frontmatter.tags) ? vaultFile.frontmatter.tags : entry.tags, pinned: Boolean(vaultFile.frontmatter.pinned) })
      .eq("id", entry.id);
    if (error) {
      console.error(`  ! failed to update DB row for "${entry.title}": ${error.message}`);
      continue;
    }
    await resyncOutgoingLinks(entry.id, vaultFile.body);
    await supabase.from("obsidian_sync_state").upsert({ memory_entry_id: entry.id, vault_relative_path: path.relative(vaultPath, vaultFile.filePath), last_synced_content_hash: contentHash(vaultFile.raw), last_synced_at: nowIso });
    console.log(`  < updated DB row for "${title}" (vault was newer)`);
  }

  for (const { entry, vaultFile } of plan.conflicts) {
    const stamp = nowIso.replace(/[:.]/g, "-");
    const slug = slugify(entry.title);
    const localConflictPath = path.join(conflictsFolder, `${stamp}-${slug}-local.md`);
    const remoteConflictPath = path.join(conflictsFolder, `${stamp}-${slug}-remote.md`);
    await writeFile(localConflictPath, vaultFile.raw, "utf8");
    await writeFile(remoteConflictPath, noteToFileText(entry), "utf8");
    console.log(`  ! CONFLICT on "${entry.title}" — wrote both versions to .conflicts/, neither side touched. Resolve manually and re-run.`);
  }

  console.log(dryRun ? "\nDry run complete." : "\nSync complete.");
}

main().catch((err) => {
  console.error("[obsidian-sync] fatal:", err);
  process.exit(1);
});
