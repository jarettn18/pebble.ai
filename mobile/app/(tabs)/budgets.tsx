import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBudgetsStore } from "../../src/stores/budgets";
import { useDashboardStore } from "../../src/stores/dashboard";
import { formatCurrency } from "../../src/utils/dashboard";
import { withOpacity, contrastForeground } from "../../src/utils/color";
import { apiRequest } from "../../src/api/client";
import { colors, fonts, progressBarStyles } from "../../src/theme";
import ColorPickerModal from "../../src/components/ColorPickerModal";

const HIT_SLOP_8 = { top: 8, bottom: 8, left: 8, right: 8 };

const FALLBACK_COLORS = [
  colors.secondary,
  colors.primary,
  colors.tertiary,
  colors.secondary,
  colors.primary,
  colors.tertiary,
];

const CATEGORY_ICONS: Record<string, string> = {
  dining: "silverware-fork-knife",
  food: "silverware-fork-knife",
  restaurant: "silverware-fork-knife",
  groceries: "cart-outline",
  grocery: "cart-outline",
  shopping: "shopping-outline",
  transport: "car-outline",
  transportation: "car-outline",
  travel: "airplane",
  entertainment: "movie-open-outline",
  health: "spa-outline",
  wellness: "spa-outline",
  utilities: "flash-outline",
  subscriptions: "sync",
  rent: "home-outline",
  housing: "home-outline",
  education: "book-open-variant",
  personal: "account-outline",
  insurance: "shield-outline",
  savings: "piggy-bank-outline",
  investments: "chart-line",
};

function getCategoryIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "clipboard-text-outline";
}

