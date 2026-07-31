import { z } from "zod";
import { numeric, optionalNumeric, optionalTextInput, dateInput } from "@/lib/validation";

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  account_type: z.enum(["cash", "savings", "credit", "investment"]),
  current_balance: numeric(z.number().min(-1_000_000_000).max(1_000_000_000)),
});
export type AccountInput = z.infer<typeof accountSchema>;

export const transactionSchema = z.object({
  account_id: z.string().uuid("Choose an account"),
  type: z.enum(["income", "expense"]),
  amount: numeric(z.number().positive("Amount must be greater than 0")),
  category: z.string().trim().min(1, "Category is required").max(60),
  description: optionalTextInput,
  occurred_at: dateInput,
});
export type TransactionInput = z.infer<typeof transactionSchema>;

export const budgetSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(60),
  monthly_limit: numeric(z.number().positive("Limit must be greater than 0")),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export const tradeSchema = z.object({
  asset_pair: z.string().trim().min(1, "Asset/pair is required").max(60),
  direction: z.enum(["long", "short"]),
  entry_price: numeric(z.number().positive("Entry price must be greater than 0")),
  exit_price: optionalNumeric(z.number().positive("Exit price must be greater than 0")),
  quantity: optionalNumeric(z.number().positive("Quantity must be greater than 0")),
  fees: optionalNumeric(z.number().min(0, "Fees can't be negative")),
  setup_category: optionalTextInput,
  notes: optionalTextInput,
  // datetime-local input ("YYYY-MM-DDTHH:mm"), not a plain date — dateInput's regex doesn't apply here.
  opened_at: z.string().min(1, "Pick an opened-at time"),
  confluence_checked: z.coerce.boolean().optional(),
});
export type TradeInput = z.infer<typeof tradeSchema>;

export const closeTradeSchema = z.object({
  exit_price: numeric(z.number().positive("Exit price must be greater than 0")),
  quantity: numeric(z.number().positive("Quantity must be greater than 0")),
  fees: optionalNumeric(z.number().min(0, "Fees can't be negative")),
});
export type CloseTradeInput = z.infer<typeof closeTradeSchema>;
