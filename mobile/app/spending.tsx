import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useDashboardStore } from "../src/stores/dashboard";
import { formatCurrency } from "../src/utils/dashboard";
import { apiRequest } from "../src/api/client";
import { colors, borderRadius, shadows, fonts, progressBarStyles } from "../src/theme";
import { Transaction } from "../src/components/TransactionRow";
import { TransactionListCard } from "../src/components/TransactionListCard";


const CATEGORY_COLORS = colors.spendingPalette;

export default function SpendingScreen() {
  const {
    monthlySpending,
    spendingByCategory,
    spendingOverTime,
    isLoading,
    load,
    refresh,
  } = useDashboardStore();

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useFocusEffect(
    useCallback(() => {
      load();
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const dateFrom = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const dateTo = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      apiRequest<{ transactions: Transaction[] }>(
        `/v1/transactions?limit=50&type=expense&date_from=${dateFrom}&date_to=${dateTo}`
      ).then((data) => setTransactions(data.transactions));
    }, [])
  );

  const maxCategoryAmount = Math.max(
    ...spendingByCategory.map((c) => parseFloat(c.amount)),
    1
  );

  const maxMonthAmount = Math.max(
    ...spendingOverTime.map((p) => parseFloat(p.amount)),
    1
  );

  // Donut-style breakdown as stacked horizontal bar
  const totalCatSpending = spendingByCategory.reduce(
    (sum, c) => sum + parseFloat(c.amount),
    0
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Monthly Total */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>This Month's Spending</Text>
        <Text style={styles.totalAmount}>{formatCurrency(monthlySpending)}</Text>
      </View>

      {/* Monthly Trend Bar Chart */}
      {spendingOverTime.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Trend</Text>
          <View style={styles.barChart}>
            {spendingOverTime.map((point, i) => {
              const amount = parseFloat(point.amount);
              const heightPct = maxMonthAmount > 0 ? (amount / maxMonthAmount) * 100 : 0;
              const isCurrentMonth =
                i === spendingOverTime.length - 1;
              return (
                <View key={`${point.year}-${point.month}`} style={styles.barColumn}>
                  <Text style={styles.barValue}>
                    {amount > 0 ? formatCurrency(amount) : ""}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(heightPct, 2)}%`,
                          backgroundColor: isCurrentMonth ? colors.primaryLight : colors.primaryDark,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      isCurrentMonth && styles.barLabelActive,
                    ]}
                  >
                    {point.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Category Breakdown — Horizontal Bars */}
      {spendingByCategory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Category</Text>

          {/* Stacked summary bar */}
          <View style={styles.stackedBar}>
            {spendingByCategory.map((cat, i) => {
              const pct =
                totalCatSpending > 0
                  ? (parseFloat(cat.amount) / totalCatSpending) * 100
                  : 0;
              if (pct < 1) return null;
              return (
                <View
                  key={cat.category_name}
                  style={[
                    styles.stackedSegment,
                    {
                      width: `${pct}%`,
                      backgroundColor:
                        CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                    },
                    i === 0 && styles.stackedFirst,
                    i === spendingByCategory.length - 1 && styles.stackedLast,
                  ]}
                />
              );
            })}
          </View>

          {/* Individual category bars */}
          {spendingByCategory.map((cat, i) => {
            const amount = parseFloat(cat.amount);
            const pct = (amount / maxCategoryAmount) * 100;
            const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <View key={cat.category_name} style={styles.categoryRow}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryLabelRow}>
                    <View
                      style={[styles.categoryDot, { backgroundColor: color }]}
                    />
                    <Text style={styles.categoryName}>{cat.category_name}</Text>
                  </View>
                  <Text style={styles.categoryAmount}>
                    {formatCurrency(amount)}
                  </Text>
                </View>
                <View style={progressBarStyles.track}>
                  <View
                    style={[
                      progressBarStyles.fill,
                      { width: `${pct}%`, backgroundColor: color },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Transactions */}
      {transactions.length > 0 && (
        <TransactionListCard transactions={transactions} />
      )}

      {spendingByCategory.length === 0 && !isLoading && (
        <TransactionListCard
          transactions={[]}
          emptyMessage="No spending data yet"
          emptyHint="Transactions will appear here once synced"
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

  // --- Bar Chart (vertical) ---
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 180,
    marginTop: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  barValue: {
    fontSize: 10,
    fontFamily: fonts.labelMedium,
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: "center",
  },
  barTrack: {
    flex: 1,
    width: "60%",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 6,
  },
  barLabelActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },

  // --- Stacked bar ---
  stackedBar: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 16,
  },
  stackedSegment: {
    height: "100%",
  },
  stackedFirst: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  stackedLast: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },

  // --- Category rows ---
  categoryRow: {
    marginBottom: 14,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  categoryAmount: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
});
