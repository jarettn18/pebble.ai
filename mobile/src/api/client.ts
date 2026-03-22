import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const API_URL = __DEV__
  ? "http://localhost:8000"
  : "https://api.pebble.app"; // TODO: production URL

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  noAuth?: boolean;
};

async function getTokens() {
  if (Platform.OS === "web") {
    return {
      access: sessionStorage.getItem("access_token"),
      refresh: sessionStorage.getItem("refresh_token"),
    };
  }
  const access = await SecureStore.getItemAsync("access_token");
  const refresh = await SecureStore.getItemAsync("refresh_token");
  return { access, refresh };
}

async function saveTokens(access: string, refresh: string) {
  if (Platform.OS === "web") {
    sessionStorage.setItem("access_token", access);
    sessionStorage.setItem("refresh_token", refresh);
    return;
  }
  await SecureStore.setItemAsync("access_token", access);
  await SecureStore.setItemAsync("refresh_token", refresh);
}

async function clearTokens() {
  if (Platform.OS === "web") {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    return;
  }
  await SecureStore.deleteItemAsync("access_token");
  await SecureStore.deleteItemAsync("refresh_token");
}

async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = await getTokens();
  if (!refresh) return null;

  try {
    const res = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) {
      await clearTokens();
      return null;
    }

    const data = await res.json();
    await saveTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    await clearTokens();
    return null;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, noAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (!noAuth) {
    const { access } = await getTokens();
    if (access) {
      requestHeaders["Authorization"] = `Bearer ${access}`;
    }
  }

  let res = await fetch(`${API_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // If 401, try refreshing the token once
  if (res.status === 401 && !noAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    const detail = error.detail;
    const message =
      Array.isArray(detail)
        ? detail.map((e: { msg?: string }) => e.msg).join(", ")
        : detail || `HTTP ${res.status}`;
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export { saveTokens, clearTokens, getTokens };
