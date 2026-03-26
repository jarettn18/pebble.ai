import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  Animated,
  PanResponder,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBudgetsStore, type Budget } from "../../src/stores/budgets";
import { useBudgetPlansStore, type BudgetPlan } from "../../src/stores/budgetPlans";
import { useDashboardStore } from "../../src/stores/dashboard";
import { formatCurrency } from "../../src/utils/dashboard";
import { withOpacity } from "../../src/utils/color";
import { apiRequest } from "../../src/api/client";
import { colors, fonts, progressBarStyles } from "../../src/theme";
import { getCategoryIcon } from "../../src/utils/categoryIcons";
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

function CascadeRow({
  expanded,
  index,
  showTopBorder,
  children,
}: {
  expanded: boolean;
  index: number;
  showTopBorder?: boolean;
  children: React.ReactNode;
}) {
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    if (expanded) {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 250,
        delay: index * 65,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [expanded]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [-10, 0],
            }),
          },
        ],
        borderTopWidth: showTopBorder ? StyleSheet.hairlineWidth : 0,
        borderTopColor: showTopBorder ? colors.border : undefined,
      }}
    >
      {children}
    </Animated.View>
  );
}

const DELETE_BTN_WIDTH = 80;

function SwipeableRow({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -DELETE_BTN_WIDTH));
      },
      onPanResponderRelease: (_, g) => {
        const open = g.dx < -DELETE_BTN_WIDTH / 2;
        Animated.spring(translateX, {
          toValue: open ? -DELETE_BTN_WIDTH : 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      },
    })
  ).current;

  function close() {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }

  return (
    <View style={styles.swipeableContainer}>
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          close();
          onDelete();
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.error} />
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

interface PlanCardProps {
  plan: BudgetPlan;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onDelete: (plan: BudgetPlan) => void;
  onNavigate: (id: string) => void;
}

const PlanCard = memo(function PlanCard({
  plan: p,
  isExpanded,
  onToggle,
  onDelete,
  onNavigate,
}: PlanCardProps) {
  const allocTotal = p.allocations.reduce(
    (sum, a) => sum + parseFloat(a.amount), 0
  );
  const sortedAllocations = useMemo(
    () => [...p.allocations].sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)),
    [p.allocations]
  );
  return (
    <SwipeableRow onDelete={() => onDelete(p)}>
      <View style={styles.planCardExpanded}>
        <TouchableOpacity
          style={styles.planCardHeader}
          onPress={() => onNavigate(p.id)}
          activeOpacity={0.7}
        >
          <View style={styles.planCardLeft}>
            <Text style={styles.planCardName} numberOfLines={1}>
              {p.name || "Budget Plan"}
            </Text>
            <Text style={styles.planCardSub}>
              {formatCurrency(parseFloat(p.total_amount))}/mo
              {p.is_recurring && p.recurring_active ? "  \u00B7  Recurring" : ""}
              {p.is_recurring && !p.recurring_active ? "  \u00B7  Paused" : ""}
            </Text>
          </View>
          <TouchableOpacity
            hitSlop={HIT_SLOP_8}
            onPress={(e) => {
              e.stopPropagation();
              onToggle(p.id);
            }}
          >
            <MaterialCommunityIcons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={22}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.allocationsContainer}>
            {sortedAllocations.map((a, allocIdx) => {
              const catColor = a.category_color || colors.primary;
              const catName = a.category_name || "Unknown";

              return (
                <CascadeRow key={a.id} expanded={isExpanded} index={allocIdx} showTopBorder={allocIdx === 0}>
                  {allocIdx > 0 && <View style={styles.allocationSeparator} />}
                  <View style={styles.allocationRow}>
                    <View style={styles.allocationTappable}>
                      <View
                        style={[
                          styles.allocationIconCircle,
                          { backgroundColor: withOpacity(catColor, 0.2) },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={getCategoryIcon(catName) as any}
                          size={18}
                          color={catColor}
                        />
                      </View>
                      <Text style={styles.allocationName} numberOfLines={1}>
                        {catName}
                      </Text>
                    </View>
                    <Text style={styles.allocationAmount}>
                      {formatCurrency(parseFloat(a.amount))}
                    </Text>
                  </View>
                </CascadeRow>
              );
            })}

            <CascadeRow expanded={isExpanded} index={sortedAllocations.length}>
              <View style={styles.allocationTotalRow}>
                <Text style={styles.allocationTotalLabel}>
                  Allocated
                </Text>
                <Text style={styles.allocationTotalAmount}>
                  {formatCurrency(allocTotal)} of{" "}
                  {formatCurrency(parseFloat(p.total_amount))}
                </Text>
              </View>
            </CascadeRow>
          </View>
        )}
      </View>
    </SwipeableRow>
  );
});

