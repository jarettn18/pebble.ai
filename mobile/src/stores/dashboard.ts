import { create } from "zustand";
import { apiRequest } from "../api/client";

export type AccountSummary = {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  balance_current: string | null;
  institution_name: string | null;
};

export type BudgetSummary = {
  category_name: string | null;
  amount: string;
  spent: string;
};

export type SpendingByCategory = {
  category_name: string;
  amount: string;
};

export type MonthlySpendingPoint = {
  month: number;
  year: number;
  label: string;
  amount: string;
};

type DashboardResponse = {
  net_worth: string | null;
  monthly_spending: string;
  accounts: AccountSummary[];
  budget_summaries: BudgetSummary[];
  spending_by_category: SpendingByCategory[];
  spending_over_time: MonthlySpendingPoint[];
};

type DashboardState = {
  netWorth: number | null;
  monthlySpending: number;
  accounts: AccountSummary[];
  budgetSummaries: BudgetSummary[];
  spendingByCategory: SpendingByCategory[];
  spendingOverTime: MonthlySpendingPoint[];
  isLoading: boolean;
  error: string | null;

  load: (month?: number, year?: number) => Promise<void>;
  refresh: () => Promise<void>;
};

let lastMonth = 0;
let lastYear = 0;

export const useDashboardStore = create<DashboardState>((set, get) => ({
  netWorth: null,
  monthlySpending: 0,
  accounts: [],
  budgetSummaries: [],
  spendingByCategory: [],
  spendingOverTime: [],
  isLoading: false,
  error: null,

  load: async (month?, year?) => {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    lastMonth = m;
    lastYear = y;

    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest<DashboardResponse>(
        `/v1/dashboard?month=${m}&year=${y}`
      );
      set({
        netWorth: data.net_worth !== null ? parseFloat(data.net_worth) : null,
        monthlySpending: parseFloat(data.monthly_spending),
        accounts: data.accounts,
        budgetSummaries: data.budget_summaries,
        spendingByCategory: data.spending_by_category,
        spendingOverTime: data.spending_over_time,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load dashboard" });
    } finally {
      set({ isLoading: false });
    }
  },

  refresh: async () => {
    if (lastMonth && lastYear) {
      await get().load(lastMonth, lastYear);
    } else {
      await get().load();
    }
  },
}));
