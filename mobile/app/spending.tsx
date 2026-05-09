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
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useDashboardStore, type SpendingByCategory } from "../src/stores/dashboard";
import { formatCurrency } from "../src/utils/dashboard";
import { apiRequest } from "../src/api/client";
import {
  colors,
  borderRadius,
  shadows,
  fonts,
  heroCard,
  heroProgressBarStyles,
  microLabel,
  microLabelTiny,
} from "../src/theme";
import { getCategoryColor, withOpacity } from "../src/utils/color";
import { getCategoryIcon } from "../src/utils/categoryIcons";
import { Transaction } from "../src/components/TransactionRow";
import { TransactionListCard } from "../src/components/TransactionListCard";

const CATEGORY_COLORS = colors.spendingPalette;

// Spending screen uses the warm coral accent for chart highlights (differentiates from income)
const TREND_ACCENT = colors.accent;
const TREND_ACCENT_DIM = colors.spendingTrendDim;

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
  const router = useRouter();
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
    }).catch((err) => {
      if (!cancelled) setLoadingSelected(false);
      if (__DEV__) console.warn("Failed to load spending data:", err);
    });

    return () => { cancelled = true; };
  }, [selectedMonth]);

  // Use selected month data or fall back to current month
  const activeCategoryData = selectedCategoryData ?? spendingByCategory;
  const activeTransactions = selectedTransactions ?? transactions;

  const { maxCategoryAmount, totalCatSpending, topCategory } = useMemo(() => {
    let max = 1;
    let total = 0;
    let top: SpendingByCategory | null = null;
    for (const c of activeCategoryData) {
      const amt = parseFloat(c.amount);
      if (amt > max) max = amt;
      if (!top || amt > parseFloat(top.amount)) top = c;
      total += amt;
    }
    return { maxCategoryAmount: max, totalCatSpending: total, topCategory: top };
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

  const displayTotal = selectedMonth ? totalCatSpending : monthlySpending;
  const headerLabel = selectedMonth
    ? monthLabel(selectedMonth.month, selectedMonth.year).toUpperCase() + " SPENDING"
    : "THIS MONTH'S SPENDING";

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
          tintColor={colors.accent}
        />
      }
    >
      {/* Hero — dark surface, big amount, nested summary pill */}
      <View style={styles.heroCard}>
        <View style={styles.heroCardGlow} />
        <Text style={styles.heroLabel}>{headerLabel}</Text>
        <Text style={styles.heroAmount}>{formatCurrency(displayTotal)}</Text>
        <Text style={styles.heroSubtitle}>
          {activeCategoryData.length > 0
            ? `Across ${activeCategoryData.length} ${activeCategoryData.length === 1 ? "category" : "categories"}`
            : "No spending recorded yet"}
        </Text>

        {topCategory && totalCatSpending > 0 && (
          <View style={heroProgressBarStyles.container}>
            <View style={heroProgressBarStyles.header}>
              <View>
                <Text style={heroProgressBarStyles.label}>Top Category</Text>
                <Text style={heroProgressBarStyles.value}>
                  {topCategory.category_name}
                </Text>
              </View>
              <Text style={heroProgressBarStyles.remaining}>
                {formatCurrency(parseFloat(topCategory.amount))}
              </Text>
            </View>
            <View style={[heroProgressBarStyles.track, styles.stackedTrack]}>
              {activeCategoryData.map((cat, i) => {
                const pct =
                  totalCatSpending > 0
                    ? (parseFloat(cat.amount) / totalCatSpending) * 100
                    : 0;
                if (pct < 1) return null;
                return (
                  <View
                    key={`${cat.category_name}-${i}`}
                    style={{
                      width: `${pct}%`,
                      height: "100%" as unknown as number,
                      backgroundColor: getCategoryColor(cat.category_color, CATEGORY_COLORS, i),
                    }}
                  />
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Monthly Trend */}
      {spendingOverTime.length > 0 && (
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>MONTHLY TREND</Text>
            <Text style={styles.sectionHint}>Tap a bar to filter</Text>
          </View>
          <View style={styles.barChart}>
            {spendingOverTime.map((point) => {
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
                  <Text style={[styles.barValue, isActive && styles.barValueActive]}>
                    {amount > 0 ? formatCurrency(amount) : ""}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(heightPct, 2)}%`,
                          backgroundColor: isActive ? TREND_ACCENT : TREND_ACCENT_DIM,
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

      {/* Category Breakdown — colored cards with icons */}
      {loadingSelected ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : activeCategoryData.length > 0 ? (
        <View style={styles.categoriesSection}>
          <Text style={styles.categoriesTitle}>{categoryTitle}</Text>

          {activeCategoryData.map((cat, i) => {
            const amount = parseFloat(cat.amount);
            const pct = (amount / maxCategoryAmount) * 100;
            const sharePct = totalCatSpending > 0 ? (amount / totalCatSpending) * 100 : 0;
            const catColor = getCategoryColor(cat.category_color, CATEGORY_COLORS, i);
            const iconBg = withOpacity(catColor, 0.2);
            const activeMonth = selectedMonth ?? { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
            return (
              <TouchableOpacity
                key={`${cat.category_name}-${i}`}
                style={[styles.categoryCard, { borderColor: withOpacity(catColor, 0.22) }]}
                activeOpacity={0.85}
                onPress={() =>
                  router.push(
                    `/budget-transactions?category_id=${cat.category_id}&category_name=${encodeURIComponent(cat.category_name)}&category_color=${encodeURIComponent(catColor)}&spent=${cat.amount}&month=${activeMonth.month}&year=${activeMonth.year}`
                  )
                }
              >
                <View
                  style={[
                    styles.categoryCardGlow,
                    { backgroundColor: withOpacity(catColor, 0.18) },
                  ]}
                />
                <View style={styles.categoryCardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                    <MaterialCommunityIcons
                      name={getCategoryIcon(cat.category_name) as any}
                      size={22}
                      color={catColor}
                    />
                  </View>
                  <View style={styles.categoryCardMid}>
                    <Text style={styles.categoryCardName} numberOfLines={1}>
                      {cat.category_name}
                    </Text>
                    <Text style={styles.categoryCardSub}>
                      {sharePct.toFixed(0)}% of total
                    </Text>
                  </View>
                  <View style={styles.categoryCardRight}>
                    <Text style={styles.categoryCardAmount}>
                      {formatCurrency(amount)}
                    </Text>
                    <Text style={styles.categoryCardLabel}>SPENT</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.categoryCardTrack,
                    { backgroundColor: withOpacity(catColor, 0.14) },
                  ]}
                >
                  <View
                    style={[
                      styles.categoryCardFill,
                      { width: `${pct}%`, backgroundColor: catColor },
                    ]}
                  />
                </View>
              </TouchableOpacity>
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

  // Hero
  heroCard: {
    ...heroCard.surface,
    marginBottom: 16,
  },
  heroCardGlow: heroCard.glow,
  heroLabel: heroCard.label,
  heroAmount: {
    fontSize: 40,
    fontFamily: fonts.extraBold,
    color: colors.heroTextPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.heroTextSecondary,
  },
  stackedTrack: {
    flexDirection: "row",
    overflow: "hidden",
  },

  // Light-surface card (trend)
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`,
    ...shadows.card,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
  },
  sectionEyebrow: {
    ...microLabel,
    color: colors.textSecondary,
  },
  sectionHint: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },

  // Loading card
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

  // Bar chart
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
    color: colors.textMuted,
    marginBottom: 4,
    textAlign: "center",
  },
  barValueActive: {
    color: colors.accentDark,
    fontFamily: fonts.bold,
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
    minHeight: 2,
  },
  barLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 6,
  },
  barLabelActive: {
    color: colors.accentDark,
    fontFamily: fonts.bold,
  },

  // Categories section
  categoriesSection: {
    marginBottom: 16,
  },
  categoriesTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.heroSurface,
    letterSpacing: -0.3,
    marginBottom: 12,
    marginTop: 4,
  },

  // Category cards
  categoryCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    ...shadows.card,
  },
  categoryCardGlow: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  categoryCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  categoryCardMid: {
    flex: 1,
    marginRight: 12,
  },
  categoryCardName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.heroSurface,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  categoryCardSub: {
    fontSize: 12,
    fontFamily: fonts.labelMedium,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  categoryCardRight: {
    alignItems: "flex-end",
  },
  categoryCardAmount: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: colors.heroSurface,
    letterSpacing: -0.3,
  },
  categoryCardLabel: {
    ...microLabelTiny,
    color: colors.textMuted,
    marginTop: 2,
  },
  categoryCardTrack: {
    height: 10,
    borderRadius: borderRadius.pill,
    overflow: "hidden",
  },
  categoryCardFill: {
    height: "100%" as unknown as number,
    borderRadius: borderRadius.pill,
  },
});