export default function BudgetsScreen() {
  const router = useRouter();
  const { budgets, isLoading, error, load } = useBudgetsStore();
  const { plans, load: loadPlans } = useBudgetPlansStore();
  const refreshDashboard = useDashboardStore((s) => s.refresh);
  const [period, setPeriod] = useState(getCurrentMonth);

  // Color picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerCategoryId, setPickerCategoryId] = useState<string | null>(null);
  const [pickerCurrentColor, setPickerCurrentColor] = useState<string | null>(null);

  // Expandable plan state
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(new Set());

  // Sort order: only re-sort categories on focus/refresh, not inline edits
  const shouldResort = useRef(true);
  const categorySortOrder = useRef<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      shouldResort.current = true;
      load(period.month, period.year);
      loadPlans();
    }, [period.month, period.year])
  );

  function shiftMonth(delta: number) {
    shouldResort.current = true;
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

  // Aggregate budgets by category so multiple plans' allocations merge into one row
  const aggregatedBudgets = useMemo(() => {
    const map = new Map<string, Budget>();
    for (const b of budgets) {
      const existing = map.get(b.category_id);
      if (existing) {
        const mergedAmount = parseFloat(existing.amount || "0") + parseFloat(b.amount || "0");
        map.set(b.category_id, {
          ...existing,
          amount: mergedAmount.toFixed(2),
          // spent is per-category, not per-budget — keep the first value to avoid double-counting
        });
      } else {
        map.set(b.category_id, { ...b });
      }
    }

    const rows = Array.from(map.values());

    if (shouldResort.current) {
      // Sort by amount descending on focus/refresh
      rows.sort((a, b) => parseFloat(b.amount || "0") - parseFloat(a.amount || "0"));
      categorySortOrder.current = rows.map((r) => r.category_id);
      shouldResort.current = false;
    } else {
      // Preserve previous order, append any new categories at the end
      const order = categorySortOrder.current;
      rows.sort((a, b) => {
        const ai = order.indexOf(a.category_id);
        const bi = order.indexOf(b.category_id);
        return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
      });
    }

    return rows;
  }, [budgets]);

  const { totalBudgeted, totalSpent, budgetRemaining, budgetPct, isOverBudget } = useMemo(() => {
    // Use plan totals for the budgeted amount so it matches what the user set
    const budgeted = plans.length > 0
      ? plans.reduce((sum, p) => sum + parseFloat(p.total_amount || "0"), 0)
      : aggregatedBudgets.reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0);
    const spent = aggregatedBudgets.reduce((sum, b) => sum + parseFloat(b.spent || "0"), 0);
    return {
      totalBudgeted: budgeted,
      totalSpent: spent,
      budgetRemaining: budgeted - spent,
      budgetPct: budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0,
      isOverBudget: spent > budgeted,
    };
  }, [aggregatedBudgets, plans]);

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

  // Lookup spent per category for allocation rows
  const spentByCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of aggregatedBudgets) {
      map.set(b.category_id, b.spent);
    }
    return map;
  }, [aggregatedBudgets]);

  const togglePlanExpanded = useCallback((planId: string) => {
    setExpandedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  }, []);

  const handleNavigatePlan = useCallback((id: string) => {
    router.push(`/budget/plan/${id}`);
  }, [router]);

  function handleDeletePlan(plan: BudgetPlan) {
    Alert.alert(
      "Delete Budget Plan",
      "Do you also want to delete all budgets generated by this plan?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Keep Budgets",
          onPress: () => deletePlan(plan.id, false),
        },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: () => deletePlan(plan.id, true),
        },
      ]
    );
  }

  async function deletePlan(planId: string, deleteBudgets: boolean) {
    try {
      await apiRequest(
        `/v1/budget-plans/${planId}?delete_budgets=${deleteBudgets}`,
        { method: "DELETE" }
      );
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const { removePlan } = useBudgetPlansStore.getState();
      removePlan(planId);
      await Promise.all([
        load(period.month, period.year),
        refreshDashboard(),
      ]);
    } catch {
      // Silently fail
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
      {aggregatedBudgets.length > 0 && (
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
            <View style={[progressBarStyles.track, { flexDirection: "row", overflow: "hidden" }]}>
              {aggregatedBudgets.map((item, idx) => {
                const spent = parseFloat(item.spent || "0");
                if (spent <= 0) return null;
                const scale = isOverBudget ? totalBudgeted / totalSpent : 1;
                const widthPct = (spent / totalBudgeted) * 100 * scale;
                const catColor = isOverBudget
                  ? colors.error
                  : item.category_color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                return (
                  <View
                    key={item.category_id}
                    style={{
                      width: `${widthPct}%`,
                      height: "100%" as unknown as number,
                      backgroundColor: catColor,
                    }}
                  />
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Budget Plans */}
      {plans.length > 0 && (
        <View style={styles.plansSection}>
          <View style={styles.plansSectionHeader}>
            <Text style={styles.plansSectionTitle}>Budget Plans</Text>
            <TouchableOpacity
              onPress={() => router.push("/budget/create")}
              hitSlop={8}
            >
              <Text style={styles.createNewText}>+ Create New</Text>
            </TouchableOpacity>
          </View>
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              isExpanded={expandedPlanIds.has(p.id)}
              onToggle={togglePlanExpanded}
              onDelete={handleDeletePlan}
              onNavigate={handleNavigatePlan}
            />
          ))}
        </View>
      )}

      {/* Categories Header */}
      <View style={styles.categoriesHeader}>
        <Text style={styles.categoriesTitle}>Categories</Text>
      </View>
    </>
  ), [period, aggregatedBudgets, plans, expandedPlanIds, spentByCategory, totalSpent, totalBudgeted, budgetPct, budgetRemaining, isOverBudget, router]);

  return (
    <View style={styles.container}>
      {isLoading && aggregatedBudgets.length === 0 ? (
        <>
          {renderHeader()}
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </>
      ) : aggregatedBudgets.length === 0 ? (
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
          data={aggregatedBudgets}
          keyExtractor={(item) => item.category_id}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => {
                shouldResort.current = true;
                load(period.month, period.year);
              }}
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
                    `/budget-transactions?category_id=${item.category_id}&category_name=${encodeURIComponent(categoryName)}&category_color=${encodeURIComponent(item.category_color || '')}&budget_amount=${item.amount}&spent=${item.spent}&month=${period.month}&year=${period.year}`
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
                    <View style={styles.labelText}>
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
                  <TouchableOpacity
                    hitSlop={HIT_SLOP_8}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/budget-transactions?category_id=${item.category_id}&category_name=${encodeURIComponent(categoryName)}&category_color=${encodeURIComponent(item.category_color || '')}&budget_amount=${item.amount}&spent=${item.spent}&month=${period.month}&year=${period.year}`
                      );
                    }}
                  >
                    <MaterialCommunityIcons
                      name="format-list-bulleted"
                      size={22}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
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
          keyboardShouldPersistTaps="handled"
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

  // Plans Section
  plansSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  plansSectionHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  plansSectionTitle: {
    fontSize: 14,
    fontFamily: fonts.labelMedium,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 10,
  },
  swipeableContainer: {
    marginBottom: 8,
    overflow: "hidden",
    borderRadius: 12,
  },
  deleteAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_BTN_WIDTH,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: `${colors.border}4D`,
  },
  deleteActionText: {
    color: colors.error,
    fontSize: 12,
    fontFamily: fonts.semiBold,
    marginTop: 2,
  },
  planCardExpanded: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: "hidden",
  },
  planCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  planCardLeft: {
    flex: 1,
  },
  planCardName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  planCardSub: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  planCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  // Expanded allocation rows
  allocationsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  allocationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  allocationTappable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  allocationIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  allocationName: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  allocationSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  allocationAmount: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  allocationTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  allocationTotalLabel: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  allocationTotalAmount: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
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
    marginBottom: 5,
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
    flex: 1,
  },
  labelText: {
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
