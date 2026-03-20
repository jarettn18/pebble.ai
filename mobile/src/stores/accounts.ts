import { create } from "zustand";
import { apiRequest } from "../api/client";

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day

export type Account = {
  id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  balance_current: string | null;
  balance_available: string | null;
  iso_currency_code: string | null;
  institution_name: string | null;
};

type AccountsResponse = {
  accounts: Account[];
};

type AccountsState = {
  accounts: Account[];
  lastFetchedAt: number | null;
  isLoading: boolean;
  error: string | null;

  /** Load accounts — fetches if cache is empty or stale. */
  load: () => Promise<void>;
  /** Force refresh from the API. */
  refresh: () => Promise<void>;
};

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  lastFetchedAt: null,
  isLoading: false,
  error: null,

  load: async () => {
    const { lastFetchedAt, accounts, isLoading } = get();
    if (isLoading) return;

    const isStale =
      !lastFetchedAt || Date.now() - lastFetchedAt > CACHE_MAX_AGE_MS;
    const isEmpty = accounts.length === 0;

    if (isStale || isEmpty) {
      await get().refresh();
    }
  },

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest<AccountsResponse>("/v1/accounts");
      set({
        accounts: data.accounts,
        lastFetchedAt: Date.now(),
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load accounts",
      });
    } finally {
      set({ isLoading: false });
    }
  },
}));
