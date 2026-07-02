import { useState, useCallback } from "react";

type PlaidLinkResult = {
  publicToken: string;
  metadata: unknown;
};

type UsePlaidLinkReturn = {
  isLoading: boolean;
  error: string | null;
  linkResult: PlaidLinkResult | null;
  openLink: () => Promise<void>;
  clearResult: () => void;
};

export function usePlaidLink(): UsePlaidLinkReturn {
  const [error, setError] = useState<string | null>(null);

  const clearResult = useCallback(() => setError(null), []);

  const openLink = useCallback(async () => {
    setError("Plaid Link is only available in the mobile app.");
  }, []);

  return {
    isLoading: false,
    error,
    linkResult: null,
    openLink,
    clearResult,
  };
}
