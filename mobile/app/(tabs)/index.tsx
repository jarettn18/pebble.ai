import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuthStore } from "../../src/stores/auth";
import { usePlaidLink } from "../../src/hooks/usePlaidLink";
import { apiRequest } from "../../src/api/client";

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const [linked, setLinked] = useState(false);
  const [exchanging, setExchanging] = useState(false);

  const { isLoading, error, linkResult, openLink, clearResult } =
    usePlaidLink();

  useEffect(() => {
    if (!linkResult) return;

    const { publicToken, metadata } = linkResult;
    let cancelled = false;

    async function exchangeToken() {
      setExchanging(true);
      try {
        const result = await apiRequest<{
          item_id: string;
          accounts_linked: number;
        }>("/v1/plaid/exchange", {
          method: "POST",
          body: {
            public_token: publicToken,
            institution_id: metadata.institution?.id ?? null,
            institution_name: metadata.institution?.name ?? null,
          },
        });

        if (!cancelled) {
          setLinked(true);
          Alert.alert(
            "Account Connected",
            `Linked ${result.accounts_linked} account${result.accounts_linked === 1 ? "" : "s"} from ${metadata.institution?.name ?? "your institution"}`
          );
        }
      } catch (err) {
        if (!cancelled) {
          Alert.alert(
            "Connection Failed",
            err instanceof Error
              ? err.message
              : "Could not save linked account"
          );
        }
      } finally {
        if (!cancelled) {
          setExchanging(false);
          clearResult();
        }
      }
    }

    exchangeToken();

    return () => {
      cancelled = true;
    };
  }, [linkResult, clearResult]);

  const busy = isLoading || exchanging;

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        Hello, {user?.full_name?.split(" ")[0] ?? "there"}
      </Text>
      <Text style={styles.subtitle}>Your financial overview</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Net Worth</Text>
        <Text style={styles.cardValue}>--</Text>
        <Text style={styles.cardHint}>Connect a bank account to get started</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>This Month's Spending</Text>
        <Text style={styles.cardValue}>--</Text>
      </View>

      {!linked && (
        <TouchableOpacity
          style={[styles.connectButton, busy && styles.connectButtonDisabled]}
          onPress={openLink}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.connectButtonText}>Connect Bank Account</Text>
          )}
        </TouchableOpacity>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a2e",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  cardHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
  },
  connectButton: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  connectButtonDisabled: {
    opacity: 0.7,
  },
  connectButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#d32f2f",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
});
