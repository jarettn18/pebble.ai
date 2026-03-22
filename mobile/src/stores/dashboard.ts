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
  category_id: string;
  category_name: string | null;
  amount: string;
  spent: string;
};

export type SpendingByCategory = {
  category_name: string;
  amount: string;
};

export type IncomeByCategory = {
  category_name: string;
  amount: string;
};

export type AssetSummary = {
  id: string;
  name: string;
  asset_type: string;
  estimated_value: string;
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
  monthly_income: string;
  accounts: AccountSummary[];
  assets: AssetSummary[];
  budget_summaries: BudgetSummary[];
  spending_by_category: SpendingByCategory[];
  income_by_category: IncomeByCategory[];
  spending_over_time: MonthlySpendingPoint[];
  income_over_time: MonthlySpendingPoint[];
};

type DashboardState = {
  netWorth: number | null;
  monthlySpending: number;
  monthlyIncome: number;
  accounts: AccountSummary[];
  assets: AssetSummary[];
  budgetSummaries: BudgetSummary[];
  spendingByCategory: SpendingByCategory[];
  incomeByCategory: IncomeByCategory[];
  spendingOverTime: MonthlySpendingPoint[];
  incomeOverTime: MonthlySpendingPoint[];
  isLoading: boolean;
  error: string | null;
  /** Increments on each successful load — used to trigger child re-fetches. */
  refreshCount: number;

  load: (month?: number, year?: number, silent?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
};

let lastMonth = 0;
let lastYear = 0;

export const useDashboardStore = create<DashboardState>((set, get) => ({
  netWorth: null,
  monthlySpending: 0,
  monthlyIncome: 0,
  accounts: [],
  assets: [],
  budgetSummaries: [],
  spendingByCategory: [],
  incomeByCategory: [],
  spendingOverTime: [],
  incomeOverTime: [],
  isLoading: false,
  error: null,
  refreshCount: 0,

  load: async (month?, year?, silent?) => {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    lastMonth = m;
    lastYear = y;

    if (!silent) set({ isLoading: true, error: null });
    try {
      const data = await apiRequest<DashboardResponse>(
        `/v1/dashboard?month=${m}&year=${y}`
      );
      set((state) => ({
        netWorth: data.net_worth !== null ? parseFloat(data.net_worth) : null,
        monthlySpending: parseFloat(data.monthly_spending),
        monthlyIncome: parseFloat(data.monthly_income),
        accounts: data.accounts,
        assets: data.assets ?? [],
        budgetSummaries: data.budget_summaries,
        spendingByCategory: data.spending_by_category,
        incomeByCategory: data.income_by_category,
        spendingOverTime: data.spending_over_time,
        incomeOverTime: data.income_over_time,
        refreshCount: state.refreshCount + 1,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load dashboard" });
    } finally {
      if (!silent) set({ isLoading: false });
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
