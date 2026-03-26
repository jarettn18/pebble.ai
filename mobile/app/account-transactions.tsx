import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { apiRequest } from "../src/api/client";
import { formatCurrency } from "../src/utils/dashboard";
import { colors, borderRadius, shadows, fonts } from "../src/theme";
import { Transaction } from "../src/components/TransactionRow";
import { TransactionListCard } from "../src/components/TransactionListCard";

export default function AccountTransactionsScreen() {
  const params = useLocalSearchParams<{
    account_id: string;
    account_name: string;
    balance_current?: string;
    account_type?: string;
    institution_name?: string;
  }>();

  const accountId = params.account_id;
  const accountName = params.account_name || "Account";
  const balanceCurrent = params.balance_current
    ? parseFloat(params.balance_current)
    : null;
  const accountType = params.account_type || "";
  const institutionName = params.institution_name || "";
  const isDebt = accountType === "credit" || accountType === "loan";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = useCallback(async () => {
    const data = await apiRequest<{ transactions: Transaction[] }>(
      `/v1/transactions?account_id=${accountId}&limit=200`
    );
    setTransactions(data.transactions);
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchTransactions().finally(() => setIsLoading(false));
    }, [fetchTransactions])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  }, [fetchTransactions]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Account Summary Card */}
      <View style={styles.card}>
        {institutionName ? (
          <Text style={styles.cardSubtitle}>{institutionName}</Text>
        ) : null}
        <Text style={styles.cardTitle}>{accountName}</Text>
        {balanceCurrent !== null && (
          <Text style={[styles.totalAmount, isDebt && styles.debtAmount]}>
            {isDebt ? "-" : ""}
            {formatCurrency(balanceCurrent)}
          </Text>
        )}
      </View>

      {/* Transactions */}
      {isLoading && (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 32 }}
        />
      )}

      {!isLoading && (
        <TransactionListCard
          transactions={transactions}
          emptyMessage="No transactions"
          emptyHint="No transactions found for this account"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`,
    ...shadows.card,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  totalAmount: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  debtAmount: {
    color: colors.negative,
  },
});
