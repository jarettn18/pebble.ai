import { create } from "zustand";
import { apiRequest } from "../api/client";
import { useHealthScoreStore } from "./healthScore";

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day

type Transaction = {
  id: string;
  account_id: string;
  account_name: string | null;
  amount: string;
  date: string;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  category_name: string | null;
  category_color: string | null;
};

type TransactionsResponse = {
  transactions: Transaction[];
  count: number;
};

type CreateTransactionInput = {
  account_id: string;
  amount: string;
  date: string;
  name: string;
  merchant_name?: string | null;
  category_id?: string | null;
  notes?: string | null;
};

export type TransactionFilters = {
  search?: string;
  category_ids?: string[];
  date_from?: string;
  date_to?: string;
  types?: ("expense" | "income")[];
  account_id?: string;
};

type TransactionsState = {
  transactions: Transaction[];
  totalCount: number;
  lastFetchedAt: number | null;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  filters: TransactionFilters;

  /** Load transactions — syncs with Plaid first if cache is empty or stale. */
  load: () => Promise<void>;
  /** Force sync with Plaid then refresh the list. */
  syncAndRefresh: () => Promise<void>;
  /** Fetch transactions with current filters (no Plaid sync). */
  fetchFiltered: () => Promise<void>;
  /** Set filters and fetch. */
  setFilters: (filters: TransactionFilters) => Promise<void>;
  /** Clear all filters and fetch. */
  clearFilters: () => Promise<void>;
  /** Update a transaction's category in the local list (optimistic). */
  updateTransactionCategory: (
    id: string,
    categoryName: string | null,
    categoryColor?: string | null,
  ) => void;
  /** Create a manual transaction. */
  addTransaction: (input: CreateTransactionInput) => Promise<void>;
  /** Delete a transaction. */
  removeTransaction: (id: string) => Promise<void>;
};

function buildQueryString(filters: TransactionFilters): string {
  const params = new URLSearchParams({ limit: "200" });
  if (filters.search) params.set("search", filters.search);
  if (filters.category_ids?.length)
    params.set("category_id", filters.category_ids.join(","));
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.types?.length === 1) params.set("type", filters.types[0]);
  if (filters.account_id) params.set("account_id", filters.account_id);
  return params.toString();
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  totalCount: 0,
  lastFetchedAt: null,
  isLoading: false,
  isSyncing: false,
  error: null,
  filters: {},

  load: async () => {
    const { lastFetchedAt, transactions, isSyncing, isLoading } = get();
    if (isLoading || isSyncing) return;

    const isStale =
      !lastFetchedAt || Date.now() - lastFetchedAt > CACHE_MAX_AGE_MS;
    const isEmpty = transactions.length === 0;

    if (isStale || isEmpty) {
      await get().syncAndRefresh();
    }
  },

  syncAndRefresh: async () => {
    set({ isSyncing: true, error: null });
    try {
      try {
        await apiRequest("/v1/plaid/sync-all", { method: "POST" });
      } catch {
        // sync may fail if no items linked — still fetch local data
      }

      const qs = buildQueryString(get().filters);
      const data = await apiRequest<TransactionsResponse>(
        `/v1/transactions?${qs}`
      );
      set({
        transactions: data.transactions,
        totalCount: data.count,
        lastFetchedAt: Date.now(),
      });
      // Transactions just changed (or may have) — refresh the health score so
      // the dashboard card doesn't show a stale value.
      useHealthScoreStore.getState().load();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load",
      });
    } finally {
      set({ isSyncing: false });
    }
  },

  fetchFiltered: async () => {
    set({ isLoading: true, error: null });
    try {
      const qs = buildQueryString(get().filters);
      const data = await apiRequest<TransactionsResponse>(
        `/v1/transactions?${qs}`
      );
      set({
        transactions: data.transactions,
        totalCount: data.count,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  setFilters: async (filters) => {
    set({ filters });
    await get().fetchFiltered();
  },

  clearFilters: async () => {
    set({ filters: {} });
    await get().fetchFiltered();
  },

  updateTransactionCategory: (id, categoryName, categoryColor) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id
          ? {
              ...t,
              category_name: categoryName,
              category_color:
                categoryColor !== undefined ? categoryColor : t.category_color,
            }
          : t
      ),
    }));
  },

  addTransaction: async (input) => {
    const created = await apiRequest<Transaction>("/v1/transactions", {
      method: "POST",
      body: input,
    });
    set((state) => ({
      transactions: [created, ...state.transactions],
    }));
    useHealthScoreStore.getState().load();
  },

  removeTransaction: async (id) => {
    await apiRequest(`/v1/transactions/${id}`, { method: "DELETE" });
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
    }));
    useHealthScoreStore.getState().load();
  },
}));
