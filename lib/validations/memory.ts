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

/** Tailwind class fragment for a tinted badge — one fixed color per type, reused everywhere it's shown. */
export const MEMORY_TYPE_BADGE_CLASS: Record<MemoryType, string> = {
  fact: "bg-sky-500/15 text-sky-400",
  preference: "bg-violet-500/15 text-violet-400",
  person: "bg-amber-500/15 text-amber-400",
  project: "bg-cat-business/15 text-cat-business",
  protocol: "bg-cat-money/15 text-cat-money",
  reference: "bg-cat-habits/15 text-cat-habits",
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
