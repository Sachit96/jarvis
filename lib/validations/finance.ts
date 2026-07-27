import { z } from "zod";

export const SUGGESTED_CATEGORIES = ["Business", "Personal", "Software", "Trading", "Living"];

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  account_type: z.enum(["cash", "savings", "credit", "investment"]),
  current_balance: z.coerce.number().min(-1_000_000_000).max(1_000_000_000),
});
export type AccountInput = z.infer<typeof accountSchema>;

export const transactionSchema = z.object({
  account_id: z.string().uuid("Choose an account"),
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  category: z.string().trim().min(1, "Category is required").max(60),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  occurred_at: z.string().min(1),
});
export type TransactionInput = z.infer<typeof transactionSchema>;

export const budgetSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(60),
  monthly_limit: z.coerce.number().positive("Limit must be greater than 0"),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export const tradeSchema = z.object({
  asset_pair: z.string().trim().min(1, "Asset/pair is required").max(60),
  direction: z.enum(["long", "short"]),
  entry_price: z.coerce.number().positive("Entry price must be greater than 0"),
  exit_price: z.coerce.number().positive().optional(),
  quantity: z.coerce.number().positive().optional(),
  fees: z.coerce.number().min(0).optional(),
  setup_category: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  opened_at: z.string().min(1),
});
export type TradeInput = z.infer<typeof tradeSchema>;

export const closeTradeSchema = z.object({
  exit_price: z.coerce.number().positive("Exit price must be greater than 0"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  fees: z.coerce.number().min(0).optional(),
});
export type CloseTradeInput = z.infer<typeof closeTradeSchema>;
