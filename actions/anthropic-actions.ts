"use server";

import { revalidatePath } from "next/cache";
import { setAnthropicSpendCap } from "@/lib/ai/providers/anthropic-client";

export async function updateAnthropicSpendCapAction(capUsd: number): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isFinite(capUsd) || capUsd < 0) return { ok: false, error: "Enter a valid non-negative amount" };
  await setAnthropicSpendCap(capUsd);
  revalidatePath("/settings");
  return { ok: true };
}
