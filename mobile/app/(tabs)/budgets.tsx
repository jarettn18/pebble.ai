import React, { useCallback, useMemo, useRef, useState, memo, useEffect } from "react";
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
import { withOpacity, getCategoryColor } from "../../src/utils/color";
import { apiRequest } from "../../src/api/client";
import { colors, fonts, heroCard, heroProgressBarStyles, borderRadius, shadows, microLabel, microLabelSmall, microLabelTiny } from "../../src/theme";
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

// Hoisted static component (6.3)
function BudgetSeparator() {
  return <View style={styles.separator} />;
}

// ─── CascadeRow ───────────────────────────────────────────────────────────────
// Animate on mount only when `animate` is true; otherwise render fully visible.
function CascadeRow({
  animate,
  index,
  showTopBorder,
  children,
}: {
  animate: boolean;
  index: number;
  showTopBorder?: boolean;
  children: React.ReactNode;
}) {
  const anim = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (animate) {
      Animated.timing(anim, {
        toValue: 1,
        duration: 250,
        delay: index * 65,
        useNativeDriver: true,
      }).start();
    }
  }, []);

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

// ─── SwipeableRow ─────────────────────────────────────────────────────────────
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

// ─── PlanCard ─────────────────────────────────────────────────────────────────
// 5.1: Derive animation state during render, not via effect
// 5.8: No state+effect pattern for expand — derive from prop transition
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
  // Derive animation flag during render (5.1)
  const prevExpanded = useRef(isExpanded);
  const shouldAnimate = isExpanded && !prevExpanded.current;
  // Update ref synchronously so next render sees current value
  prevExpanded.current = isExpanded;

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
            accessibilityLabel={isExpanded ? "Collapse plan" : "Expand plan"}
            accessibilityRole="button"
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
                <CascadeRow key={a.id} animate={shouldAnimate} index={allocIdx} showTopBorder={allocIdx === 0}>
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

            <CascadeRow animate={shouldAnimate} index={sortedAllocations.length}>
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

// ─── PlansSection ─────────────────────────────────────────────────────────────
// Extracted as own component so expanded state is isolated here (5.4, 5.6).
// This prevents PlanCard remounts when parent data (budgets, period) changes.
// Module-level ref so expanded state survives component remounts (tab focus)
let persistedExpandedIds = new Set<string>();
const EMPTY_BUDGETS: Budget[] = [];

interface PlansSectionProps {
  plans: BudgetPlan[];
}

const PlansSection = memo(function PlansSection({ plans }: PlansSectionProps) {
  const router = useRouter();
  // Initialize from persisted value; sync back on every change
  const [expandedPlanIds, setExpandedPlanIds] = useState(() => new Set(persistedExpandedIds));

  const togglePlanExpanded = useCallback((planId: string) => {
    setExpandedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      persistedExpandedIds = next;
      return next;
    });
  }, []);

  const handleNavigatePlan = useCallback((id: string) => {
    router.push(`/budget/plan/${id}`);
  }, [router]);

  const handleDeletePlan = useCallback((plan: BudgetPlan) => {
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
  }, []);

  async function deletePlan(planId: string, deleteBudgets: boolean) {
    try {
      await apiRequest(
        `/v1/budget-plans/${planId}?delete_budgets=${deleteBudgets}`,
        { method: "DELETE" }
      );
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const { removePlan } = useBudgetPlansStore.getState();
      removePlan(planId);
      const refreshDashboard = useDashboardStore.getState().refresh;
      const { load } = useBudgetsStore.getState();
      const now = new Date();
      await Promise.all([
        load(now.getMonth() + 1, now.getFullYear()),
        refreshDashboard(),
      ]);
    } catch (err) {
      if (__DEV__) console.warn("Failed to delete plan:", err);
    }
  }

  if (plans.length === 0) {
    return (
      <View style={styles.plansSection}>
        <View style={styles.plansSectionHeader}>
          <Text style={styles.plansSectionTitle}>Budget Plans</Text>
        </View>
        <TouchableOpacity
          style={styles.emptyPlanCard}
          onPress={() => router.push("/budget/create")}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Create your first budget plan"
        >
          <View style={styles.emptyPlanGlow} />
          <View style={styles.emptyPlanIcon}>
            <MaterialCommunityIcons name="cash-multiple" size={24} color={colors.accent} />
          </View>
          <Text style={styles.emptyPlanEyebrow}>READY TO BUDGET?</Text>
          <Text style={styles.emptyPlanText}>Create your first plan</Text>
          <Text style={styles.emptyPlanHint}>
            Allocate your monthly income across categories and let Pebble track the rest.
          </Text>
          <View style={styles.emptyPlanButton}>
            <Text style={styles.emptyPlanButtonText}>+ Create New Plan</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
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
  );
});

