import { useCallback, useState } from "react";
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
import { formatCurrency } from "../../src/utils/dashboard";
import { colors, borderRadius, shadows, fonts } from "../../src/theme";

function getCurrentMonth() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function monthLabel(month: number, year: number) {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Cycle through design-system accent backgrounds for category icon circles
const ICON_BG_COLORS = [
  colors.secondaryContainer,
  colors.primaryFixed,
  colors.tertiaryFixed,
  `${colors.secondaryContainer}80`, // 50% opacity
  `${colors.primaryFixed}99`, // 60% opacity
  `${colors.tertiaryFixed}66`, // 40% opacity
];

const ICON_FG_COLORS = [
  colors.secondary,
  colors.primary,
  colors.tertiary,
  colors.secondary,
  colors.primary,
  colors.tertiary,
];

// Progress bar colors cycle through primary/secondary/tertiary
const PROGRESS_COLORS = [
  colors.primary,
  colors.secondary,
  colors.primaryContainer,
  colors.tertiaryContainer,
  colors.primary,
  colors.secondary,
];

// Category icon mapping (MaterialCommunityIcons names)
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

export default function BudgetsScreen() {
  const router = useRouter();
  const { budgets, isLoading, error, load } = useBudgetsStore();
  const [period, setPeriod] = useState(getCurrentMonth);

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

  const totalBudgeted = budgets.reduce(
    (sum, b) => sum + parseFloat(b.amount || "0"),
    0
  );
  const totalSpent = budgets.reduce(
    (sum, b) => sum + parseFloat(b.spent || "0"),
    0
  );
  const budgetRemaining = totalBudgeted - totalSpent;
  const budgetPct =
    totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const isOverBudget = totalSpent > totalBudgeted;

  const renderHeader = () => (
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
          <View style={styles.summaryPill}>
            <View style={styles.summaryPillTop}>
              <View>
                <Text style={styles.summaryPillLabel}>Overall Budget</Text>
                <Text style={styles.summaryPillValue}>
                  {budgetPct}%{" "}
                  <Text style={styles.summaryPillValueSub}>
                    of {formatCurrency(totalBudgeted)}
                  </Text>
                </Text>
              </View>
              <View style={styles.summaryPillRight}>
                <Text
                  style={[
                    styles.summaryPillRemaining,
                    isOverBudget && styles.errorText,
                  ]}
                >
                  {isOverBudget ? "Over by " : ""}
                  {formatCurrency(Math.abs(budgetRemaining))}{" "}
                  {isOverBudget ? "" : "left"}
                </Text>
              </View>
            </View>
            <View style={styles.summaryProgressTrack}>
              <View
                style={[
                  styles.summaryProgressFill,
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
  );

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
            const progress = budgeted > 0 ? spent / budgeted : 0;
            const clampedProgress = Math.min(progress, 1);
            const overBudget = spent > budgeted;
            const categoryName = item.category_name || "Uncategorized";
            const iconBg = ICON_BG_COLORS[index % ICON_BG_COLORS.length];
            const iconFg = ICON_FG_COLORS[index % ICON_FG_COLORS.length];
            const progressColor = overBudget
              ? colors.error
              : PROGRESS_COLORS[index % PROGRESS_COLORS.length];

            return (
              <TouchableOpacity
                style={styles.budgetCard}
                onPress={() =>
                  router.push(
                    `/budget/${item.id}?month=${period.month}&year=${period.year}`
                  )
                }
                activeOpacity={0.7}
              >
                <View style={styles.budgetCardTop}>
                  <View style={styles.budgetCardLeft}>
                    <View
                      style={[styles.iconCircle, { backgroundColor: iconBg }]}
                    >
                      <MaterialCommunityIcons
                        name={getCategoryIcon(categoryName) as any}
                        size={22}
                        color={iconFg}
                      />
                    </View>
                    <View style={styles.budgetCardInfo}>
                      <Text style={styles.budgetCategoryName}>
                        {categoryName}
                      </Text>
                      <Text style={styles.budgetSpentLabel}>
                        {formatCurrency(spent)} spent
                      </Text>
                    </View>
                  </View>
                  <View style={styles.budgetAmountCol}>
                    {overBudget ? (
                      <>
                        <Text style={styles.overBudgetLabel}>Over budget</Text>
                        <Text style={styles.overBudgetAmount}>
                          -{formatCurrency(Math.abs(remaining))}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.remainingAmount}>
                          {formatCurrency(remaining)}
                        </Text>
                        <Text style={styles.remainingLabel}>REMAINING</Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${clampedProgress * 100}%`,
                        backgroundColor: progressColor,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            error ? <Text style={styles.errorText}>{error}</Text> : null
          }
        />
      )}
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
    padding: 20,
    backgroundColor: `${colors.primaryFixed}4D`, // 30% opacity
    borderRadius: borderRadius.lg,
  },
  summaryPillTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  summaryPillLabel: {
    fontSize: 11,
    fontFamily: fonts.labelMedium,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.onPrimaryFixedVariant,
    opacity: 0.7,
    marginBottom: 4,
  },
  summaryPillValue: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.onPrimaryFixedVariant,
  },
  summaryPillValueSub: {
    fontSize: 13,
    fontWeight: "400",
    opacity: 0.7,
  },
  summaryPillRight: {
    alignItems: "flex-end",
  },
  summaryPillRemaining: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.onPrimaryFixedVariant,
  },
  summaryProgressTrack: {
    height: 16,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderRadius: 9999,
  },
  summaryProgressFill: {
    height: "100%" as unknown as number,
    backgroundColor: colors.primary,
    borderRadius: 9999,
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`, // 10% opacity
    ...shadows.card,
  },
  budgetCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  budgetCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  budgetCardInfo: {
    flex: 1,
  },
  budgetCategoryName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  budgetSpentLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  budgetAmountCol: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  remainingAmount: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  remainingLabel: {
    fontSize: 9,
    fontFamily: fonts.labelMedium,
    color: `${colors.textSecondary}99`,
    letterSpacing: -0.3,
    textTransform: "uppercase",
    marginTop: 1,
  },
  overBudgetLabel: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.error,
  },
  overBudgetAmount: {
    fontSize: 9,
    fontFamily: fonts.labelMedium,
    color: `${colors.error}99`,
    letterSpacing: -0.3,
    textTransform: "uppercase",
    marginTop: 1,
  },

  // Progress Bar
  progressTrack: {
    height: 10,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 9999,
    overflow: "hidden" as const,
  },
  progressFill: {
    height: "100%" as unknown as number,
    borderRadius: 9999,
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
});
