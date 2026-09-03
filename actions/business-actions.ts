"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  leadSchema,
  activitySchema,
  dealTaskSchema,
  contractSchema,
  onboardingTaskSchema,
  pipelineStageSchema,
  updateContactNotesSchema,
  updateDealNotesSchema,
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_ONBOARDING_TASKS,
} from "@/lib/validations/business";
import { actionStateFromZodError, type ActionState } from "@/lib/validation";
import { syncOutgoingLinksForRow, getBacklinks, type Backlink } from "@/lib/obsidian/wikilinks";


function revalidateBusiness() {
  revalidatePath("/business/pipeline");
  revalidatePath("/business/clients");
  revalidatePath("/business/revenue");
  revalidatePath("/business/dashboard");
  revalidatePath("/business/leads");
}

// ============================================================= Pipeline stages

export async function ensureDefaultPipelineStagesAction() {
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("pipeline_stages")
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);
  if (count && count > 0) return;

  const { error } = await supabase.from("pipeline_stages").insert(
    DEFAULT_PIPELINE_STAGES.map((s, i) => ({
      name: s.name,
      sort_order: i,
      is_won: s.is_won ?? false,
      is_lost: s.is_lost ?? false,
    })),
  );
  if (error) throw new Error(error.message);
  // No revalidatePath — only ever called at the top of a Server Component's
  // render body, not from a client-triggered action; disallowed there in
  // production, and unnecessary since the page's own query right after this
  // already sees the fresh rows within the same request.
}

export async function createPipelineStageAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = pipelineStageSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { count } = await supabase.from("pipeline_stages").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("pipeline_stages").insert({
    name: parsed.data.name,
    sort_order: count ?? 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/business/pipeline");
  return {};
}

export async function deletePipelineStageAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/business/pipeline");
}

// ============================================================= Leads (contact + deal)

export async function createLeadAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = leadSchema.safeParse({
    company_name: formData.get("company_name"),
    contact_person: formData.get("contact_person"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    value: formData.get("value") || undefined,
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const stageId = String(formData.get("stage_id") ?? "");
  if (!stageId) return { error: "Choose a starting stage" };

  const supabase = await createClient();
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      company_name: parsed.data.company_name || null,
      contact_person: parsed.data.contact_person,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();
  if (contactError) return { error: contactError.message };

  const { error: dealError } = await supabase.from("deals").insert({
    contact_id: contact.id,
    stage_id: stageId,
    value: parsed.data.value ?? 0,
  });
  if (dealError) {
    // Compensate — don't leave an orphan contact with no deal behind.
    await supabase.from("contacts").delete().eq("id", contact.id);
    return { error: dealError.message };
  }

  if (parsed.data.notes) {
    await syncOutgoingLinksForRow(supabase, "contact", contact.id, { notes: parsed.data.notes }).catch(() => {});
  }

  revalidateBusiness();
  return {};
}

export async function deleteContactAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateBusiness();
}

export async function updateDealStageAction(dealId: string, stageId: string) {
  const supabase = await createClient();
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("is_won, is_lost")
    .eq("id", stageId)
    .maybeSingle();
  const isClosed = Boolean(stage?.is_won || stage?.is_lost);

  const { error } = await supabase
    .from("deals")
    .update({ stage_id: stageId, closed_at: isClosed ? new Date().toISOString() : null })
    .eq("id", dealId);
  if (error) throw new Error(error.message);
  revalidateBusiness();
}

export async function deleteDealAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateBusiness();
}

// ============================================================= Activities

export async function createActivityAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = activitySchema.safeParse({
    contact_id: formData.get("contact_id"),
    deal_id: formData.get("deal_id") || undefined,
    type: formData.get("type") || "note",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({
    contact_id: parsed.data.contact_id,
    deal_id: parsed.data.deal_id || null,
    type: parsed.data.type,
    notes: parsed.data.notes,
  });
  if (error) return { error: error.message };
  revalidatePath("/business/clients");
  revalidatePath(`/business/clients/${parsed.data.contact_id}`);
  if (parsed.data.deal_id) revalidatePath(`/business/pipeline/${parsed.data.deal_id}`);
  return {};
}

export async function deleteActivityAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/business/clients");
}

// ============================================================= Deal tasks