// ─── BudgetCategoryRow ────────────────────────────────────────────────────────
// Extracted from inline renderItem (5.4) into top-level memoized component (5.6)
interface BudgetCategoryRowProps {
  item: Budget;
  index: number;
  period: { month: number; year: number };
  onColorPick: (categoryId: string, currentColor: string | null) => void;
}

const BudgetCategoryRow = memo(function BudgetCategoryRow({
  item,
  index,
  period,
  onColorPick,
}: BudgetCategoryRowProps) {
  const router = useRouter();
  const budgeted = parseFloat(item.amount || "0");
  const spent = parseFloat(item.spent || "0");
  const remaining = budgeted - spent;
  const pct = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
  const clampedPct = Math.min(pct, 100);
  const overBudget = spent > budgeted;
  const categoryName = item.category_name || "Uncategorized";
  const catColor = getCategoryColor(item.category_color, FALLBACK_COLORS, index);
  const iconBg = withOpacity(catColor, 0.2);

  const transactionUrl = `/budget-transactions?category_id=${item.category_id}&category_name=${encodeURIComponent(categoryName)}&category_color=${encodeURIComponent(item.category_color || '')}&budget_amount=${item.amount}&spent=${item.spent}&month=${period.month}&year=${period.year}`;

  return (
    <TouchableOpacity
      style={[styles.budgetCard, { borderColor: withOpacity(catColor, 0.22) }]}
      onPress={() => router.push(transactionUrl)}
      activeOpacity={0.85}
    >
      <View
        style={[
          styles.budgetCardGlow,
          { backgroundColor: withOpacity(catColor, 0.18) },
        ]}
      />
      <View style={styles.budgetCardHeader}>
        <TouchableOpacity
          style={[styles.iconCircle, { backgroundColor: iconBg }]}
          onPress={(e) => {
            e.stopPropagation();
            onColorPick(item.category_id, item.category_color);
          }}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons
            name={getCategoryIcon(categoryName) as any}
            size={22}
            color={catColor}
          />
        </TouchableOpacity>
        <View style={styles.budgetCardMid}>
          <Text style={styles.budgetCardName} numberOfLines={1}>
            {categoryName}
          </Text>
          <Text style={styles.budgetCardSub}>
            {formatCurrency(Math.floor(spent))} of {formatCurrency(Math.floor(budgeted))}
          </Text>
        </View>
        <View style={styles.budgetCardRight}>
          <Text
            style={[
              styles.budgetCardRemaining,
              overBudget && styles.budgetCardRemainingOver,
            ]}
          >
            {overBudget
              ? `-${formatCurrency(Math.floor(Math.abs(remaining)))}`
              : formatCurrency(Math.floor(remaining))}
          </Text>
          <Text
            style={[
              styles.budgetCardRemainingLabel,
              overBudget && styles.budgetCardRemainingOverLabel,
            ]}
          >
            {overBudget ? "over" : "left"}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.budgetCardTrack,
          { backgroundColor: withOpacity(catColor, 0.14) },
        ]}
      >
        <View
          style={[
            styles.budgetCardFill,
            { width: `${clampedPct}%`, backgroundColor: catColor },
            overBudget && { backgroundColor: colors.error },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
});

// ─── BudgetsScreen ────────────────────────────────────────────────────────────
export default function BudgetsScreen() {
  const router = useRouter();
  const { budgets, isLoading, error, load } = useBudgetsStore();
  const { plans, load: loadPlans } = useBudgetPlansStore();
  const refreshDashboard = useDashboardStore((s) => s.refresh);
  // Lazy state initialization (5.12)
  const [period, setPeriod] = useState(getCurrentMonth);

  // Color picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerCategoryId, setPickerCategoryId] = useState<string | null>(null);
  const [pickerCurrentColor, setPickerCurrentColor] = useState<string | null>(null);

  // Sort order: only re-sort categories on focus/refresh, not inline edits (5.15)
  const shouldResort = useRef(true);
  const categorySortOrder = useRef<string[]>([]);

  // Narrow dependencies: use primitives (5.7)
  useFocusEffect(
    useCallback(() => {
      shouldResort.current = true;
      load(period.month, period.year);
      loadPlans(period.month, period.year);
    }, [period.month, period.year])
  );

  // Functional setState (5.11)
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

  // Aggregate budgets by category — single iteration (7.6)
  const aggregatedBudgets = useMemo(() => {
    const map = new Map<string, Budget>();
    for (const b of budgets) {
      const existing = map.get(b.category_id);
      if (existing) {
        const mergedAmount = parseFloat(existing.amount || "0") + parseFloat(b.amount || "0");
        map.set(b.category_id, {
          ...existing,
          amount: mergedAmount.toFixed(2),
        });
      } else {
        map.set(b.category_id, { ...b });
      }
    }

    const rows = Array.from(map.values());

    if (shouldResort.current) {
      rows.sort((a, b) => parseFloat(b.amount || "0") - parseFloat(a.amount || "0"));
      categorySortOrder.current = rows.map((r) => r.category_id);
      shouldResort.current = false;
    } else {
      // Use Map for O(1) lookups (7.12)
      const orderMap = new Map(categorySortOrder.current.map((id, i) => [id, i]));
      const len = orderMap.size;
      rows.sort((a, b) => {
        const ai = orderMap.get(a.category_id) ?? len;
        const bi = orderMap.get(b.category_id) ?? len;
        return ai - bi;
      });
    }

    return rows;
  }, [budgets]);

  // Derive budget totals — no useMemo needed for simple primitives (5.3),
  // but the reduce iterations justify memoization here
  const { totalBudgeted, totalSpent, budgetRemaining, budgetPct, isOverBudget } = useMemo(() => {
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

  // Put interaction logic in event handlers (5.8)
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
      await Promise.all([
        load(period.month, period.year),
        refreshDashboard(),
      ]);
    } catch (err) {
      if (__DEV__) console.warn("Failed to update category color:", err);
    }
  }

  // renderHeader no longer depends on expandedPlanIds — PlansSection manages that
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
          <View style={styles.heroCard}>
            <View style={styles.heroCardGlow} />
            <Text style={styles.heroCardLabel}>SPENDING CATEGORIES</Text>
            <Text style={styles.heroCardAmount}>{formatCurrency(totalSpent)}</Text>
            <Text style={styles.heroCardSubtitle}>Total monthly spend so far</Text>

            {/* Summary Progress Pill — nested translucent */}
            <View style={heroProgressBarStyles.container}>
              <View style={heroProgressBarStyles.header}>
                <View>
                  <Text style={heroProgressBarStyles.label}>Overall Budget</Text>
                  <Text style={heroProgressBarStyles.value}>
                    {budgetPct}%{" "}
                    <Text style={heroProgressBarStyles.valueSub}>
                      of {formatCurrency(totalBudgeted)}
                    </Text>
                  </Text>
                </View>
                <Text
                  style={[
                    heroProgressBarStyles.remaining,
                    isOverBudget && styles.heroOverText,
                  ]}
                >
                  {isOverBudget ? "Over by " : ""}
                  {formatCurrency(Math.abs(budgetRemaining))}{" "}
                  {isOverBudget ? "" : "left"}
                </Text>
              </View>
              <View style={[heroProgressBarStyles.track, { flexDirection: "row" }]}>
                {aggregatedBudgets.map((item, idx) => {
                  const spent = parseFloat(item.spent || "0");
                  if (spent <= 0) return null;
                  const scale = isOverBudget ? totalBudgeted / totalSpent : 1;
                  const widthPct = (spent / totalBudgeted) * 100 * scale;
                  const catColor = isOverBudget
                    ? colors.heroNegative
                    : getCategoryColor(item.category_color, FALLBACK_COLORS, idx);
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
        </View>
      )}

      <PlansSection plans={plans} />

      {plans.length > 0 && (
        <View style={styles.categoriesHeader}>
          <Text style={styles.categoriesTitle}>Categories</Text>
        </View>
      )}
    </>
  ), [period, aggregatedBudgets, plans, totalSpent, totalBudgeted, budgetPct, budgetRemaining, isOverBudget, router]);

  const renderItem = useCallback(({ item, index }: { item: Budget; index: number }) => (
    <BudgetCategoryRow
      item={item}
      index={index}
      period={period}
      onColorPick={openColorPicker}
    />
  ), [period]);

  const keyExtractor = useCallback((item: Budget) => item.category_id, []);

  const refreshControl = useMemo(() => (
    <RefreshControl
      refreshing={isLoading}
      onRefresh={() => {
        shouldResort.current = true;
        load(period.month, period.year);
      }}
      tintColor={colors.accent}
    />
  ), [isLoading, period.month, period.year]);

  const footerComponent = error ? <Text style={styles.errorText}>{error}</Text> : null;

  return (
    <View style={styles.container}>
      {isLoading && aggregatedBudgets.length === 0 ? (
        <>
          {renderHeader()}
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
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
          data={plans.length > 0 ? aggregatedBudgets : EMPTY_BUDGETS}
          keyExtractor={keyExtractor}
          ListHeaderComponent={renderHeader}
          refreshControl={refreshControl}
          renderItem={renderItem}
          ItemSeparatorComponent={BudgetSeparator}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={footerComponent}
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
    color: colors.accent,
    fontFamily: fonts.semiBold,
  },
  monthLabel: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.heroSurface,
    letterSpacing: -0.3,
  },

  // Hero Section — dark hero card with nested progress pill
  heroSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  heroCard: {
    ...heroCard.surface,
  },
  heroCardGlow: heroCard.glow,
  heroCardLabel: heroCard.label,
  heroCardAmount: {
    fontSize: 40,
    fontFamily: fonts.extraBold,
    color: colors.heroTextPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroCardSubtitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.heroTextSecondary,
  },
  heroOverText: {
    color: colors.heroNegative,
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
    ...microLabel,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  swipeableContainer: {
    marginBottom: 8,
    overflow: "hidden",
    borderRadius: borderRadius.md,
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
    borderTopRightRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
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
    borderRadius: borderRadius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
    ...shadows.card,
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
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  planCardSub: {
    fontSize: 13,
    fontFamily: fonts.medium,
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
    color: colors.accentDark,
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
    color: colors.heroSurface,
    letterSpacing: -0.3,
  },
  createNewText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.accent,
    marginBottom: 5,
  },
  emptyPlanCard: {
    ...heroCard.surface,
    alignItems: "center" as const,
    padding: 28,
  },
  emptyPlanGlow: heroCard.glow,
  emptyPlanIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  emptyPlanEyebrow: {
    ...microLabelSmall,
    color: colors.heroLabel,
    marginBottom: 8,
  },
  emptyPlanText: {
    fontSize: 22,
    fontFamily: fonts.extraBold,
    color: colors.heroTextPrimary,
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center" as const,
  },
  emptyPlanHint: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.heroTextSecondary,
    textAlign: "center" as const,
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 280,
  },
  emptyPlanButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  emptyPlanButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.heroSurface,
    letterSpacing: 0.2,
  },

  // Budget Cards — secondary hero treatment
  listContent: {
    paddingBottom: 24,
  },
  budgetCard: {
    position: "relative" as const,
    overflow: "hidden" as const,
    marginHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    ...shadows.card,
  },
  budgetCardGlow: {
    position: "absolute" as const,
    top: -60,
    right: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  budgetCardHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 14,
  },
  budgetCardMid: {
    flex: 1,
    marginRight: 12,
  },
  budgetCardName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.heroSurface,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  budgetCardSub: {
    fontSize: 12,
    fontFamily: fonts.labelMedium,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  budgetCardRight: {
    alignItems: "flex-end" as const,
  },
  budgetCardRemaining: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: colors.heroSurface,
    letterSpacing: -0.3,
  },
  budgetCardRemainingOver: {
    color: colors.error,
  },
  budgetCardRemainingLabel: {
    ...microLabelTiny,
    color: colors.textMuted,
    marginTop: 2,
  },
  budgetCardRemainingOverLabel: {
    color: colors.error,
  },
  budgetCardTrack: {
    height: 10,
    borderRadius: borderRadius.pill,
    overflow: "hidden" as const,
  },
  budgetCardFill: {
    height: "100%" as unknown as number,
    borderRadius: borderRadius.pill,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  separator: {
    height: 12,
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
    fontFamily: fonts.semiBold,
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
