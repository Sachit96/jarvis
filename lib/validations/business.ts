import { z } from "zod";
import { numeric, optionalNumeric, optionalTextInput, dateInput, optionalDateInput } from "@/lib/validation";

export const DEFAULT_PIPELINE_STAGES: { name: string; is_won?: boolean; is_lost?: boolean }[] = [
  { name: "Lead" },
  { name: "Contacted" },
  { name: "Meeting Scheduled" },
  { name: "Proposal Sent" },
  { name: "Closed Won", is_won: true },
  { name: "Closed Lost", is_lost: true },
];

export const DEFAULT_ONBOARDING_TASKS = [
  "Contract signed",
  "Kickoff call scheduled",
  "Access & credentials shared",
  "Welcome packet sent",
  "First deliverable scheduled",
];

export const leadSchema = z.object({
  company_name: optionalTextInput,
  contact_person: z.string().trim().min(1, "Contact person is required").max(200),
  email: optionalTextInput,
  phone: optionalTextInput,
  value: optionalNumeric(z.number().min(0, "Value can't be negative").max(100_000_000)),
  notes: optionalTextInput,
});
export type LeadInput = z.infer<typeof leadSchema>;

export const activitySchema = z.object({
  contact_id: z.string().uuid(),
  deal_id: z.preprocess((v) => (v === null || v === "" ? undefined : v), z.string().uuid().optional()),
  type: z.enum(["call", "email", "meeting", "note", "other"]),
  notes: z.string().trim().min(1, "Notes are required").max(2000),
});
export type ActivityInput = z.infer<typeof activitySchema>;

export const dealTaskSchema = z.object({
  deal_id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  due_date: optionalDateInput,
});
export type DealTaskInput = z.infer<typeof dealTaskSchema>;

export const contractSchema = z.object({
  contact_id: z.string().uuid("Choose a client"),
  title: z.string().trim().min(1, "Title is required").max(200),
  monthly_value: numeric(z.number().min(0, "Value can't be negative").max(100_000_000)),
  status: z.enum(["active", "paused", "completed", "cancelled"]),
  start_date: dateInput,
  end_date: optionalDateInput,
  notes: optionalTextInput,
});
export type ContractInput = z.infer<typeof contractSchema>;

export const onboardingTaskSchema = z.object({
  contact_id: z.string().uuid(),
  label: z.string().trim().min(1, "Label is required").max(200),
});
export type OnboardingTaskInput = z.infer<typeof onboardingTaskSchema>;

export const pipelineStageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});
export type PipelineStageInput = z.infer<typeof pipelineStageSchema>;

/** Contact/deal detail pages' inline notes editor — notes is also the text field wikilinks are parsed from (see lib/obsidian/wikilinks.ts's DOMAINS), so editing it here re-syncs outgoing [[links]] too. */
export const updateContactNotesSchema = z.object({
  id: z.string().uuid(),
  notes: optionalTextInput,
});
export type UpdateContactNotesInput = z.infer<typeof updateContactNotesSchema>;

export const updateDealNotesSchema = z.object({
  id: z.string().uuid(),
  notes: optionalTextInput,
});
export type UpdateDealNotesInput = z.infer<typeof updateDealNotesSchema>;
