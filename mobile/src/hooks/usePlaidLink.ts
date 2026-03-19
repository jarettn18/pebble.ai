import { useState, useCallback } from "react";
import {
  create,
  open,
  dismissLink,
  LinkSuccess,
  LinkExit,
  LinkIOSPresentationStyle,
  LinkLogLevel,
} from "react-native-plaid-link-sdk";

import { apiRequest } from "../api/client";

type PlaidLinkResult = {
  publicToken: string;
  metadata: LinkSuccess["metadata"];
};

type UsePlaidLinkReturn = {
  isLoading: boolean;
  error: string | null;
  linkResult: PlaidLinkResult | null;
  openLink: () => Promise<void>;
  clearResult: () => void;
};

export function usePlaidLink(): UsePlaidLinkReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkResult, setLinkResult] = useState<PlaidLinkResult | null>(null);

  const clearResult = useCallback(() => setLinkResult(null), []);

  const openLink = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { link_token } = await apiRequest<{
        link_token: string;
        expiration: string;
      }>("/v1/plaid/link-token", { method: "POST" });

      create({
        token: link_token,
        noLoadingState: false,
      });

      open({
        onSuccess: (success: LinkSuccess) => {
          setLinkResult({
            publicToken: success.publicToken,
            metadata: success.metadata,
          });
          setIsLoading(false);
        },
        onExit: (exit: LinkExit) => {
          if (exit.error) {
            setError(exit.error.displayMessage || "Link session ended");
          }
          dismissLink();
          setIsLoading(false);
        },
        iOSPresentationStyle: LinkIOSPresentationStyle.MODAL,
        logLevel: LinkLogLevel.ERROR,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start link";
      setError(message);
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, linkResult, openLink, clearResult };
}