function getCurrentMonth() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function monthLabel(month: number, year: number) {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function BudgetSeparator() {
  return <View style={styles.separator} />;
}

export default function BudgetsScreen() {
  const router = useRouter();
  const { budgets, isLoading, error, load } = useBudgetsStore();
  const refreshDashboard = useDashboardStore((s) => s.refresh);
  const [period, setPeriod] = useState(getCurrentMonth);

  // Color picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerCategoryId, setPickerCategoryId] = useState<string | null>(null);
  const [pickerCurrentColor, setPickerCurrentColor] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      load(period.month, period.year);
    }, [period.month, period.year])
  );

  function shiftMonth(delta: number) {
    setPeriod((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m < 1) {
        m = 12;
        y -= 1;
      } else if (m > 12) {
        m = 1;
        y += 1;
      }
      return { month: m, year: y };
    });
  }

  const { totalBudgeted, totalSpent, budgetRemaining, budgetPct, isOverBudget } = useMemo(() => {
    const { budgeted, spent } = budgets.reduce(
      (acc, b) => ({
        budgeted: acc.budgeted + parseFloat(b.amount || "0"),
        spent: acc.spent + parseFloat(b.spent || "0"),
      }),
      { budgeted: 0, spent: 0 }
    );
    return {
      totalBudgeted: budgeted,
      totalSpent: spent,
      budgetRemaining: budgeted - spent,
      budgetPct: budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0,
      isOverBudget: spent > budgeted,
    };
  }, [budgets]);

  function openColorPicker(categoryId: string, currentColor: string | null) {
    setPickerCategoryId(categoryId);
    setPickerCurrentColor(currentColor);
    setPickerVisible(true);
  }

  async function handleColorSelect(color: string) {
    setPickerVisible(false);
    if (!pickerCategoryId) return;

    try {
      await apiRequest(`/v1/categories/${pickerCategoryId}`, {
        method: "PATCH",
        body: { color },
      });
      // Refresh both stores so colors update everywhere
      await Promise.all([
        load(period.month, period.year),
        refreshDashboard(),
      ]);
    } catch {
      // Silently fail — the old color remains
    }
  }

  const renderHeader = useCallback(() => (
    <>
      {/* Month Selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={12}>
          <Text style={styles.monthArrow}>{"\u2190"}</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {monthLabel(period.month, period.year)}
        </Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={12}>
          <Text style={styles.monthArrow}>{"\u2192"}</Text>
        </TouchableOpacity>
      </View>

      {/* Hero Header */}
      {budgets.length > 0 && (
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>SPENDING CATEGORIES</Text>
          <Text style={styles.heroAmount}>{formatCurrency(totalSpent)}</Text>
          <Text style={styles.heroSubtitle}>Total monthly spend so far</Text>

          {/* Summary Progress Pill */}
          <View style={[progressBarStyles.container, styles.summaryPill]}>
            <View style={progressBarStyles.header}>
              <View>
                <Text style={progressBarStyles.label}>Overall Budget</Text>
                <Text style={progressBarStyles.value}>
                  {budgetPct}%{" "}
                  <Text style={progressBarStyles.valueSub}>
                    of {formatCurrency(totalBudgeted)}
                  </Text>
                </Text>
              </View>
              <Text
                style={[
                  progressBarStyles.remaining,
                  isOverBudget && styles.errorText,
                ]}
              >
                {isOverBudget ? "Over by " : ""}
                {formatCurrency(Math.abs(budgetRemaining))}{" "}
                {isOverBudget ? "" : "left"}
              </Text>
            </View>
            <View style={progressBarStyles.track}>
              <View
                style={[
                  progressBarStyles.fill,
                  { width: `${Math.min(budgetPct, 100)}%` },
                  isOverBudget && { backgroundColor: colors.error },
                ]}
              />
            </View>
          </View>
        </View>
      )}

      {/* Categories Header */}
      <View style={styles.categoriesHeader}>
        <Text style={styles.categoriesTitle}>Categories</Text>
        <TouchableOpacity
          onPress={() =>
            router.push(
              `/budget/new?month=${period.month}&year=${period.year}`
            )
          }
          hitSlop={8}
        >
          <Text style={styles.createNewText}>+ Create New</Text>
        </TouchableOpacity>
      </View>
    </>
  ), [period, budgets, totalSpent, totalBudgeted, budgetPct, budgetRemaining, isOverBudget, router]);

  return (
    <View style={styles.container}>
      {isLoading && budgets.length === 0 ? (
        <>
          {renderHeader()}
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </>
      ) : budgets.length === 0 ? (
        <>
          {renderHeader()}
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No budgets for this month</Text>
            <Text style={styles.emptyHint}>
              Tap "+ Create New" above to get started
            </Text>
          </View>
        </>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => load(period.month, period.year)}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item, index }) => {
            const budgeted = parseFloat(item.amount || "0");
            const spent = parseFloat(item.spent || "0");
            const remaining = budgeted - spent;
            const pct = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
            const clampedPct = Math.min(pct, 100);
            const overBudget = spent > budgeted;
            const categoryName = item.category_name || "Uncategorized";
            const catColor = item.category_color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
            const iconBg = withOpacity(catColor, 0.2);
            const iconFg = catColor;

            return (
              <TouchableOpacity
                style={[progressBarStyles.container, styles.budgetCard]}
                onPress={() =>
                  router.push(
                    `/budget/${item.id}?month=${period.month}&year=${period.year}`
                  )
                }
                activeOpacity={0.7}
              >
                <View style={progressBarStyles.header}>
                  <View style={styles.labelRow}>
                    <TouchableOpacity
                      style={[styles.iconCircle, { backgroundColor: iconBg }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        openColorPicker(item.category_id, item.category_color);
                      }}
                      activeOpacity={0.6}
                    >
                      <MaterialCommunityIcons
                        name={getCategoryIcon(categoryName) as any}
                        size={22}
                        color={iconFg}
                      />
                    </TouchableOpacity>
                    <View>
                      <Text style={progressBarStyles.label}>{categoryName}</Text>
                      <Text style={[progressBarStyles.value, overBudget && styles.errorText]}>
                        {overBudget
                          ? `${formatCurrency(Math.floor(Math.abs(remaining)))} over`
                          : `${formatCurrency(Math.floor(remaining))} left`}
                        {" "}
                        <Text style={progressBarStyles.valueSub}>
                          of {formatCurrency(Math.floor(budgeted))}
                        </Text>
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rightActions}>
                    <TouchableOpacity
                      style={styles.viewTxnBtn}
                      hitSlop={HIT_SLOP_8}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(
                          `/budget-transactions?category_id=${item.category_id}&category_name=${encodeURIComponent(categoryName)}&budget_amount=${item.amount}&spent=${item.spent}&month=${period.month}&year=${period.year}`
                        );
                      }}
                    >
                      <MaterialCommunityIcons
                        name="format-list-bulleted"
                        size={20}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={progressBarStyles.track}>
                  <View
                    style={[
                      progressBarStyles.fill,
                      { width: `${clampedPct}%`, backgroundColor: catColor },
                      overBudget && { backgroundColor: colors.error },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={BudgetSeparator}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            error ? <Text style={styles.errorText}>{error}</Text> : null
          }
        />
      )}

      <ColorPickerModal
        visible={pickerVisible}
        currentColor={pickerCurrentColor}
        onSelect={handleColorSelect}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  monthArrow: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: "600",
  },
  monthLabel: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },

  // Hero Section
  heroSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  heroLabel: {
    fontSize: 12,
    fontFamily: fonts.labelMedium,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.secondary,
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 36,
    fontFamily: fonts.extraBold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },

  // Summary Progress Pill
  summaryPill: {
    marginTop: 24,
  },

  // Categories Header
  categoriesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  categoriesTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  createNewText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  // Budget Cards
  listContent: {
    paddingBottom: 24,
  },
  budgetCard: {
    marginHorizontal: 24,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  separator: {
    height: 16,
  },

  // Empty & Error
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  rightActions: {
    alignItems: "flex-end" as const,
    gap: 4,
  },
  viewTxnBtn: {
    padding: 4,
  },
});
