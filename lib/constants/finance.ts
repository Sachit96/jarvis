// Plain UI-facing data only — no Zod/validation runtime here. Client
// components import from this file instead of lib/validations/finance.ts so
// they don't drag the whole Zod schema bundle into their JS chunk just for a
// string array (see bundle audit: this alone was ~90KB gzip on two routes).
export const SUGGESTED_CATEGORIES = ["Business", "Personal", "Software", "Trading", "Living"];
