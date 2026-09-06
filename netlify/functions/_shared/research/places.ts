import type { PlaceResult } from "../../../../lib/research/types";
import type { ResearchRunParams } from "../../../../lib/validations/lead-research";

// Deliberate duplicate of lib/research/places.ts — see
// _shared/admin-client.ts's comment for why. Only the guard line and the
// two type-only import paths differ from the original; everything else is
// unchanged logic.

const SEARCH_TEXT_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";

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

async function readErrorBody(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(text);
    return parsed?.error?.message ?? text;
  } catch {
    return text;
  }
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
    throw new Error(`Places Text Search failed: ${res.status} ${res.statusText} — ${await readErrorBody(res)}`);
  }
  const data = await res.json();
  return { places: data.places ?? [], nextPageToken: data.nextPageToken };
}

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

function boundingRectangle(center: { latitude: number; longitude: number }, radiusMeters: number) {
  const METERS_PER_DEGREE_LAT = 111_320;
  const latDelta = radiusMeters / METERS_PER_DEGREE_LAT;
  const lngDelta = radiusMeters / (METERS_PER_DEGREE_LAT * Math.cos((center.latitude * Math.PI) / 180));
  return {
    low: { latitude: center.latitude - latDelta, longitude: center.longitude - lngDelta },
    high: { latitude: center.latitude + latDelta, longitude: center.longitude + lngDelta },
  };
}

export async function searchPlaces(params: ResearchRunParams): Promise<PlaceResult[]> {
  const centroid = await resolveCentroid(params.city, params.region, params.country);
  const radiusMeters = Math.min(params.radius_km * 1000, 50000); // Places caps circle radius at 50km
  const rectangle = boundingRectangle(centroid, radiusMeters);

  const collected: RawPlace[] = [];
  let pageToken: string | undefined;
  do {
    const remaining = params.max_results - collected.length;
    const { places, nextPageToken } = await searchText(
      {
        textQuery: params.keyword,
        locationRestriction: { rectangle },
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

export async function getPlaceDetails(placeId: string): Promise<PlaceResult> {
  const res = await fetch(`${PLACE_DETAILS_ENDPOINT}/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": FIELD_MASK.replace(/places\./g, "").replace(",nextPageToken", ""),
    },
  });
  if (!res.ok) {
    throw new Error(`Place Details failed: ${res.status} ${res.statusText} — ${await readErrorBody(res)}`);
  }
  const raw: RawPlace = await res.json();
  const place = toPlaceResult(raw);
  if (!place) throw new Error(`Place Details returned incomplete data for ${placeId}`);
  return place;
}
