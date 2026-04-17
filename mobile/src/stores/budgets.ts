import { create } from "zustand";
import { apiRequest } from "../api/client";
import { useTransactionsStore } from "./transactions";

export type Budget = {
  id: string;
  category_id: string;
  category_name: string | null;
  category_color: string | null;
  amount: string;
  spent: string;
  month: number;
  year: number;
};

type BudgetListResponse = {
  budgets: Budget[];
};

type BudgetsState = {
  budgets: Budget[];
  isLoading: boolean;
  error: string | null;

  /** Load budgets for a given month/year. */
  load: (month: number, year: number) => Promise<void>;
  /** Force refresh for current month/year. */
  refresh: () => Promise<void>;
  /** Remove a budget from local state. */
  removeBudget: (id: string) => void;
  /** Update or add a budget in local state. */
  upsertBudget: (budget: Budget) => void;
};

let lastMonth = 0;
let lastYear = 0;

export const useBudgetsStore = create<BudgetsState>((set, get) => ({
  budgets: [],
  isLoading: false,
  error: null,

  load: async (month, year) => {
    lastMonth = month;
    lastYear = year;

    // Only show loading indicator when there are no budgets yet;
    // otherwise reload silently so the UI doesn't flash a spinner
    const silent = get().budgets.length > 0;
    if (!silent) set({ isLoading: true, error: null });
    try {
      // Kick off transaction sync in background so spending data is fresh,
      // but don't block budget loading on it
      useTransactionsStore.getState().load().catch((err) => {
        if (__DEV__) console.warn("Background transaction sync failed:", err);
      });

      const data = await apiRequest<BudgetListResponse>(
        `/v1/budgets?month=${month}&year=${year}`
      );
      set({ budgets: data.budgets });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load budgets" });
    } finally {
      if (!silent) set({ isLoading: false });
    }
  },

  refresh: async () => {
    if (lastMonth && lastYear) {
      await get().load(lastMonth, lastYear);
    }
  },

  removeBudget: (id) => {
    set((state) => ({
      budgets: state.budgets.filter((b) => b.id !== id),
    }));
  },

  upsertBudget: (budget) => {
    set((state) => {
      const idx = state.budgets.findIndex((b) => b.id === budget.id);
      if (idx >= 0) {
        const updated = [...state.budgets];
        updated[idx] = budget;
        return { budgets: updated };
      }
      return { budgets: [...state.budgets, budget] };
    });
  },
}));
