import { create } from "zustand";
import { apiRequest } from "../api/client";

export type Allocation = {
  id: string;
  category_id: string;
  category_name: string | null;
  category_color: string | null;
  amount: string;
};

export type BudgetPlan = {
  id: string;
  name: string | null;
  total_amount: string;
  is_recurring: boolean;
  recurring_start_month: number | null;
  recurring_start_year: number | null;
  recurring_active: boolean;
  allocations: Allocation[];
  created_at: string;
};

type BudgetPlanListResponse = {
  budget_plans: BudgetPlan[];
};

type BudgetPlansState = {
  plans: BudgetPlan[];
  isLoading: boolean;
  error: string | null;

  load: (month: number, year: number) => Promise<void>;
  refresh: () => Promise<void>;
  removePlan: (id: string) => void;
};

let lastMonth = 0;
let lastYear = 0;

export const useBudgetPlansStore = create<BudgetPlansState>((set, get) => ({
  plans: [],
  isLoading: false,
  error: null,

  load: async (month, year) => {
    lastMonth = month;
    lastYear = year;
    const silent = get().plans.length > 0;
    if (!silent) set({ isLoading: true, error: null });
    try {
      const data = await apiRequest<BudgetPlanListResponse>(
        `/v1/budget-plans?month=${month}&year=${year}`
      );
      set({ plans: data.budget_plans });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to load budget plans",
      });
    } finally {
      if (!silent) set({ isLoading: false });
    }
  },

  refresh: async () => {
    if (lastMonth && lastYear) {
      await get().load(lastMonth, lastYear);
    }
  },

  removePlan: (id) => {
    set((state) => ({
      plans: state.plans.filter((p) => p.id !== id),
    }));
  },
}));
