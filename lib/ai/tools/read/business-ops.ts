import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getContacts,
  getContact,
  getDeals,
  getDealsForContact,
  getPipelineStages,
  getContracts,
  getActivitiesForContact,
  computeStaleDeals,
  computeMrr,
  computePipelineSummary,
} from "@/lib/db/queries/business";
import { ok, type ToolDefinition } from "@/lib/ai/tools/types";

/**
 * Business operator tools.
 *
 * The interesting thing about this phase is how little new logic it needed:
 * computeStaleDeals (the follow-up watchdog), computePipelineSummary,
 * computeMrr and computeDealAging already existed and are already used by
 * the Business pages. These tools call exactly those, so a follow-up JARVIS
 * names is the same deal the dashboard flags — reimplementing "gone quiet"
 * in the AI layer would have created a second definition free to disagree.
 *
 * There is deliberately no `probability` anywhere here. The deals table has
 * no such column, and inventing one client-side would mean the model
 * quoting a number with nothing behind it.
 */

function contactLabel(c: { company_name: string | null; contact_person: string }): string {
  return c.company_name || c.contact_person;
}

export const getLeadsTool: ToolDefinition = {
  name: "get_leads",
  description:
    "The user's business contacts and leads, each with how many open deals it has and their total value. Use before creating a lead to avoid duplicates.",
  domain: "business",
  risk: "safe",
  schema: z.object({
    query: z.string().optional().describe("Filter by company name, contact person or email."),
  }),
  async handler(args, { supabase }) {
    const { query } = args as { query?: string };
    const [contacts, deals, stages] = await Promise.all([
      getContacts(supabase),
      getDeals(supabase),
      getPipelineStages(supabase),
    ]);

    const openStageIds = new Set(stages.filter((s) => !s.is_won && !s.is_lost).map((s) => s.id));
    const q = query?.trim().toLowerCase();

    const rows = contacts
      .filter((c) =>
        !q
          ? true
          : [c.company_name, c.contact_person, c.email].some((f) => f?.toLowerCase().includes(q)),
      )
      .map((c) => {
        const theirs = deals.filter((d) => d.contact_id === c.id);
        const open = theirs.filter((d) => openStageIds.has(d.stage_id));
        return {
          id: c.id,
          contact_person: c.contact_person,
          company_name: c.company_name,
          email: c.email,
          phone: c.phone,
          source: c.source,
          open_deals: open.length,
          open_value: open.reduce((sum, d) => sum + Number(d.value), 0),
        };
      });

    return ok(rows);
  },
};

export const getLeadTool: ToolDefinition = {
  name: "get_lead",
  description:
    "Everything about one contact — details, their deals with stages, and recent activity. Get the id from get_leads.",
  domain: "business",
  risk: "safe",
  schema: z.object({ contact_id: z.string().min(1) }),
  async handler(args, { supabase }) {
    const { contact_id } = args as { contact_id: string };
    const contact = await getContact(supabase, contact_id);
    if (!contact) return { status: "error", message: `No contact with id ${contact_id} exists.` };

    const [deals, stages, activities] = await Promise.all([
      getDealsForContact(supabase, contact_id),
      getPipelineStages(supabase),
      getActivitiesForContact(supabase, contact_id),
    ]);
    const stageName = new Map(stages.map((s) => [s.id, s.name]));

    return ok({
      contact: {
        id: contact.id,
        contact_person: contact.contact_person,
        company_name: contact.company_name,
        email: contact.email,
        phone: contact.phone,
        notes: contact.notes,
      },
      deals: deals.map((d) => ({
        id: d.id,
        title: d.title,
        value: Number(d.value),
        stage: stageName.get(d.stage_id) ?? "unknown",
        expected_close_date: d.expected_close_date,
        stage_changed_at: d.stage_changed_at,
      })),
      recent_activity: activities.slice(0, 10).map((a) => ({
        type: a.type,
        notes: a.notes,
        created_at: a.created_at,
      })),
    });
  },
};

export const getFollowUpsTool: ToolDefinition = {
  name: "get_follow_ups",
  description:
    "Open deals that have sat in the same stage too long and need chasing, newest-stale first. Use for 'who do I need to follow up with'.",
  domain: "business",
  risk: "safe",
  schema: z.object({
    stale_after_days: z
      .number()
      .optional()
      .describe("How many days without a stage change counts as stale. Defaults to 5."),
  }),
  async handler(args, { supabase }) {
    const { stale_after_days } = args as { stale_after_days?: number };
    const [deals, stages, contacts] = await Promise.all([
      getDeals(supabase),
      getPipelineStages(supabase),
      getContacts(supabase),
    ]);

    // The same watchdog the Business dashboard uses. Won and lost deals are
    // already excluded there — a closed deal has not "gone quiet", it is done.
    const stale = computeStaleDeals(
      deals,
      stages,
      contacts,
      stale_after_days === undefined ? undefined : Math.min(Math.max(stale_after_days, 1), 365),
    );

    const dealById = new Map(deals.map((d) => [d.id, d]));
    return ok(
      stale
        .sort((a, b) => b.daysSinceStageChange - a.daysSinceStageChange)
        .map((s) => ({
          deal_id: s.dealId,
          label: s.label,
          days_since_stage_change: s.daysSinceStageChange,
          // Carried through so the model can turn a follow-up straight into
          // a task without a second lookup.
          contact_id: dealById.get(s.dealId)?.contact_id,
          value: Number(dealById.get(s.dealId)?.value ?? 0),
        })),
    );
  },
};

