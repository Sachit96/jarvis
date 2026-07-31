"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { memoryEntrySchema } from "@/lib/validations/memory";
import { actionStateFromZodError, type ActionState } from "@/lib/validation";

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
  const { error } = await supabase.from("memory_entries").insert({
    type: parsed.data.type,
    title: parsed.data.title,
    body: parsed.data.body,
    tags: parsed.data.tags,
    source: parsed.data.source,
    confidence: parsed.data.confidence ?? null,
    expires_at: parsed.data.expires_at ?? null,
  });
  if (error) return { error: error.message };
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
  revalidateMemory();
  return {};
}

export async function deleteMemoryEntryAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("memory_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateMemory();
}

export async function toggleMemoryPinnedAction(id: string, pinned: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("memory_entries").update({ pinned }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateMemory();
}
