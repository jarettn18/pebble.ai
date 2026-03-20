import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { AccountSummary } from "../../src/stores/dashboard";
import { useAuthStore } from "../../src/stores/auth";
import { useDashboardStore } from "../../src/stores/dashboard";
import { useAccountsStore } from "../../src/stores/accounts";
import { useTransactionsStore } from "../../src/stores/transactions";
import { usePlaidLink } from "../../src/hooks/usePlaidLink";
import { apiRequest } from "../../src/api/client";
import { formatCurrency } from "../../src/utils/dashboard";
import PieChart from "../../src/components/PieChart";
import NetWorthChart from "../../src/components/NetWorthChart";

const PIE_COLORS = [
  "#1a1a2e",
  "#16213e",
  "#0f3460",
  "#533483",
  "#e94560",
  "#f38181",
  "#fce38a",
  "#95e1d3",
  "#aa96da",
  "#c4edde",
];

const INCOME_COLORS = [
  "#2e7d32",
  "#388e3c",
  "#43a047",
  "#4caf50",
  "#66bb6a",
  "#81c784",
  "#a5d6a7",
  "#c8e6c9",
  "#1b5e20",
  "#2e7d32",
];

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  depository: "Bank",
  credit: "Credit Card",
  loan: "Loan",
  investment: "Investment",
};

