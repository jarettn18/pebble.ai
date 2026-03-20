import { create } from "zustand";
import { apiRequest } from "../api/client";

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day

type Transaction = {
  id: string;
  account_id: string;
  amount: string;
  date: string;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  category_name: string | null;
};

type TransactionsResponse = {
  transactions: Transaction[];
  count: number;
};

type TransactionsState = {
  transactions: Transaction[];
  lastFetchedAt: number | null;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  /** Load transactions — syncs with Plaid first if cache is empty or stale. */
  load: () => Promise<void>;
  /** Force sync with Plaid then refresh the list. */
  syncAndRefresh: () => Promise<void>;
  /** Update a transaction's category_name in the local list (optimistic). */
  updateTransactionCategory: (id: string, categoryName: string | null) => void;
};

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  lastFetchedAt: null,
  isLoading: false,
  isSyncing: false,
  error: null,

  load: async () => {
    const { lastFetchedAt, transactions, isSyncing, isLoading } = get();
    if (isLoading || isSyncing) return;

    const isStale =
      !lastFetchedAt || Date.now() - lastFetchedAt > CACHE_MAX_AGE_MS;
    const isEmpty = transactions.length === 0;

    if (isStale || isEmpty) {
      // Need fresh data from Plaid
      await get().syncAndRefresh();
    }
    // Otherwise cache is fresh — do nothing
  },

  syncAndRefresh: async () => {
    set({ isSyncing: true, error: null });
    try {
      try {
        await apiRequest("/v1/plaid/sync-all", { method: "POST" });
      } catch {
        // sync may fail if no items linked — still fetch local data
      }

      const data = await apiRequest<TransactionsResponse>(
        "/v1/transactions?limit=200"
      );
      set({
        transactions: data.transactions,
        lastFetchedAt: Date.now(),
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load",
      });
    } finally {
      set({ isSyncing: false });
    }
  },

  updateTransactionCategory: (id, categoryName) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, category_name: categoryName } : t
      ),
    }));
  },
}));