export const getRevenueSummaryTool: ToolDefinition = {
  name: "get_revenue_summary",
  description:
    "Won revenue, open pipeline value, win rate and recurring monthly revenue — all derived from actual deals and contracts.",
  domain: "business",
  risk: "safe",
  schema: z.object({}),
  async handler(_args, { supabase }) {
    const [deals, stages, contracts] = await Promise.all([
      getDeals(supabase),
      getPipelineStages(supabase),
      getContracts(supabase),
    ]);
    const summary = computePipelineSummary(deals, stages);
    return ok({
      won_value: summary.wonValue,
      won_count: summary.wonCount,
      open_value: summary.openValue,
      open_count: summary.openCount,
      win_rate_percent: summary.winRate,
      closed_count: summary.closedCount,
      mrr: computeMrr(contracts),
    });
  },
};

export const createLeadTool: ToolDefinition = {
  name: "create_lead",
  description:
    "Add a business contact. Check get_leads first — creating a duplicate of someone already tracked is worse than asking.",
  domain: "business",
  risk: "low",
  schema: z.object({
    contact_person: z.string().min(1).max(200),
    company_name: z.string().max(200).optional(),
    email: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    notes: z.string().max(2000).optional(),
  }),
  async handler(args, { supabase }) {
    const a = args as {
      contact_person: string;
      company_name?: string;
      email?: string;
      phone?: string;
      notes?: string;
    };
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        contact_person: a.contact_person,
        company_name: a.company_name ?? null,
        email: a.email ?? null,
        phone: a.phone ?? null,
        notes: a.notes ?? null,
        source: "manual",
      })
      .select("id")
      .single();
    if (error) return { status: "error", message: `Could not create the lead: ${error.message}` };
    revalidatePath("/business/leads");
    revalidatePath("/business/clients");
    return ok({ created: true, id: data.id, summary: `Added ${a.company_name || a.contact_person}` });
  },
};

export const updateLeadTool: ToolDefinition = {
  name: "update_lead",
  description: "Update a contact's details or notes. Get the id from get_leads.",
  domain: "business",
  risk: "low",
  schema: z.object({
    contact_id: z.string().min(1),
    contact_person: z.string().min(1).max(200).optional(),
    company_name: z.string().max(200).optional(),
    email: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    notes: z.string().max(2000).optional(),
  }),
  async handler(args, { supabase }) {
    const a = args as Record<string, string | undefined> & { contact_id: string };
    // Explicit field list rather than a spread, so only what the model sent
    // is written and the object stays assignable to the generated types.
    const patch: {
      contact_person?: string;
      company_name?: string;
      email?: string;
      phone?: string;
      notes?: string;
    } = {};
    if (a.contact_person !== undefined) patch.contact_person = a.contact_person;
    if (a.company_name !== undefined) patch.company_name = a.company_name;
    if (a.email !== undefined) patch.email = a.email;
    if (a.phone !== undefined) patch.phone = a.phone;
    if (a.notes !== undefined) patch.notes = a.notes;

    if (Object.keys(patch).length === 0) {
      return { status: "invalid_arguments", issues: ["Provide at least one field to change."] };
    }

    const { data, error } = await supabase
      .from("contacts")
      .update(patch)
      .eq("id", a.contact_id)
      .select("id, contact_person, company_name")
      .maybeSingle();
    if (error) return { status: "error", message: `Could not update the lead: ${error.message}` };
    if (!data) return { status: "error", message: `No contact with id ${a.contact_id} exists.` };
    revalidatePath("/business/clients");
    return ok({ updated: true, id: data.id, summary: `Updated ${contactLabel(data)}` });
  },
};

export const createFollowUpTool: ToolDefinition = {
  name: "create_follow_up",
  description:
    "Attach a follow-up task to a deal. Use after get_follow_ups to turn a stale deal into something actionable. For personal to-dos unrelated to a deal, use create_task instead.",
  domain: "business",
  risk: "low",
  schema: z.object({
    deal_id: z.string().min(1).describe("Deal id, from get_follow_ups or get_lead."),
    title: z.string().min(1).max(200),
    due_date: z.string().optional().describe("yyyy-mm-dd. Omit if the user gave no date."),
  }),
  async handler(args, { supabase }) {
    const a = args as { deal_id: string; title: string; due_date?: string };
    const { data, error } = await supabase
      .from("deal_tasks")
      .insert({ deal_id: a.deal_id, title: a.title, due_date: a.due_date ?? null })
      .select("id")
      .single();
    if (error) return { status: "error", message: `Could not create the follow-up: ${error.message}` };
    revalidatePath("/business/pipeline");
    return ok({ created: true, id: data.id, summary: `Follow-up added: "${a.title}"` });
  },
};

export const businessOpsTools = [
  getLeadsTool,
  getLeadTool,
  getFollowUpsTool,
  getRevenueSummaryTool,
  createLeadTool,
  updateLeadTool,
  createFollowUpTool,
];