function AccountRow({ account, isLast }: { account: AccountSummary; isLast: boolean }) {
  const bal = account.balance_current ? parseFloat(account.balance_current) : null;
  const isDebt = account.type === "credit" || account.type === "loan";
  const typeLabel = ACCOUNT_TYPE_LABELS[account.type] ?? account.type;
  const label = account.institution_name
    ? `${account.institution_name} — ${account.name}`
    : account.name;

  return (
    <View style={[styles.accountRow, !isLast && styles.accountRowBorder]}>
      <View style={styles.accountInfo}>
        <Text style={styles.accountName} numberOfLines={1}>{label}</Text>
        <Text style={styles.accountType}>{typeLabel}{account.subtype ? ` · ${account.subtype}` : ""}</Text>
      </View>
      {bal !== null && Number.isFinite(bal) && (
        <Text style={[styles.accountBalance, isDebt && styles.negative]}>
          {isDebt ? "-" : ""}{formatCurrency(bal)}
        </Text>
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [exchanging, setExchanging] = useState(false);

  const {
    netWorth,
    monthlySpending,
    monthlyIncome,
    refreshCount,
    accounts,
    budgetSummaries,
    spendingByCategory,
    incomeByCategory,
    isLoading: dashLoading,
    load: loadDashboard,
    refresh: refreshDashboard,
  } = useDashboardStore();

  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const syncTransactions = useTransactionsStore((s) => s.syncAndRefresh);

  const { isLoading, error, linkResult, openLink, clearResult } =
    usePlaidLink();

  // Refresh balances (if stale) and reload dashboard on tab focus
  useFocusEffect(
    useCallback(() => {
      async function refreshAndLoad() {
        try {
          await apiRequest("/v1/plaid/refresh-balances", { method: "POST" });
        } catch {
          // may fail if no items linked
        }
        await loadDashboard(undefined, undefined, true);
      }
      refreshAndLoad();
    }, [])
  );

  // Plaid exchange flow
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
          Alert.alert(
            "Account Connected",
            `Linked ${result.accounts_linked} account${result.accounts_linked === 1 ? "" : "s"} from ${metadata.institution?.name ?? "your institution"}`
          );
          // Refresh all data after linking
          refreshAccounts();
          syncTransactions();
          refreshDashboard();
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

  const hasAccounts = accounts.length > 0;
  const busy = isLoading || exchanging;
  const [carouselPage, setCarouselPage] = useState(0);
  const cardWidth = Dimensions.get("window").width - 40;

  const onCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    setCarouselPage(page);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={dashLoading}
          onRefresh={refreshDashboard}
          tintColor="#1a1a2e"
        />
      }
    >
      <Text style={styles.greeting}>
        Hello, {user?.full_name?.split(" ")[0] ?? "there"}
      </Text>
      <Text style={styles.subtitle}>Your financial overview</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Net Worth</Text>
        {dashLoading && !hasAccounts ? (
          <ActivityIndicator size="small" color="#1a1a2e" style={styles.cardLoader} />
        ) : (
          <Text style={[styles.cardValue, netWorth !== null && netWorth < 0 && styles.negative]}>
            {netWorth !== null ? formatCurrency(netWorth) : "--"}
          </Text>
        )}
        {hasAccounts && <NetWorthChart refreshKey={refreshCount} />}
        {!hasAccounts && !dashLoading && (
          <Text style={styles.cardHint}>Connect a bank account to get started</Text>
        )}
      </View>

      <View style={styles.carouselWrapper}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onCarouselScroll}
          contentContainerStyle={styles.carouselContent}
        >
          <TouchableOpacity
            style={[styles.card, styles.carouselCard, { width: cardWidth }]}
            onPress={() => router.push("/spending")}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>This Month's Spending</Text>
            {dashLoading && !hasAccounts ? (
              <ActivityIndicator size="small" color="#1a1a2e" style={styles.cardLoader} />
            ) : (
              <Text style={styles.cardValue}>
                {hasAccounts ? formatCurrency(monthlySpending) : "--"}
              </Text>
            )}
            {spendingByCategory.length > 0 && (
              <PieChart
                slices={spendingByCategory.map((cat, i) => ({
                  label: cat.category_name,
                  value: parseFloat(cat.amount),
                  color: PIE_COLORS[i % PIE_COLORS.length],
                }))}
              />
            )}
            {hasAccounts && (
              <Text style={styles.cardLink}>View details →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.carouselCard, { width: cardWidth }]}
            onPress={() => router.push("/income")}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>This Month's Income</Text>
            {dashLoading && !hasAccounts ? (
              <ActivityIndicator size="small" color="#1a1a2e" style={styles.cardLoader} />
            ) : (
              <Text style={[styles.cardValue, styles.incomeValue]}>
                {hasAccounts ? formatCurrency(monthlyIncome) : "--"}
              </Text>
            )}
            {incomeByCategory.length > 0 && (
              <PieChart
                slices={incomeByCategory.map((cat, i) => ({
                  label: cat.category_name,
                  value: parseFloat(cat.amount),
                  color: INCOME_COLORS[i % INCOME_COLORS.length],
                }))}
              />
            )}
            {hasAccounts && (
              <Text style={styles.cardLink}>View details →</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.dots}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={[styles.dot, carouselPage === i && styles.dotActive]}
            />
          ))}
        </View>
      </View>

      {/* Top spending categories */}
      {spendingByCategory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending by Category</Text>
          {spendingByCategory.slice(0, 5).map((cat, i) => (
            <View
              key={cat.category_name}
              style={[styles.catRow, i < Math.min(spendingByCategory.length, 5) - 1 && styles.catRowBorder]}
            >
              <Text style={styles.catName}>{cat.category_name}</Text>
              <Text style={styles.catAmount}>{formatCurrency(parseFloat(cat.amount))}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Budget overview */}
      {budgetSummaries.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Budget Overview</Text>
          {budgetSummaries.map((b, i) => {
            const budgeted = parseFloat(b.amount || "0");
            const spent = parseFloat(b.spent || "0");
            const progress = budgeted > 0 ? Math.min(spent / budgeted, 1) : 0;
            const overBudget = spent > budgeted;
            return (
              <View key={i} style={[styles.budgetRow, i < budgetSummaries.length - 1 && styles.budgetRowBorder]}>
                <View style={styles.budgetInfo}>
                  <Text style={styles.budgetName}>{b.category_name || "Uncategorized"}</Text>
                  <Text style={[styles.budgetSpent, overBudget && styles.negative]}>
                    {formatCurrency(spent)} / {formatCurrency(budgeted)}
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress * 100}%` },
                      overBudget && styles.progressOverBudget,
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {hasAccounts && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accounts</Text>
          {accounts.map((acct, i) => (
            <AccountRow key={acct.id} account={acct} isLast={i === accounts.length - 1} />
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.connectButton, busy && styles.connectButtonDisabled]}
        onPress={openLink}
        disabled={busy}
        activeOpacity={0.8}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.connectButtonText}>
            {hasAccounts ? "+ Add Another Account" : "Connect Bank Account"}
          </Text>
        )}
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
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
  cardLoader: {
    alignSelf: "flex-start",
    marginVertical: 8,
  },
  cardHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
  },
  cardLink: {
    fontSize: 13,
    color: "#0f3460",
    fontWeight: "600",
    marginTop: 8,
  },
  incomeValue: {
    color: "#2e7d32",
  },
  carouselWrapper: {
    marginBottom: 16,
  },
  carouselContent: {
    paddingRight: 20,
  },
  carouselCard: {
    marginBottom: 0,
    marginRight: 12,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#d0d0d0",
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: "#1a1a2e",
  },
  negative: {
    color: "#d32f2f",
  },
  catRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  catRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  catName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1a1a2e",
    flex: 1,
  },
  catAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  budgetRow: {
    paddingVertical: 10,
  },
  budgetRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  budgetInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  budgetName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a2e",
    flex: 1,
  },
  budgetSpent: {
    fontSize: 13,
    color: "#666",
  },
  progressBar: {
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    overflow: "hidden" as const,
  },
  progressFill: {
    height: "100%" as unknown as number,
    backgroundColor: "#1a1a2e",
    borderRadius: 2,
  },
  progressOverBudget: {
    backgroundColor: "#d32f2f",
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
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  accountRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  accountInfo: {
    flex: 1,
    marginRight: 12,
  },
  accountName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1a1a2e",
  },
  accountType: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  accountBalance: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  errorText: {
    color: "#d32f2f",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
});
