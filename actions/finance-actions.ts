"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  accountSchema,
  transactionSchema,
  budgetSchema,
  tradeSchema,
  closeTradeSchema,
} from "@/lib/validations/finance";

export interface ActionState {
  error?: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function computePnl(
  direction: "long" | "short",
  entry: number,
  exit: number,
  quantity: number,
  fees: number,
) {
  const raw = direction === "long" ? (exit - entry) * quantity : (entry - exit) * quantity;
  return Math.round((raw - fees) * 100) / 100;
}

function revalidateFinance() {
  revalidatePath("/finance/overview");
  revalidatePath("/finance/accounts");
  revalidatePath("/finance/transactions");
  revalidatePath("/finance/budgets");
}

// ============================================================= Accounts

export async function createAccountAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    account_type: formData.get("account_type") || "cash",
    current_balance: formData.get("current_balance") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Users enter credit balances as a positive "amount owed"; store it negative so
  // it nets against asset balances directly (see computeAssetLiabilityTotals).
  const current_balance =
    parsed.data.account_type === "credit"
      ? -Math.abs(parsed.data.current_balance)
      : parsed.data.current_balance;

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: parsed.data.name,
    account_type: parsed.data.account_type,
    current_balance,
  });
  if (error) return { error: error.message };
  revalidateFinance();
  return {};
}

export async function deleteAccountAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateFinance();
}

/** `newBalance` is in the account's own display convention (owed-as-positive for credit). */
export async function adjustAccountBalanceAction(
  id: string,
  newBalance: number,
  isLiability: boolean,
) {
  const supabase = await createClient();
  const stored = isLiability ? -Math.abs(newBalance) : newBalance;
  const { error } = await supabase
    .from("accounts")
    .update({ current_balance: stored })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateFinance();
}

// ============================================================= Transactions

export async function createTransactionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = transactionSchema.safeParse({
    account_id: formData.get("account_id"),
    type: formData.get("type") || "expense",
    amount: formData.get("amount"),
    category: formData.get("category"),
    description: formData.get("description"),
    occurred_at: formData.get("occurred_at") || todayStr(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // RLS-scoped select resolves to null for another user's account, blocking cross-user writes
  // that the balance-sync trigger would otherwise apply to an account this user doesn't own.
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", parsed.data.account_id)
    .maybeSingle();
  if (!account) return { error: "Account not found" };

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: parsed.data.account_id,
    type: parsed.data.type,
    amount: parsed.data.amount,
    category: parsed.data.category,
    description: parsed.data.description || null,
    occurred_at: parsed.data.occurred_at,
  });
  if (error) return { error: error.message };
  revalidateFinance();
  return {};
}

export async function deleteTransactionAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateFinance();
}

// ============================================================= Budgets

export async function createBudgetAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = budgetSchema.safeParse({
    category: formData.get("category"),
    monthly_limit: formData.get("monthly_limit"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("budgets").upsert(
    {
      user_id: user.id,
      category: parsed.data.category,
      monthly_limit: parsed.data.monthly_limit,
    },
    { onConflict: "user_id,category" },
  );
  if (error) return { error: error.message };
  revalidatePath("/finance/budgets");
  return {};
}

export async function deleteBudgetAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/finance/budgets");
}

// ============================================================= Trades

export async function createTradeAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = tradeSchema.safeParse({
    asset_pair: formData.get("asset_pair"),
    direction: formData.get("direction") || "long",
    entry_price: formData.get("entry_price"),
    exit_price: formData.get("exit_price") || undefined,
    quantity: formData.get("quantity") || undefined,
    fees: formData.get("fees") || 0,
    setup_category: formData.get("setup_category"),
    notes: formData.get("notes"),
    opened_at: formData.get("opened_at") || new Date().toISOString(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const isClosed = parsed.data.exit_price !== undefined && parsed.data.quantity !== undefined;
  const pnl = isClosed
    ? computePnl(
        parsed.data.direction,
        parsed.data.entry_price,
        parsed.data.exit_price!,
        parsed.data.quantity!,
        parsed.data.fees ?? 0,
      )
    : null;

  const { error } = await supabase.from("trades").insert({
    user_id: user.id,
    asset_pair: parsed.data.asset_pair,
    direction: parsed.data.direction,
    entry_price: parsed.data.entry_price,
    exit_price: parsed.data.exit_price ?? null,
    quantity: parsed.data.quantity ?? null,
    fees: parsed.data.fees ?? 0,
    pnl,
    setup_category: parsed.data.setup_category || null,
    notes: parsed.data.notes || null,
    opened_at: parsed.data.opened_at,
    closed_at: isClosed ? new Date().toISOString() : null,
    status: isClosed ? "closed" : "open",
  });
  if (error) return { error: error.message };
  revalidatePath("/finance/trades");
  return {};
}

export async function closeTradeAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = closeTradeSchema.safeParse({
    exit_price: formData.get("exit_price"),
    quantity: formData.get("quantity"),
    fees: formData.get("fees") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const id = String(formData.get("id"));
  const direction = String(formData.get("direction")) as "long" | "short";
  const entryPrice = Number(formData.get("entry_price"));
  const pnl = computePnl(direction, entryPrice, parsed.data.exit_price, parsed.data.quantity, parsed.data.fees ?? 0);

  const supabase = await createClient();
  const { error } = await supabase
    .from("trades")
    .update({
      exit_price: parsed.data.exit_price,
      quantity: parsed.data.quantity,
      fees: parsed.data.fees ?? 0,
      pnl,
      status: "closed",
      closed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/finance/trades");
  return {};
}

export async function deleteTradeAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("trades").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/finance/trades");
}
