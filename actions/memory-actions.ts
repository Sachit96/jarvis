"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { memoryEntrySchema } from "@/lib/validations/memory";
import { actionStateFromZodError, type ActionState } from "@/lib/validation";
import { syncOutgoingLinksForRow, getBacklinks, type Backlink } from "@/lib/obsidian/wikilinks";

function revalidateMemory() {
  revalidatePath("/memory");
  revalidatePath("/");
}

export async function createMemoryEntryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = memoryEntrySchema.safeParse({
    type: formData.get("type") || "fact",
    title: formData.get("title"),
    body: formData.get("body"),
    tags: formData.get("tags"),
    source: "manual",
    confidence: formData.get("confidence") || undefined,
    expires_at: formData.get("expires_at"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memory_entries")
    .insert({
      type: parsed.data.type,
      title: parsed.data.title,
      body: parsed.data.body,
      tags: parsed.data.tags,
      source: parsed.data.source,
      confidence: parsed.data.confidence ?? null,
      expires_at: parsed.data.expires_at ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  // [[wikilinks]] in the body — same syntax as the existing Obsidian vault.
  // Never blocks the write itself; a link-parse failure shouldn't lose the note.
  await syncOutgoingLinksForRow(supabase, "memory_entry", data.id, { body: parsed.data.body }).catch(() => {});
  revalidateMemory();
  return {};
}

export async function updateMemoryEntryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing entry id" };

  const parsed = memoryEntrySchema.safeParse({
    type: formData.get("type") || "fact",
    title: formData.get("title"),
    body: formData.get("body"),
    tags: formData.get("tags"),
    source: formData.get("source") || "manual",
    confidence: formData.get("confidence") || undefined,
    expires_at: formData.get("expires_at"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("memory_entries")
    .update({
      type: parsed.data.type,
      title: parsed.data.title,
      body: parsed.data.body,
      tags: parsed.data.tags,
      source: parsed.data.source,
      confidence: parsed.data.confidence ?? null,
      expires_at: parsed.data.expires_at ?? null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  await syncOutgoingLinksForRow(supabase, "memory_entry", id, { body: parsed.data.body }).catch(() => {});
  revalidateMemory();
  return {};
}

export async function deleteMemoryEntryAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("memory_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  // note_links has no FK to memory_entries (source/target can point at any
  // of five tables, so it can't) — clean up both directions manually so a
  // deleted entry doesn't leave orphaned links. getBacklinks/backlink UI
  // already skip a link whose source row is gone, so this is hygiene, not
  // a correctness requirement.
  await supabase.from("note_links").delete().eq("source_type", "memory_entry").eq("source_id", id);
  await supabase.from("note_links").delete().eq("target_type", "memory_entry").eq("target_id", id);
  revalidateMemory();
}

export async function toggleMemoryPinnedAction(id: string, pinned: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("memory_entries").update({ pinned }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateMemory();
}

/** Fetched per-entry, on demand (the drawer calls this when it opens), rather than for every entry on the list page up front — avoids an N-entries x N-domains fan-out of lookups nobody's looking at yet. */
export async function getMemoryEntryBacklinksAction(id: string): Promise<Backlink[]> {
  const supabase = await createClient();
  return getBacklinks(supabase, "memory_entry", id);
}
