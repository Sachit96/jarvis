import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateResearchRun } from "@/lib/db/queries/lead-research";

/** The job loop checks status between businesses — this is the whole "resume" story for v1: a cancelled run's completed leads are already saved. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  await updateResearchRun(supabase, id, { status: "cancelled" });
  return NextResponse.json({ ok: true });
}