export async function createDealTaskAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = dealTaskSchema.safeParse({
    deal_id: formData.get("deal_id"),
    title: formData.get("title"),
    due_date: formData.get("due_date"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("deal_tasks").insert({
    deal_id: parsed.data.deal_id,
    title: parsed.data.title,
    due_date: parsed.data.due_date || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/business/pipeline");
  return {};
}

export async function toggleDealTaskAction(id: string, completed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("deal_tasks").update({ completed }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/business/pipeline");
}

export async function deleteDealTaskAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("deal_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/business/pipeline");
}

// ============================================================= Contracts

export async function createContractAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = contractSchema.safeParse({
    contact_id: formData.get("contact_id"),
    title: formData.get("title"),
    monthly_value: formData.get("monthly_value"),
    status: formData.get("status") || "active",
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("contracts").insert({
    contact_id: parsed.data.contact_id,
    title: parsed.data.title,
    monthly_value: parsed.data.monthly_value,
    status: parsed.data.status,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date || null,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/business/revenue");
  revalidatePath("/business/dashboard");
  return {};
}

export async function updateContractStatusAction(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contracts").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/business/revenue");
  revalidatePath("/business/dashboard");
}

export async function deleteContractAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contracts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/business/revenue");
  revalidatePath("/business/dashboard");
}

// ============================================================= Client onboarding checklist

/**
 * Bug found live tonight (Business Pipeline Cockpit verification): this is
 * called at the top of a Server Component's render body — both the
 * existing /business/clients page and the new /business/clients/[id]
 * detail page — same pattern ensureDefaultPipelineStagesAction's own
 * comment already documents as the only safe way to call it. It used to
 * end with `revalidatePath("/business/clients")`, which Next.js 16
 * rejects outright ("used revalidatePath ... during render") — but ONLY
 * on the branch that actually inserts rows (a brand-new contact with zero
 * onboarding tasks yet), so it silently worked for every already-seeded
 * contact and only crashed the page the first time a truly new contact
 * was opened. Removed for the same reason ensureDefaultPipelineStagesAction
 * has none: the page's own query right after this already sees the fresh
 * rows within the same request, no revalidation needed.
 */
export async function ensureOnboardingTasksAction(contactId: string) {
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("client_onboarding_tasks")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId);
  if (countError) throw new Error(countError.message);
  if (count && count > 0) return;

  const { error } = await supabase.from("client_onboarding_tasks").insert(
    DEFAULT_ONBOARDING_TASKS.map((label, i) => ({
      contact_id: contactId,
      label,
      sort_order: i,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function createOnboardingTaskAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = onboardingTaskSchema.safeParse({
    contact_id: formData.get("contact_id"),
    label: formData.get("label"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { count } = await supabase
    .from("client_onboarding_tasks")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", parsed.data.contact_id);

  const { error } = await supabase.from("client_onboarding_tasks").insert({
    contact_id: parsed.data.contact_id,
    label: parsed.data.label,
    sort_order: count ?? 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/business/clients");
  return {};
}

export async function toggleOnboardingTaskAction(id: string, completed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("client_onboarding_tasks").update({ completed }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/business/clients");
}

export async function deleteOnboardingTaskAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("client_onboarding_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/business/clients");
}

// ============================================================= Detail pages: notes + backlinks

/** /business/clients/[id]'s inline notes editor. Re-syncs outgoing [[wikilinks]] on save (see lib/obsidian/wikilinks.ts) — notes is the one free-text field a contact has to link out to a memory entry, course, or journal entry. */
export async function updateContactNotesAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updateContactNotesSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ notes: parsed.data.notes ?? null }).eq("id", parsed.data.id);
  if (error) return { error: error.message };
  await syncOutgoingLinksForRow(supabase, "contact", parsed.data.id, { notes: parsed.data.notes ?? "" }).catch(() => {});
  revalidatePath(`/business/clients/${parsed.data.id}`);
  revalidatePath("/business/clients");
  return {};
}

/** /business/pipeline/[id]'s inline notes editor — same reasoning as updateContactNotesAction. */
export async function updateDealNotesAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updateDealNotesSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("deals").update({ notes: parsed.data.notes ?? null }).eq("id", parsed.data.id);
  if (error) return { error: error.message };
  await syncOutgoingLinksForRow(supabase, "deal", parsed.data.id, { notes: parsed.data.notes ?? "" }).catch(() => {});
  revalidatePath(`/business/pipeline/${parsed.data.id}`);
  revalidatePath("/business/pipeline");
  return {};
}

export async function getContactBacklinksAction(id: string): Promise<Backlink[]> {
  const supabase = await createClient();
  return getBacklinks(supabase, "contact", id);
}

export async function getDealBacklinksAction(id: string): Promise<Backlink[]> {
  const supabase = await createClient();
  return getBacklinks(supabase, "deal", id);
}
