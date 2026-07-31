import "server-only";
import type { PlaceResult } from "@/lib/research/types";
import type { ResearchRunParams } from "@/lib/validations/lead-research";

const SEARCH_TEXT_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// Only what we store (lib/db/queries mirrors this into contacts/deals/lead_research) —
// Places New bills by which fields you request, so this field mask is deliberately
// exact, not "everything available".
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.googleMapsUri",
  "places.businessStatus",
  "nextPageToken",
].join(",");

// Resolving just a city name doesn't need the expensive field set.
const CENTROID_FIELD_MASK = "places.location";

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  businessStatus?: string;
}

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  return key;
}

async function searchText(body: Record<string, unknown>, fieldMask: string): Promise<{ places: RawPlace[]; nextPageToken?: string }> {
  const res = await fetch(SEARCH_TEXT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Places Text Search failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return { places: data.places ?? [], nextPageToken: data.nextPageToken };
}

/**
 * Resolves "city, region, country" to a lat/lng centroid via Places itself
 * (no separate Geocoding API/key needed). Deliberately a SEPARATE call from
 * the real business search — Places silently ignores locationBias/
 * locationRestriction whenever textQuery already names an explicit location,
 * so the real search below must NOT include the city name in its textQuery.
 */
async function resolveCentroid(city: string, region: string | undefined, country: string): Promise<{ latitude: number; longitude: number }> {
  const textQuery = [city, region, country].filter(Boolean).join(", ");
  const { places } = await searchText({ textQuery }, CENTROID_FIELD_MASK);
  const location = places[0]?.location;
  if (location?.latitude === undefined || location?.longitude === undefined) {
    throw new Error(`Could not resolve a location for "${textQuery}" — check the city/region/country spelling`);
  }
  return { latitude: location.latitude, longitude: location.longitude };
}

function toPlaceResult(raw: RawPlace): PlaceResult | null {
  if (!raw.id || raw.location?.latitude === undefined || raw.location?.longitude === undefined) return null;
  return {
    placeId: raw.id,
    displayName: raw.displayName?.text ?? "Unknown business",
    formattedAddress: raw.formattedAddress ?? "",
    lat: raw.location!.latitude!,
    lng: raw.location!.longitude!,
    rating: raw.rating ?? null,
    userRatingCount: raw.userRatingCount ?? null,
    websiteUri: raw.websiteUri ?? null,
    nationalPhoneNumber: raw.nationalPhoneNumber ?? null,
    googleMapsUri: raw.googleMapsUri ?? "",
    businessStatus: raw.businessStatus ?? "UNKNOWN",
  };
}

/**
 * Discovery stage. textQuery is the keyword ONLY (see resolveCentroid's
 * comment for why) — location targeting happens entirely through
 * locationRestriction, which unlike locationBias is a hard filter Places
 * won't silently drop results outside of.
 */
export async function searchPlaces(params: ResearchRunParams): Promise<PlaceResult[]> {
  const centroid = await resolveCentroid(params.city, params.region, params.country);
  const radiusMeters = Math.min(params.radius_km * 1000, 50000); // Places caps circle radius at 50km

  const collected: RawPlace[] = [];
  let pageToken: string | undefined;
  do {
    const remaining = params.max_results - collected.length;
    const { places, nextPageToken } = await searchText(
      {
        textQuery: params.keyword,
        locationRestriction: { circle: { center: centroid, radius: radiusMeters } },
        pageSize: Math.min(20, Math.max(remaining, 1)),
        ...(pageToken ? { pageToken } : {}),
      },
      FIELD_MASK,
    );
    collected.push(...places);
    pageToken = collected.length < params.max_results ? nextPageToken : undefined;
  } while (pageToken);

  const results = collected
    .map(toPlaceResult)
    .filter((p): p is PlaceResult => p !== null)
    .filter((p) => p.businessStatus === "OPERATIONAL")
    .filter((p) => (params.min_reviews == null ? true : (p.userRatingCount ?? 0) >= params.min_reviews))
    .filter((p) => (params.max_reviews == null ? true : (p.userRatingCount ?? 0) <= params.max_reviews))
    .filter((p) => {
      if (params.must_have_website === "yes") return !!p.websiteUri;
      if (params.must_have_website === "no") return !p.websiteUri;
      return true;
    });

  return results.slice(0, params.max_results);
}
