import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResearchRun } from "@/lib/db/queries/lead-research";

/** Polled every 2s from the run panel's client component. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const run = await getResearchRun(supabase, id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json(run);
}
