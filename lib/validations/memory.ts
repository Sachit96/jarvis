import { z } from "zod";
import { optionalNumeric, optionalDateInput } from "@/lib/validation";

export const MEMORY_TYPES = ["fact", "preference", "person", "project", "protocol", "reference"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_TYPE_LABEL: Record<MemoryType, string> = {
  fact: "Fact",
  preference: "Preference",
  person: "Person",
  project: "Project",
  protocol: "Protocol",
  reference: "Reference",
};

/**
 * One neutral chip for every memory type.
 *
 * This was six different hues — sky, violet, amber, and three category
 * colours — on a badge that already spells the type out in words next to
 * itself. The colour carried nothing the label didn't, and a library of a
 * few dozen entries turned into a swatch board. Emphasis in this module is
 * spent on pinned entries and the active filter, where it means something.
 */
export const MEMORY_TYPE_BADGE_CLASS: Record<MemoryType, string> = {
  fact: "bg-white/[0.06] text-foreground-secondary",
  preference: "bg-white/[0.06] text-foreground-secondary",
  person: "bg-white/[0.06] text-foreground-secondary",
  project: "bg-white/[0.06] text-foreground-secondary",
  protocol: "bg-white/[0.06] text-foreground-secondary",
  reference: "bg-white/[0.06] text-foreground-secondary",
};

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

export const memoryEntrySchema = z.object({
  type: z.enum(MEMORY_TYPES),
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().min(1, "Write something first").max(20000),
  tags: z.preprocess(parseTags, z.array(z.string().trim().min(1).max(40)).max(20)),
  source: z.enum(["manual", "captured"]).default("manual"),
  pinned: z.coerce.boolean().optional().default(false),
  confidence: optionalNumeric(z.number().int().min(0).max(100)),
  expires_at: optionalDateInput,
});
export type MemoryEntryInput = z.infer<typeof memoryEntrySchema>;
