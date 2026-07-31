// Shared shapes passed between the three pipeline stages (Discovery -> Audit
// -> Qualification). Kept separate from lib/validations/lead-research.ts,
// which is the LLM's *output* contract — these are our own code's internal
// data, never parsed from an external response, so they're plain interfaces
// rather than Zod schemas.

/** A single result from Places Text Search (New), trimmed to the field mask we actually store. */
export interface PlaceResult {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
  nationalPhoneNumber: string | null;
  googleMapsUri: string;
  businessStatus: string;
}

/** Mechanical signals extracted from a fetched homepage — Stage 2's own output, no LLM involved yet. */
export interface AuditSignals {
  /** True when the site couldn't be fetched at all, timed out, or robots.txt disallows it. Everything below is null/default in that case. */
  auditBlocked: boolean;
  blockedReason?: string;
  https: boolean;
  hasViewportMeta: boolean;
  title: string | null;
  metaDescription: string | null;
  hasGenericTitle: boolean;
  ctas: {
    tel: boolean;
    mailto: boolean;
    form: boolean;
    bookingWords: boolean;
  };
  bookingSystems: string[];
  chatWidgets: string[];
  footerCopyrightYear: number | null;
  framework: string | null;
  imageCount: number;
  imagesWithAlt: number;
  hasSocialLinks: boolean;
  hasTestimonials: boolean;
  extractedEmail: string | null;
}

/** Stage 2's PageSpeed Insights call (mobile strategy) — null wholesale on failure/timeout, never blocks the run. */
export interface PageSpeedResult {
  performanceScore: number | null;
  lcpMs: number | null;
}

/** Everything Stage 3's qualification call sees. No website is a valid, meaningful state, not an error. */
export interface LeadSignals {
  place: PlaceResult;
  hasWebsite: boolean;
  audit: AuditSignals | null;
  pageSpeed: PageSpeedResult | null;
}
