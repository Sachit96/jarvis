import { z } from "zod";

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
  company_name: z.string().trim().max(200).optional().or(z.literal("")),
  contact_person: z.string().trim().min(1, "Contact person is required").max(200),
  email: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  value: z.coerce.number().min(0).max(100_000_000).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type LeadInput = z.infer<typeof leadSchema>;

export const activitySchema = z.object({
  contact_id: z.string().uuid(),
  deal_id: z.string().uuid().optional().or(z.literal("")),
  type: z.enum(["call", "email", "meeting", "note", "other"]),
  notes: z.string().trim().min(1, "Notes are required").max(2000),
});
export type ActivityInput = z.infer<typeof activitySchema>;

export const dealTaskSchema = z.object({
  deal_id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  due_date: z.string().optional().or(z.literal("")),
});
export type DealTaskInput = z.infer<typeof dealTaskSchema>;

export const contractSchema = z.object({
  contact_id: z.string().uuid("Choose a client"),
  title: z.string().trim().min(1, "Title is required").max(200),
  monthly_value: z.coerce.number().min(0).max(100_000_000),
  status: z.enum(["active", "paused", "completed", "cancelled"]),
  start_date: z.string().min(1),
  end_date: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
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

export const ghlConnectionSchema = z.object({
  private_token: z.string().trim().min(10, "Token looks too short").max(500),
  location_id: z.string().trim().min(1, "Location ID is required").max(100),
});
export type GhlConnectionInput = z.infer<typeof ghlConnectionSchema>;
