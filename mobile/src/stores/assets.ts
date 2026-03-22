import { create } from "zustand";
import { apiRequest } from "../api/client";

type Asset = {
  id: string;
  name: string;
  asset_type: string;
  estimated_value: string;
  address: string | null;
  notes: string | null;
};

type AssetListResponse = {
  assets: Asset[];
};

type CreateAssetInput = {
  name: string;
  asset_type: string;
  estimated_value: string;
  address?: string | null;
  notes?: string | null;
};

type UpdateAssetInput = {
  name?: string;
  asset_type?: string;
  estimated_value?: string;
  address?: string | null;
  notes?: string | null;
};

type AssetsState = {
  assets: Asset[];
  isLoading: boolean;
  error: string | null;

  load: () => Promise<void>;
  create: (input: CreateAssetInput) => Promise<void>;
  update: (id: string, input: UpdateAssetInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useAssetsStore = create<AssetsState>((set, get) => ({
  assets: [],
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest<AssetListResponse>("/v1/assets");
      set({ assets: data.assets });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load assets" });
    } finally {
      set({ isLoading: false });
    }
  },

  create: async (input) => {
    const created = await apiRequest<Asset>("/v1/assets", {
      method: "POST",
      body: input,
    });
    set((state) => ({ assets: [created, ...state.assets] }));
  },

  update: async (id, input) => {
    const updated = await apiRequest<Asset>(`/v1/assets/${id}`, {
      method: "PUT",
      body: input,
    });
    set((state) => ({
      assets: state.assets.map((a) => (a.id === id ? updated : a)),
    }));
  },

  remove: async (id) => {
    await apiRequest(`/v1/assets/${id}`, { method: "DELETE" });
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== id),
    }));
  },
}));
