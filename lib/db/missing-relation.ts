/**
 * Standing rule (not per-incident) after three live breakages this
 * session from code shipping ahead of its own migration —
 * memory_entries, the gemini_usage RPC signature, and gemini_usage's
 * `model` column: every query or mutation that touches a table/column
 * from a migration that might not be applied yet must check for these
 * codes and degrade gracefully (empty data, a clear "not set up yet"
 * message, or a safe default) instead of throwing past the caller.
 *
 * - PGRST205: PostgREST — table not in schema cache (table doesn't exist)
 * - PGRST202: PostgREST — function not in schema cache (RPC doesn't exist)
 * - 42P01: Postgres — undefined_table
 * - 42703: Postgres — undefined_column (e.g. a column a newer migration adds)
 */
export function isMissingRelation(error: { code?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || error.code === "PGRST202" || error.code === "42P01" || error.code === "42703";
}
