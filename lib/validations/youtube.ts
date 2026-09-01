import { z } from "zod";

export const scriptSectionSchema = z.object({
  label: z.string(),
  startSec: z.number().int().min(0),
  content: z.string(),
});

export const scriptResultSchema = z.object({
  hook: z.string(),
  sections: z.array(scriptSectionSchema),
  scriptBody: z.string(),
  estimatedRuntimeSec: z.number().int().positive(),
  suggestedTitle: z.string(),
  alternativeTitles: z.array(z.string()).length(3),
});
export type ScriptResult = z.infer<typeof scriptResultSchema>;

export const SCRIPT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    hook: { type: "STRING", description: "The opening 5-10 seconds, written to be said aloud" },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          startSec: { type: "INTEGER" },
          content: { type: "STRING" },
        },
        required: ["label", "startSec", "content"],
      },
    },
    scriptBody: { type: "STRING", description: "The full script, hook through outro, written to be read aloud" },
    estimatedRuntimeSec: { type: "INTEGER" },
    suggestedTitle: { type: "STRING" },
    alternativeTitles: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["hook", "sections", "scriptBody", "estimatedRuntimeSec", "suggestedTitle", "alternativeTitles"],
};

export const YT_STATUSES = ["draft", "approved", "used"] as const;
