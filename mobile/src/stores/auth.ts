import { create } from "zustand";
import { apiRequest, saveTokens, clearTokens } from "../api/client";

type User = {
  id: string;
  email: string;
  full_name: string;
  subscription_tier: string;
  date_of_birth: string | null;
  occupation: string | null;
  annual_income: number | null;
  state: string | null;
  marital_status: string | null;
  dependents: number | null;
  financial_goals: string[] | null;
};

type ProfileUpdate = Partial<
  Pick<
    User,
    | "full_name"
    | "date_of_birth"
    | "occupation"
    | "annual_income"
    | "state"
    | "marital_status"
    | "dependents"
    | "financial_goals"
  >
>;

type TokenResponse = {
  access_token: string;
  refresh_token: string;
};

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  register: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  register: async (email, password, fullName) => {
    const tokens = await apiRequest<TokenResponse>("/v1/auth/register", {
      method: "POST",
      body: { email, password, full_name: fullName },
      noAuth: true,
    });
    await saveTokens(tokens.access_token, tokens.refresh_token);
    const user = await apiRequest<User>("/v1/auth/me");
    set({ user, isAuthenticated: true });
  },

  login: async (email, password) => {
    const tokens = await apiRequest<TokenResponse>("/v1/auth/login", {
      method: "POST",
      body: { email, password },
      noAuth: true,
    });
    await saveTokens(tokens.access_token, tokens.refresh_token);
    const user = await apiRequest<User>("/v1/auth/me");
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const user = await apiRequest<User>("/v1/auth/me");
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const user = await apiRequest<User>("/v1/auth/profile", {
      method: "PATCH",
      body: data,
    });
    set({ user });
  },
}));
