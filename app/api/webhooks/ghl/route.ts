import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Receives GoHighLevel webhook events (lead/contact updates, opportunity
 * stage changes) and mirrors them into Supabase. Configure this URL in GHL
 * as: https://<your-domain>/api/webhooks/ghl?secret=<GHL_WEBHOOK_SECRET>
 *
 * GHL's own webhook signature scheme wasn't confirmed against current docs
 * this session (the docs site is a JS-rendered SPA this tool can't fully
 * inspect), so this uses a simple shared-secret query param instead — set
 * GHL_WEBHOOK_SECRET in your environment and use the same value in the URL
 * you register with GHL. Upgrade to signature verification if/when GHL's
 * exact header-based scheme is confirmed.
 *
 * Every request is logged to ghl_sync_logs (including unparseable ones) so
 * the raw payload shape can be inspected and the parsing below refined.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  const provided = request.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const locationId = String((payload as Record<string, unknown>).locationId ?? "");
  const admin = createAdminClient();

  if (!locationId) {
    // Can't attribute this event to a user without a locationId — nothing to log against.
    return NextResponse.json({ ok: true, note: "No locationId in payload, ignored" });
  }

  const { data: connection } = await admin
    .from("ghl_connections")
    .select("id")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ ok: true, note: "No matching connection for this locationId" });
  }

  const eventType = String((payload as Record<string, unknown>).type ?? "unknown");

  try {
    await handleEvent(admin, payload as Record<string, unknown>);
    await admin.from("ghl_sync_logs").insert({
      direction: "inbound",
      event_type: eventType,
      status: "success",
      payload,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await admin.from("ghl_sync_logs").insert({
      direction: "inbound",
      event_type: eventType,
      status: "error",
      message: err instanceof Error ? err.message : "Unhandled webhook error",
      payload,
    });
    // Still 200 — the event is logged for inspection; returning an error here
    // would just cause GHL to retry a payload shape we don't yet understand.
    return NextResponse.json({ ok: true, note: "Logged with a parse error" });
  }
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function handleEvent(admin: AdminClient, payload: Record<string, unknown>) {
  const contactId = pickString(payload, "contactId") ?? (looksLikeContact(payload) ? pickString(payload, "id") : null);

  if (looksLikeContact(payload)) {
    const id = pickString(payload, "id");
    if (id) {
      const firstName = pickString(payload, "firstName") ?? "";
      const lastName = pickString(payload, "lastName") ?? "";
      const name = pickString(payload, "contactName", "name") ?? `${firstName} ${lastName}`.trim();
      await admin.from("contacts").upsert(
        {
          external_id: id,
          source: "ghl",
          company_name: pickString(payload, "companyName"),
          contact_person: name || "Unnamed contact",
          email: pickString(payload, "email"),
          phone: pickString(payload, "phone"),
        },
        { onConflict: "external_id" },
      );
    }
  }

  if (looksLikeOpportunity(payload)) {
    const id = pickString(payload, "id");
    const linkedContactExternalId = contactId ?? pickString(payload, "contactId");
    if (id && linkedContactExternalId) {
      const { data: localContact } = await admin
        .from("contacts")
        .select("id")
        .eq("external_id", linkedContactExternalId)
        .maybeSingle();
      const { data: stages } = await admin
        .from("pipeline_stages")
        .select("id, sort_order, is_won, is_lost")
        .order("sort_order", { ascending: true });

      if (localContact && stages && stages.length > 0) {
        const status = pickString(payload, "status");
        const stageId =
          status === "won"
            ? (stages.find((s) => s.is_won)?.id ?? stages[0].id)
            : status === "lost" || status === "abandoned"
              ? (stages.find((s) => s.is_lost)?.id ?? stages[0].id)
              : stages[0].id;

        const rawValue = payload.monetaryValue ?? payload.value;
        await admin.from("deals").upsert(
          {
            external_id: id,
            source: "ghl",
            contact_id: localContact.id,
            stage_id: stageId,
            title: pickString(payload, "name", "title"),
            value: typeof rawValue === "number" ? rawValue : Number(rawValue) || 0,
          },
          { onConflict: "external_id" },
        );
      }
    }
  }
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function looksLikeContact(payload: Record<string, unknown>): boolean {
  return "firstName" in payload || "lastName" in payload || "companyName" in payload || "contactName" in payload;
}

function looksLikeOpportunity(payload: Record<string, unknown>): boolean {
  return "pipelineStageId" in payload || "monetaryValue" in payload || "pipelineId" in payload;
}
