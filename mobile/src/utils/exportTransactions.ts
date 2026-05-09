import { Platform } from "react-native";
import { API_URL, getTokens, refreshAccessToken } from "../api/client";

function filename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `pebble-transactions-${today}.csv`;
}

async function fetchCsv(): Promise<Blob> {
  const { access } = await getTokens();
  const path = "/v1/transactions/export.csv";

  const makeRequest = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  let res = await makeRequest(access);
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await makeRequest(refreshed);
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Export failed (HTTP ${res.status})`);
  }

  return res.blob();
}

async function saveOnWeb(blob: Blob, name: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function saveOnNative(blob: Blob, name: string): Promise<void> {
  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");

  const text = await blob.text();
  const file = new File(Paths.cache, name);
  try {
    file.create();
  } catch {
    // File may already exist from a previous export — overwrite via write().
  }
  file.write(text);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/csv",
      dialogTitle: "Export transactions",
      UTI: "public.comma-separated-values-text",
    });
  } else {
    throw new Error(`Saved to ${file.uri}, but sharing is not available on this device.`);
  }
}

export async function exportTransactions(): Promise<void> {
  const blob = await fetchCsv();
  const name = filename();
  if (Platform.OS === "web") {
    await saveOnWeb(blob, name);
  } else {
    await saveOnNative(blob, name);
  }
}
