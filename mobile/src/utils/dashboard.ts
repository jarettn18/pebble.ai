import type { Account } from "../stores/accounts";

type Transaction = {
  amount: string;
  date: string;
  pending: boolean;
};

const DEBT_TYPES = new Set(["credit", "loan"]);

export function computeNetWorth(accounts: Account[]): number | null {
  if (accounts.length === 0) return null;

  let total = 0;
  for (const a of accounts) {
    if (a.balance_current == null) continue;
    const bal = parseFloat(a.balance_current);
    if (!Number.isFinite(bal)) continue;
    total += DEBT_TYPES.has(a.type) ? -bal : bal;
  }
  return total;
}

export function computeMonthlySpending(transactions: Transaction[]): number {
  const prefix = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  let total = 0;
  for (const t of transactions) {
    if (t.pending) continue;
    if (!t.date.startsWith(prefix)) continue;
    const amt = parseFloat(t.amount);
    if (Number.isFinite(amt) && amt > 0) {
      total += amt;
    }
  }
  return total;
}

export function formatCurrency(value: number): string {
  return "$" + Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
