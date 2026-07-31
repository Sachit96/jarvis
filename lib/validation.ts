import { z } from "zod";

/** Shared Server Action return shape — one definition instead of six near-identical copies. */
export interface ActionState {
  /** Save-conflict / unexpected server failure, rendered above the submit button. */
  error?: string;
  /** Per-field messages, keyed by schema field name, rendered directly under that field. */
  fieldErrors?: Record<string, string>;
}

/** Turns a failed safeParse into an ActionState — first message per field, plus a generic top-level fallback. */
export function actionStateFromZodError(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return {
    error: fieldErrors._form ?? "Check the highlighted fields",
    fieldErrors,
  };
}

/** aria-invalid/aria-describedby for an input, wired to that field's entry in ActionState.fieldErrors. */
export function fieldAria(state: ActionState | undefined, name: string) {
  const message = state?.fieldErrors?.[name];
  return {
    "aria-invalid": message ? true : undefined,
    "aria-describedby": message ? `${name}-error` : undefined,
  };
}

function toNumberOrUndefined(v: unknown) {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? undefined : n;
}

/** Turns "" / null / NaN from a number input into undefined, else a real number. */
export const numericInput = z.preprocess(toNumberOrUndefined, z.number());
export const optionalNumericInput = z.preprocess(toNumberOrUndefined, z.number().optional());

/** Same coercion as `numericInput`, with the given constraints (.min/.max/.positive/.int/...) applied. */
export function numeric(inner: z.ZodNumber) {
  return z.preprocess(toNumberOrUndefined, inner);
}
/** Same coercion as `optionalNumericInput`, with the given constraints applied to the non-empty case. */
export function optionalNumeric(inner: z.ZodNumber) {
  return z.preprocess(toNumberOrUndefined, inner.optional());
}

/**
 * Turns "" / null from a text input into undefined, else a trimmed string.
 * FormData.get() returns null (not undefined) for a field that isn't present
 * in the submitted form at all — z.string().optional() only tolerates
 * undefined, so a schema field with no matching <input> in the form fails
 * validation on every submit unless it goes through this first.
 */
export const optionalTextInput = z.preprocess((v) => {
  if (v === null || v === undefined) return undefined;
  const s = typeof v === "string" ? v.trim() : String(v);
  return s === "" ? undefined : s;
}, z.string().optional());

/** "YYYY-MM-DD" as produced by <input type="date">, validated as a plain string (no timezone parsing surprises). */
export const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

/** Same as `dateInput`, but "" / null / undefined (an unfilled optional date field) pass through as undefined. */
export const optionalDateInput = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return undefined;
  return v;
}, dateInput.optional());
