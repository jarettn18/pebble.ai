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
import { colors, borderRadius, shadows, fonts, progressBarStyles } from "../src/theme";
import { Transaction } from "../src/components/TransactionRow";
import { TransactionListCard } from "../src/components/TransactionListCard";

export default function BudgetTransactionsScreen() {
  const params = useLocalSearchParams<{
    category_id: string;
    category_name: string;
    budget_amount?: string;
    spent?: string;
    month?: string;
    year?: string;
  }>();

  const categoryId = params.category_id;
  const categoryName = params.category_name || "Uncategorized";
  const budgetAmount = params.budget_amount
    ? parseFloat(params.budget_amount)
    : null;
  const spent = params.spent ? parseFloat(params.spent) : null;

  const now = new Date();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = useCallback(async () => {
    const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const data = await apiRequest<{ transactions: Transaction[] }>(
      `/v1/transactions?category_id=${categoryId}&date_from=${dateFrom}&date_to=${dateTo}&limit=200`
    );
    setTransactions(data.transactions);
  }, [categoryId, month, year]);

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

  const pct =
    budgetAmount && budgetAmount > 0 && spent !== null
      ? Math.min((spent / budgetAmount) * 100, 100)
      : null;
  const remaining =
    budgetAmount !== null && spent !== null ? budgetAmount - spent : null;
  const overBudget = remaining !== null && remaining < 0;

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
      {/* Budget Summary Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{categoryName}</Text>
        {spent !== null && (
          <Text style={styles.totalAmount}>{formatCurrency(spent)}</Text>
        )}
        {budgetAmount !== null && pct !== null && (
          <View style={styles.budgetInfo}>
            <View style={progressBarStyles.header}>
              <Text style={progressBarStyles.label}>
                {pct.toFixed(0)}% of {formatCurrency(budgetAmount)}
              </Text>
              <Text
                style={[
                  progressBarStyles.value,
                  overBudget && { color: colors.negative },
                ]}
              >
                {overBudget
                  ? `${formatCurrency(Math.abs(remaining!))} over`
                  : `${formatCurrency(remaining!)} left`}
              </Text>
            </View>
            <View style={progressBarStyles.track}>
              <View
                style={[
                  progressBarStyles.fill,
                  {
                    width: `${pct}%`,
                    backgroundColor: overBudget
                      ? colors.negative
                      : colors.primary,
                  },
                ]}
              />
            </View>
          </View>
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
          emptyHint="No transactions found for this category"
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
  budgetInfo: {
    marginTop: 16,
  },
});
