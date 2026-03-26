import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useDashboardStore, type SpendingByCategory } from "../src/stores/dashboard";
import { formatCurrency } from "../src/utils/dashboard";
import { apiRequest } from "../src/api/client";
import { colors, borderRadius, shadows, fonts, progressBarStyles } from "../src/theme";
import { Transaction } from "../src/components/TransactionRow";
import { TransactionListCard } from "../src/components/TransactionListCard";


const CATEGORY_COLORS = colors.spendingPalette;

type SelectedMonth = { month: number; year: number } | null;

type DashboardResponse = {
  spending_by_category: SpendingByCategory[];
};

function dateRange(month: number, year: number) {
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { dateFrom, dateTo };
}

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

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
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>(null);
  const [selectedCategoryData, setSelectedCategoryData] = useState<SpendingByCategory[] | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Transaction[] | null>(null);
  const [loadingSelected, setLoadingSelected] = useState(false);

  // Load current month data on focus
  useFocusEffect(
    useCallback(() => {
      load();
      const now = new Date();
      const { dateFrom, dateTo } = dateRange(now.getMonth() + 1, now.getFullYear());
      apiRequest<{ transactions: Transaction[] }>(
        `/v1/transactions?limit=50&type=expense&date_from=${dateFrom}&date_to=${dateTo}`
      ).then((data) => setTransactions(data.transactions));
    }, [])
  );

  // Fetch data for selected month
  useEffect(() => {
    if (!selectedMonth) {
      setSelectedCategoryData(null);
      setSelectedTransactions(null);
      return;
    }

    let cancelled = false;
    setLoadingSelected(true);

    const { month, year } = selectedMonth;
    const { dateFrom, dateTo } = dateRange(month, year);

    Promise.all([
      apiRequest<DashboardResponse>(`/v1/dashboard?month=${month}&year=${year}`),
      apiRequest<{ transactions: Transaction[] }>(
        `/v1/transactions?limit=50&type=expense&date_from=${dateFrom}&date_to=${dateTo}`
      ),
    ]).then(([dashboard, txns]) => {
      if (!cancelled) {
        setSelectedCategoryData(dashboard.spending_by_category);
        setSelectedTransactions(txns.transactions);
        setLoadingSelected(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingSelected(false);
    });

    return () => { cancelled = true; };
  }, [selectedMonth]);

  // Use selected month data or fall back to current month
  const activeCategoryData = selectedCategoryData ?? spendingByCategory;
  const activeTransactions = selectedTransactions ?? transactions;

  const { maxCategoryAmount, totalCatSpending } = useMemo(() => {
    let max = 1;
    let total = 0;
    for (const c of activeCategoryData) {
      const amt = parseFloat(c.amount);
      if (amt > max) max = amt;
      total += amt;
    }
    return { maxCategoryAmount: max, totalCatSpending: total };
  }, [activeCategoryData]);

  const maxMonthAmount = useMemo(() => {
    let max = 1;
    for (const p of spendingOverTime) {
      const amt = parseFloat(p.amount);
      if (amt > max) max = amt;
    }
    return max;
  }, [spendingOverTime]);

  function handleBarPress(month: number, year: number) {
    const now = new Date();
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
    const isAlreadySelected = selectedMonth?.month === month && selectedMonth?.year === year;

    if (isAlreadySelected || isCurrentMonth) {
      setSelectedMonth(null);
    } else {
      setSelectedMonth({ month, year });
    }
  }

  const categoryTitle = selectedMonth
    ? `By Category — ${monthLabel(selectedMonth.month, selectedMonth.year)}`
    : "By Category";

  const transactionTitle = selectedMonth
    ? `Transactions — ${monthLabel(selectedMonth.month, selectedMonth.year)}`
    : undefined;

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
        <Text style={styles.cardTitle}>
          {selectedMonth
            ? `${monthLabel(selectedMonth.month, selectedMonth.year)} Spending`
            : "This Month's Spending"}
        </Text>
        <Text style={styles.totalAmount}>
          {selectedMonth
            ? formatCurrency(totalCatSpending)
            : formatCurrency(monthlySpending)}
        </Text>
      </View>

      {/* Monthly Trend Bar Chart */}
      {spendingOverTime.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Trend</Text>
          <Text style={styles.chartHint}>Tap a bar to view details</Text>
          <View style={styles.barChart}>
            {spendingOverTime.map((point, i) => {
              const amount = parseFloat(point.amount);
              const heightPct = maxMonthAmount > 0 ? (amount / maxMonthAmount) * 100 : 0;
              const now = new Date();
              const isCurrentMonth = point.month === now.getMonth() + 1 && point.year === now.getFullYear();
              const isSelected = selectedMonth?.month === point.month && selectedMonth?.year === point.year;
              const isActive = isSelected || (!selectedMonth && isCurrentMonth);
              return (
                <TouchableOpacity
                  key={`${point.year}-${point.month}`}
                  style={styles.barColumn}
                  onPress={() => handleBarPress(point.month, point.year)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.barValue}>
                    {amount > 0 ? formatCurrency(amount) : ""}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(heightPct, 2)}%`,
                          backgroundColor: isActive ? colors.primaryLight : colors.primaryDark,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      isActive && styles.barLabelActive,
                    ]}
                  >
                    {point.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Category Breakdown — Horizontal Bars */}
      {loadingSelected ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : activeCategoryData.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{categoryTitle}</Text>

          {/* Stacked summary bar */}
          <View style={styles.stackedBar}>
            {activeCategoryData.map((cat, i) => {
              const pct =
                totalCatSpending > 0
                  ? (parseFloat(cat.amount) / totalCatSpending) * 100
                  : 0;
              if (pct < 1) return null;
              return (
                <View
                  key={`${cat.category_name}-${i}`}
                  style={[
                    styles.stackedSegment,
                    {
                      width: `${pct}%`,
                      backgroundColor:
                        cat.category_color || CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                    },
                    i === 0 && styles.stackedFirst,
                    i === activeCategoryData.length - 1 && styles.stackedLast,
                  ]}
                />
              );
            })}
          </View>

          {/* Individual category bars */}
          {activeCategoryData.map((cat, i) => {
            const amount = parseFloat(cat.amount);
            const pct = (amount / maxCategoryAmount) * 100;
            const color = cat.category_color || CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <View key={`${cat.category_name}-${i}`} style={styles.categoryRow}>
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
      ) : null}

      {/* Transactions */}
      {!loadingSelected && activeTransactions.length > 0 && (
        <TransactionListCard transactions={activeTransactions} title={transactionTitle} />
      )}

      {activeCategoryData.length === 0 && !isLoading && !loadingSelected && (
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
  chartHint: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: -8,
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 40,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`,
    ...shadows.card,
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
