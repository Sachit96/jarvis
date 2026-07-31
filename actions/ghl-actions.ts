"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ghlConnectionSchema } from "@/lib/validations/business";
import { listGhlContacts, listGhlOpportunities, type GhlCredentials } from "@/lib/providers/crm/ghl-client";
import { actionStateFromZodError, type ActionState } from "@/lib/validation";


export interface SyncResult {
  ok: boolean;
  message: string;
}

export async function saveGhlConnectionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ghlConnectionSchema.safeParse({
    private_token: formData.get("private_token"),
    location_id: formData.get("location_id"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  // Exactly one row ever exists — no user_id to key an upsert on, so fetch
  // it first and update/insert accordingly.
  const { data: existing } = await supabase.from("ghl_connections").select("id").maybeSingle();
  const payload = {
    private_token: parsed.data.private_token,
    location_id: parsed.data.location_id,
    is_active: true,
  };
  const { error } = existing
    ? await supabase.from("ghl_connections").update(payload).eq("id", existing.id)
    : await supabase.from("ghl_connections").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

export async function disconnectGhlAction() {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("ghl_connections").select("id").maybeSingle();
  if (!existing) return;
  const { error } = await supabase.from("ghl_connections").delete().eq("id", existing.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

/** Maps a GHL opportunity status to a local pipeline stage; defaults to the first stage. */
function resolveStageId(
  status: string | null,
  stages: { id: string; sort_order: number; is_won: boolean; is_lost: boolean }[],
): string | undefined {
  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  if (status === "won") return sorted.find((s) => s.is_won)?.id ?? sorted[0]?.id;
  if (status === "lost" || status === "abandoned") return sorted.find((s) => s.is_lost)?.id ?? sorted[0]?.id;
  return sorted[0]?.id;
}

export async function syncGhlAction(): Promise<SyncResult> {
  const supabase = await createClient();
  const { data: connection } = await supabase.from("ghl_connections").select("*").maybeSingle();
  if (!connection) return { ok: false, message: "No GoHighLevel connection configured yet." };

  const credentials: GhlCredentials = {
    privateToken: connection.private_token,
    locationId: connection.location_id,
  };

  try {
    const ghlContacts = await listGhlContacts(credentials);
    let contactsSynced = 0;
    for (const c of ghlContacts) {
      const { error } = await supabase.from("contacts").upsert(
        {
          external_id: c.externalId,
          source: "ghl",
          company_name: c.companyName,
          contact_person: c.contactPerson,
          email: c.email,
          phone: c.phone,
        },
        { onConflict: "external_id" },
      );
      if (!error) contactsSynced += 1;
    }

    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, sort_order, is_won, is_lost");
    const { data: localContacts } = await supabase
      .from("contacts")
      .select("id, external_id")
      .not("external_id", "is", null);
    const contactIdByExternalId = new Map((localContacts ?? []).map((c) => [c.external_id as string, c.id]));

    const ghlOpportunities = await listGhlOpportunities(credentials);
    let dealsSynced = 0;
    let dealsSkipped = 0;
    for (const o of ghlOpportunities) {
      const contactId = o.contactExternalId ? contactIdByExternalId.get(o.contactExternalId) : undefined;
      if (!contactId) {
        dealsSkipped += 1;
        continue;
      }
      const stageId = resolveStageId(o.status, stages ?? []);
      if (!stageId) {
        dealsSkipped += 1;
        continue;
      }
      const { error } = await supabase.from("deals").upsert(
        {
          external_id: o.externalId,
          source: "ghl",
          contact_id: contactId,
          stage_id: stageId,
          title: o.name,
          value: o.value,
        },
        { onConflict: "external_id" },
      );
      if (!error) dealsSynced += 1;
    }

    await supabase.from("ghl_connections").update({ last_synced_at: new Date().toISOString() }).eq("id", connection.id);

    const message = `Synced ${contactsSynced} contact(s), ${dealsSynced} deal(s)${
      dealsSkipped > 0 ? ` (${dealsSkipped} deal(s) skipped — no matching contact synced yet)` : ""
    }.`;
    await supabase.from("ghl_sync_logs").insert({
      direction: "inbound",
      event_type: "manual_sync",
      status: "success",
      message,
    });

    revalidatePath("/business/pipeline");
    revalidatePath("/business/clients");
    revalidatePath("/settings");
    return { ok: true, message };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await supabase.from("ghl_sync_logs").insert({
      direction: "inbound",
      event_type: "manual_sync",
      status: "error",
      message,
    });
    revalidatePath("/settings");
    return { ok: false, message };
  }
}
