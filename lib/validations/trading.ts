import { z } from "zod";

const sentimentEnum = z.enum(["bullish", "bearish", "choppy"]);

export const marketAnalysisSchema = z.object({
  pair: z.string().trim().min(1, "Pair is required").max(20),
  analysis_date: z.string().min(1),
  weekly_sentiment: sentimentEnum.optional(),
  weekly_notes: z.string().trim().max(2000).optional().or(z.literal("")),
  daily_sentiment: sentimentEnum.optional(),
  daily_notes: z.string().trim().max(2000).optional().or(z.literal("")),
  h4_sentiment: sentimentEnum.optional(),
  h4_notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type MarketAnalysisInput = z.infer<typeof marketAnalysisSchema>;

export const checklistItemSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(120),
});
export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;

export const DEFAULT_CHECKLIST_ITEMS = [
  "Aligns with higher-timeframe bias",
  "Clean market structure / liquidity taken",
  "Clear invalidation (stop loss) level",
  "Risk is within my daily/weekly limit",
  "Reward-to-risk is at least 2:1",
];
