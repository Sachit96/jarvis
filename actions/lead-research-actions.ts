"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { savedLeadSearchSchema } from "@/lib/validations/lead-research";
import { createSavedLeadSearch, setSavedLeadSearchEnabled, deleteSavedLeadSearch } from "@/lib/db/queries/lead-research";
import { actionStateFromZodError, type ActionState } from "@/lib/validation";

export async function createSavedLeadSearchAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = savedLeadSearchSchema.safeParse({
    label: formData.get("label"),
    keyword: formData.get("keyword"),
    city: formData.get("city"),
    region: formData.get("region"),
    country: formData.get("country"),
    radius_km: formData.get("radius_km"),
    min_reviews: formData.get("min_reviews"),
    max_reviews: formData.get("max_reviews"),
    must_have_website: formData.get("must_have_website"),
    max_results: formData.get("max_results"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);

  const supabase = await createClient();
  await createSavedLeadSearch(supabase, parsed.data);
  revalidatePath("/settings");
  return {};
}

export async function toggleSavedLeadSearchAction(id: string, enabled: boolean): Promise<void> {
  const supabase = await createClient();
  await setSavedLeadSearchEnabled(supabase, id, enabled);
  revalidatePath("/settings");
}

export async function deleteSavedLeadSearchAction(id: string): Promise<void> {
  const supabase = await createClient();
  await deleteSavedLeadSearch(supabase, id);
  revalidatePath("/settings");
}
