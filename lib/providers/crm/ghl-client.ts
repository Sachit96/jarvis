import "server-only";

// GoHighLevel API v2. Verified against public docs this session:
// base URL, the required Version header, and Bearer-token auth are confirmed;
// exact response field names below are best-effort and parsed defensively
// (multiple fallback keys) since GHL's docs site couldn't be fully inspected.
// If a sync produces unexpected results, check ghl_sync_logs.payload for the
// raw response and adjust the field mapping below.
const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

export interface GhlCredentials {
  privateToken: string;
  locationId: string;
}

export interface GhlContact {
  externalId: string;
  companyName: string | null;
  contactPerson: string;
  email: string | null;
  phone: string | null;
}

export interface GhlOpportunity {
  externalId: string;
  name: string | null;
  value: number;
  status: string | null;
  contactExternalId: string | null;
}

class GhlApiError extends Error {}

async function ghlFetch(path: string, credentials: GhlCredentials): Promise<unknown> {
  const res = await fetch(`${GHL_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${credentials.privateToken}`,
      Version: GHL_API_VERSION,
      "Content-Type": "application/json",
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (typeof body === "object" && body && "message" in body && String((body as { message: unknown }).message)) ||
      `GHL API error (${res.status})`;
    throw new GhlApiError(message);
  }
  return body;
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  return [];
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

export async function listGhlContacts(credentials: GhlCredentials): Promise<GhlContact[]> {
  const body = await ghlFetch(`/contacts/?locationId=${encodeURIComponent(credentials.locationId)}&limit=100`, credentials);
  const raw = asArray((body as Record<string, unknown>)?.contacts ?? (body as Record<string, unknown>)?.data);

  return raw
    .map((c) => {
      const id = pickString(c, "id", "_id");
      if (!id) return null;
      const firstName = pickString(c, "firstName") ?? "";
      const lastName = pickString(c, "lastName") ?? "";
      const name = pickString(c, "contactName", "name") ?? `${firstName} ${lastName}`.trim();
      return {
        externalId: id,
        companyName: pickString(c, "companyName"),
        contactPerson: name || "Unnamed contact",
        email: pickString(c, "email"),
        phone: pickString(c, "phone"),
      };
    })
    .filter((c): c is GhlContact => c !== null);
}

export async function listGhlOpportunities(credentials: GhlCredentials): Promise<GhlOpportunity[]> {
  const body = await ghlFetch(
    `/opportunities/search?location_id=${encodeURIComponent(credentials.locationId)}&limit=100`,
    credentials,
  );
  const raw = asArray((body as Record<string, unknown>)?.opportunities ?? (body as Record<string, unknown>)?.data);

  return raw
    .map((o) => {
      const id = pickString(o, "id", "_id");
      if (!id) return null;
      const value = o.monetaryValue ?? o.value ?? 0;
      return {
        externalId: id,
        name: pickString(o, "name", "title"),
        value: typeof value === "number" ? value : Number(value) || 0,
        status: pickString(o, "status"),
        contactExternalId: pickString(o, "contactId"),
      };
    })
    .filter((o): o is GhlOpportunity => o !== null);
}
