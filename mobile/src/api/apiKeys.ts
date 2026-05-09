import { apiRequest } from "./client";

export type ApiKey = {
  id: string;
  name: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type CreateApiKeyResponse = {
  api_key: ApiKey;
  raw_key: string;
};

export const SCOPE_OPTIONS = [
  { id: "read:transactions", label: "Read transactions" },
  { id: "read:accounts", label: "Read account balances" },
  { id: "read:budgets", label: "Read budgets" },
  { id: "write:budgets", label: "Create / edit / delete budgets" },
  { id: "read:insights", label: "Financial health and tips" },
] as const;

export async function listApiKeys(): Promise<ApiKey[]> {
  return apiRequest<ApiKey[]>("/v1/api-keys");
}

export async function createApiKey(
  name: string,
  scopes: string[]
): Promise<CreateApiKeyResponse> {
  return apiRequest<CreateApiKeyResponse>("/v1/api-keys", {
    method: "POST",
    body: { name, scopes },
  });
}

export async function revokeApiKey(id: string): Promise<void> {
  await apiRequest<void>(`/v1/api-keys/${id}`, { method: "DELETE" });
}
