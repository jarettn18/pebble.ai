import { useState, useEffect, useCallback, useMemo, memo } from "react";
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
  Pressable,
  LayoutAnimation,
} from "react-native";
import { useFocusEffect, useRouter, useNavigation } from "expo-router";
import type { AssetSummary } from "../../src/stores/dashboard";
import { useAuthStore } from "../../src/stores/auth";
import { useDashboardStore } from "../../src/stores/dashboard";
import { useAccountsStore } from "../../src/stores/accounts";
import { useTransactionsStore } from "../../src/stores/transactions";
import { usePlaidLink } from "../../src/hooks/usePlaidLink";
import { apiRequest } from "../../src/api/client";
import { formatCurrency } from "../../src/utils/dashboard";
import { exportTransactions } from "../../src/utils/exportTransactions";
import PieChart from "../../src/components/PieChart";
import NetWorthChart from "../../src/components/NetWorthChart";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBudgetPlansStore } from "../../src/stores/budgetPlans";
import { useHealthScoreStore } from "../../src/stores/healthScore";
import { colors, borderRadius, shadows, fonts, progressBarStyles, heroCard } from "../../src/theme";
import { getCategoryColor } from "../../src/utils/color";

const PIE_COLORS = colors.spendingPalette;
const INCOME_COLORS = colors.incomePalette;

const HIT_SLOP_8 = { top: 8, bottom: 8, left: 8, right: 8 };

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  depository: "Bank",
  credit: "Credit Card",
  loan: "Loan",
  investment: "Investment",
};


const ASSET_TYPE_LABELS: Record<string, string> = {
  primary_residence: "Primary Residence",
  rental: "Rental",
  investment_property: "Investment Property",
  vacation: "Vacation",
  land: "Land",
  car: "Car",
  motorcycle: "Motorcycle",
  boat: "Boat",
  other: "Other",
};

const ASSET_TYPE_ICONS: Record<string, string> = {
  primary_residence: "home-outline",
  rental: "home-city-outline",
  investment_property: "office-building-outline",
  vacation: "palm-tree",
  land: "terrain",
  car: "car-outline",
  motorcycle: "motorbike",
  boat: "sail-boat",
  other: "package-variant-closed",
};


function gradeColor(grade: string | null): string {
  switch (grade) {
    case "A": return colors.gradeADark;
    case "B": return colors.gradeBDark;
    case "C": return colors.gradeCDark;
    case "D": return colors.gradeDDark;
    default: return colors.gradeFDark;
  }
}

const HealthScoreCard = memo(function HealthScoreCard({
  score,
  grade,
  completeness,
}: {
  score: number;
  grade: string;
  completeness: number;
}) {
  const router = useRouter();
  const color = gradeColor(grade);
  return (
    <TouchableOpacity
      style={[styles.heroCard, styles.healthScoreCard]}
      onPress={() => router.push("/health-score")}
      activeOpacity={0.85}
      accessibilityLabel={`Financial health score ${score}, grade ${grade}`}
      accessibilityRole="button"
    >
      <View style={styles.heroCardGlow} />
      <View style={styles.healthScoreLeft}>
        <Text style={styles.heroCardLabel}>FINANCIAL HEALTH</Text>
        <Text style={styles.healthScoreDetail}>
          {completeness < 1
            ? `Based on ${Math.round(completeness * 100)}% of data`
            : "Tap to see full breakdown"}
        </Text>
      </View>
      <View style={styles.healthScoreRight}>
        <View style={[styles.healthScorePill, { backgroundColor: `${color}33`, borderColor: `${color}99` }]}>
          <Text style={[styles.healthScoreValue, { color }]}>{score}</Text>
          <Text style={[styles.healthScoreGrade, { color }]}>{grade}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

function AssetRow({ asset, onPress }: { asset: AssetSummary; onPress: () => void }) {
  const value = parseFloat(asset.estimated_value);
  const typeLabel = ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type;
  const iconName = ASSET_TYPE_ICONS[asset.asset_type] ?? "package-variant-closed";

  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.itemCardRow}>
        <View style={styles.itemCardLeft}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
            <MaterialCommunityIcons name={iconName as any} size={22} color={colors.accentDark} />
          </View>
          <View style={styles.itemCardInfo}>
            <Text style={styles.itemCardName} numberOfLines={1}>{asset.name}</Text>
            <Text style={styles.itemCardSub}>{typeLabel}</Text>
          </View>
        </View>
        <View style={styles.itemCardRight}>
          <Text style={styles.itemCardAmount}>{formatCurrency(value)}</Text>
          <Text style={styles.itemCardLabel}>VALUE</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const [exchanging, setExchanging] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  const {
    netWorth,
    monthlySpending,
    monthlyIncome,
    refreshCount,
    accounts,
    assets,
    budgetSummaries,
    spendingByCategory,
    incomeByCategory,
    isLoading: dashLoading,
    load: loadDashboard,
    refresh: refreshDashboard,
  } = useDashboardStore();

  const { plans } = useBudgetPlansStore();
  const {
    overallScore: healthScore,
    grade: healthGrade,
    dataCompleteness: healthCompleteness,
    isLoading: healthLoading,
    load: loadHealthScore,
  } = useHealthScoreStore();
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const syncTransactions = useTransactionsStore((s) => s.syncAndRefresh);

  const { error, linkResult, openLink, clearResult } =
    usePlaidLink();

  // Refresh balances (if stale) and reload dashboard on tab focus
  useFocusEffect(
    useCallback(() => {
      // Refresh dashboard data (picks up color changes, new transactions, etc.)
      loadDashboard(undefined, undefined, true);
      // Load health score in background
      loadHealthScore();
      // Refresh Plaid balances in background (doesn't block render)
      apiRequest("/v1/plaid/refresh-balances", { method: "POST" }).catch((err) => {
        if (__DEV__) console.warn("Balance refresh failed:", err);
      });
    }, [])
  );

  // Set header right button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerAddButton}
          onPress={() => setShowAddMenu((v) => !v)}
          activeOpacity={0.7}
          accessibilityLabel="Add account or asset"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="plus" size={22} color={colors.accent} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

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
          await Promise.all([
            refreshAccounts(),
            syncTransactions(),
            refreshDashboard(),
            loadHealthScore(),
          ]);
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

  const { totalBudgeted, totalSpent, budgetRemaining, budgetPct, isOverBudget } = useMemo(() => {
    const budgeted = plans.length > 0
      ? plans.reduce((sum, p) => sum + parseFloat(p.total_amount || "0"), 0)
      : budgetSummaries.reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0);
    const spent = budgetSummaries.reduce((sum, b) => sum + parseFloat(b.spent || "0"), 0);
    return {
      totalBudgeted: budgeted,
      totalSpent: spent,
      budgetRemaining: budgeted - spent,
      budgetPct: budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0,
      isOverBudget: spent > budgeted,
    };
  }, [budgetSummaries, plans]);

  // Deduplicate budget summaries by category and use plan allocation amounts
  const mergedBudgetSummaries = useMemo(() => {
    // Aggregate by category_id: sum amounts and spent, keep first entry's metadata
    const map = new Map<string, typeof budgetSummaries[number]>();
    for (const b of budgetSummaries) {
      const existing = map.get(b.category_id);
      if (existing) {
        map.set(b.category_id, {
          ...existing,
          amount: (parseFloat(existing.amount || "0") + parseFloat(b.amount || "0")).toFixed(2),
          spent: (parseFloat(existing.spent || "0") + parseFloat(b.spent || "0")).toFixed(2),
        });
      } else {
        map.set(b.category_id, { ...b });
      }
    }

    // Override amounts with plan allocation totals when plans exist
    if (plans.length > 0) {
      const allocByCategory = new Map<string, number>();
      for (const p of plans) {
        for (const a of p.allocations) {
          allocByCategory.set(a.category_id, (allocByCategory.get(a.category_id) || 0) + parseFloat(a.amount || "0"));
        }
      }
      for (const [catId, amount] of allocByCategory) {
        const entry = map.get(catId);
        if (entry) {
          map.set(catId, { ...entry, amount: amount.toFixed(2) });
        }
      }
    }

    return Array.from(map.values());
  }, [budgetSummaries, plans]);

  const incomeSlices = useMemo(
    () => incomeByCategory.map((cat, i) => ({
      label: cat.category_name,
      value: parseFloat(cat.amount),
      color: getCategoryColor(cat.category_color, INCOME_COLORS, i),
    })),
    [incomeByCategory],
  );

  const spendingSlices = useMemo(
    () => spendingByCategory.map((cat, i) => ({
      label: cat.category_name,
      value: parseFloat(cat.amount),
      color: getCategoryColor(cat.category_color, PIE_COLORS, i),
    })),
    [spendingByCategory],
  );

  const hasAccounts = accounts.length > 0 || assets.length > 0;
  const [carouselPage, setCarouselPage] = useState(0);
  const [budgetExpanded, setBudgetExpanded] = useState(false);
  const cardWidth = Dimensions.get("window").width - 40;

  const onCarouselScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 12));
    setCarouselPage(page);
  }, [cardWidth]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={dashLoading}
            onRefresh={refreshDashboard}
            tintColor={colors.accent}
          />
        }
      >
        <Text style={styles.greeting}>
          Hello, {user?.full_name?.split(" ")[0] ?? "there"}
        </Text>
        <Text style={styles.subtitle}>Your financial overview</Text>

        {/* Onboarding popup — shown when no accounts or assets */}

      <View style={[styles.heroCard, styles.heroCardSpaced]}>
        <View style={styles.heroCardGlow} />
        <Text style={styles.heroCardLabel}>YOUR NETWORTH</Text>
        {dashLoading && !hasAccounts ? (
          <ActivityIndicator size="small" color={colors.accent} style={styles.cardLoader} />
        ) : (
          <Text
            style={[
              styles.heroCardValueXL,
              netWorth !== null && netWorth < 0 && styles.heroCardValueNegative,
            ]}
          >
            {netWorth !== null ? formatCurrency(netWorth) : "--"}
          </Text>
        )}
        {hasAccounts && <NetWorthChart refreshKey={refreshCount} variant="dark" />}
        {!hasAccounts && !dashLoading && (
          <Text style={styles.heroCardHint}>Connect a bank account to get started</Text>
        )}
      </View>

      <View style={styles.carouselWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToOffsets={[0, cardWidth + 12]}
          snapToEnd={true}
          decelerationRate="fast"
          disableIntervalMomentum
          onMomentumScrollEnd={onCarouselScroll}
          contentContainerStyle={styles.carouselContent}
        >
          <TouchableOpacity
            style={[styles.heroCard, styles.carouselCard, { width: cardWidth }]}
            onPress={() => router.push("/income")}
            activeOpacity={0.85}
          >
            <View style={styles.heroCardGlow} />
            <Text style={styles.heroCardLabel}>THIS MONTH'S INCOME</Text>
            {dashLoading && !hasAccounts ? (
              <ActivityIndicator size="small" color={colors.accent} style={styles.cardLoader} />
            ) : (
              <Text style={[styles.heroCardValue, styles.heroIncomeValue]}>
                {hasAccounts ? formatCurrency(monthlyIncome) : "--"}
              </Text>
            )}
            {incomeSlices.length > 0 && (
              <PieChart slices={incomeSlices} variant="dark" />
            )}
            {hasAccounts && (
              <Text style={styles.heroCardLink}>View details →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.heroCard, styles.carouselCard, styles.carouselCardLast, { width: cardWidth }]}
            onPress={() => router.push("/spending")}
            activeOpacity={0.85}
          >
            <View style={styles.heroCardGlow} />
            <Text style={styles.heroCardLabel}>THIS MONTH'S SPENDING</Text>
            {dashLoading && !hasAccounts ? (
              <ActivityIndicator size="small" color={colors.accent} style={styles.cardLoader} />
            ) : (
              <Text style={styles.heroCardValue}>
                {hasAccounts ? formatCurrency(monthlySpending) : "--"}
              </Text>
            )}
            {spendingSlices.length > 0 && (
              <PieChart slices={spendingSlices} variant="dark" />
            )}
            {hasAccounts && (
              <Text style={styles.heroCardLink}>View details →</Text>
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



      {/* Budget Summary — Overall Budget Pill */}
      {budgetSummaries.length > 0 && (
        <View style={[progressBarStyles.container, styles.budgetPillMargin]}>
          <Pressable
            onPress={budgetExpanded ? () => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setBudgetExpanded(false);
            } : undefined}
          >
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
            <Text style={[progressBarStyles.remaining, isOverBudget && styles.negative]}>
              {isOverBudget ? "Over by " : ""}{formatCurrency(Math.abs(budgetRemaining))}{isOverBudget ? "" : " left"}
            </Text>
          </View>
          <View style={[progressBarStyles.track, { flexDirection: "row", overflow: "hidden" }]}>
            {mergedBudgetSummaries.map((item, idx) => {
              const spent = parseFloat(item.spent || "0");
              if (spent <= 0) return null;
              const scale = isOverBudget ? totalBudgeted / totalSpent : 1;
              const widthPct = (spent / totalBudgeted) * 100 * scale;
              const catColor = isOverBudget
                ? colors.error
                : getCategoryColor(item.category_color, PIE_COLORS, idx);
              return (
                <View
                  key={`${item.category_id}-${idx}`}
                  style={{
                    width: `${widthPct}%`,
                    height: "100%" as unknown as number,
                    backgroundColor: catColor,
                  }}
                />
              );
            })}
          </View>
          </Pressable>

          {/* Expanded category breakdown */}
          {budgetExpanded && mergedBudgetSummaries.map((b, bIdx) => {
            const catBudgeted = parseFloat(b.amount || "0");
            const catSpent = parseFloat(b.spent || "0");
            const catRemaining = catBudgeted - catSpent;
            const catPct = catBudgeted > 0 ? Math.round((catSpent / catBudgeted) * 100) : 0;
            const catOver = catSpent > catBudgeted;
            const now = new Date();
            return (
              <TouchableOpacity
                key={`${b.category_id}-${bIdx}`}
                style={styles.budgetCategoryRow}
                activeOpacity={0.7}
                onPress={() =>
                  router.push(
                    `/budget-transactions?category_id=${b.category_id}&category_name=${encodeURIComponent(b.category_name || "Uncategorized")}&category_color=${encodeURIComponent(b.category_color || '')}&budget_amount=${b.amount}&spent=${b.spent}&month=${now.getMonth() + 1}&year=${now.getFullYear()}`
                  )
                }
              >
                <View style={[progressBarStyles.header, styles.budgetCategoryHeader]}>
                  <Text style={styles.budgetCategoryName}>
                    {b.category_name || "Uncategorized"}
                  </Text>
                  <TouchableOpacity
                    style={styles.viewTxnBtn}
                    hitSlop={HIT_SLOP_8}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/budget-transactions?category_id=${b.category_id}&category_name=${encodeURIComponent(b.category_name || "Uncategorized")}&category_color=${encodeURIComponent(b.category_color || '')}&budget_amount=${b.amount}&spent=${b.spent}&month=${now.getMonth() + 1}&year=${now.getFullYear()}`
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
                <View style={progressBarStyles.track}>
                  <View
                    style={[
                      progressBarStyles.fill,
                      { width: `${Math.min(catPct, 100)}%` },
                      b.category_color ? { backgroundColor: b.category_color } : undefined,
                      catOver && { backgroundColor: colors.error },
                    ]}
                  />
                </View>
                <Text style={[styles.budgetCategorySpent, catOver && styles.negative]}>
                  {catOver
                    ? `${formatCurrency(Math.floor(Math.abs(catRemaining)))} over`
                    : `${formatCurrency(Math.floor(catRemaining))} left`}
                  {" "}
                  <Text style={styles.budgetCategorySpentSub}>
                    of {formatCurrency(Math.floor(catBudgeted))}
                  </Text>
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Chevron toggle */}
          <TouchableOpacity
            style={styles.budgetChevron}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setBudgetExpanded((prev) => !prev);
            }}
            hitSlop={12}
            accessibilityLabel={budgetExpanded ? "Collapse budget details" : "Expand budget details"}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name={budgetExpanded ? "chevron-up" : "chevron-down"}
              size={24}
              color={colors.accent}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Health Score Card */}
      {healthScore !== null && (
        <HealthScoreCard
          score={healthScore}
          grade={healthGrade ?? "F"}
          completeness={healthCompleteness}
        />
      )}

      {/* Accounts */}
      {accounts.length > 0 && (
        <View style={[styles.heroCard, styles.accountsWidget]}>
          <View style={styles.heroCardGlow} />
          {/* Decorative background icon */}
          <View style={styles.accountsWidgetDecor}>
            <MaterialCommunityIcons name="wallet-outline" size={140} color={colors.heroTextPrimary} />
          </View>
          <View style={styles.accountsWidgetTitleRow}>
            <Text style={styles.accountsWidgetTitle}>My Accounts</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/transactions")}
              activeOpacity={0.7}
              hitSlop={HIT_SLOP_8}
            >
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.accountsWidgetList}>
            {accounts.map((acct, index) => (
              <TouchableOpacity
                key={acct.id}
                style={[
                  styles.accountsWidgetRow,
                  index < accounts.length - 1 && styles.accountsWidgetRowBorder,
                ]}
                onPress={() => router.push(`/account-transactions?account_id=${acct.id}&account_name=${encodeURIComponent(acct.name)}&balance_current=${acct.balance_current || ""}&account_type=${acct.type}&institution_name=${encodeURIComponent(acct.institution_name || "")}`)}
                activeOpacity={0.7}
              >
                <View style={styles.accountsWidgetLeft}>
                  <Text style={styles.accountsWidgetSub}>
                    {acct.institution_name ?? ACCOUNT_TYPE_LABELS[acct.type] ?? acct.type}
                  </Text>
                  <Text style={styles.accountsWidgetName} numberOfLines={1} ellipsizeMode="tail">{acct.name}</Text>
                </View>
                {acct.balance_current && (
                  <Text style={[
                    styles.accountsWidgetBalance,
                    (acct.type === "credit" || acct.type === "loan") && styles.accountsWidgetBalanceDebt,
                  ]}>
                    {(acct.type === "credit" || acct.type === "loan") ? "-" : ""}
                    {formatCurrency(parseFloat(acct.balance_current))}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Assets */}
      {assets.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Assets</Text>
          {assets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              onPress={() => router.push(`/asset/${asset.id}`)}
            />
          ))}
        </>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </ScrollView>

      {/* Dropdown menu */}
      {/* Onboarding popup */}
      {!hasAccounts && !dashLoading && showOnboarding && (
        <>
          <Pressable style={styles.onboardingOverlay} onPress={() => setShowOnboarding(false)} />
          <View style={styles.onboardingPopup}>
            <View style={styles.onboardingTail} />
            <TouchableOpacity
              style={styles.onboardingClose}
              onPress={() => setShowOnboarding(false)}
              hitSlop={12}
              accessibilityLabel="Dismiss onboarding"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.onboardingTitle}>Get Started</Text>
            <Text style={styles.onboardingText}>
              Tap the <Text style={styles.onboardingBold}>+</Text> button to add an account
            </Text>
          </View>
        </>
      )}

      {showAddMenu && (
        <>
          <Pressable style={styles.addMenuOverlay} onPress={() => setShowAddMenu(false)} />
          <View style={styles.addMenu}>
            <TouchableOpacity
              style={styles.addMenuItem}
              onPress={() => {
                setShowAddMenu(false);
                openLink();
              }}
              activeOpacity={0.7}
              accessibilityLabel="Add bank account"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="bank-outline" size={20} color={colors.accent} />
              <Text style={styles.addMenuText}>Add Account</Text>
            </TouchableOpacity>
            <View style={styles.addMenuDivider} />
            <TouchableOpacity
              style={styles.addMenuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push("/add-asset");
              }}
              activeOpacity={0.7}
              accessibilityLabel="Add property or vehicle"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="home-outline" size={20} color={colors.accent} />
              <Text style={styles.addMenuText}>Add Property or Vehicle</Text>
            </TouchableOpacity>
            <View style={styles.addMenuDivider} />
            <TouchableOpacity
              style={styles.addMenuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push("/import-csv");
              }}
              activeOpacity={0.7}
              accessibilityLabel="Import transactions from CSV"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="file-upload-outline" size={20} color={colors.accent} />
              <Text style={styles.addMenuText}>Import Transactions</Text>
            </TouchableOpacity>
            <View style={styles.addMenuDivider} />
            <TouchableOpacity
              style={styles.addMenuItem}
              disabled={exporting}
              onPress={async () => {
                if (exporting) return;
                setShowAddMenu(false);
                setExporting(true);
                try {
                  await exportTransactions();
                } catch (err) {
                  Alert.alert(
                    "Export failed",
                    err instanceof Error ? err.message : "Could not export transactions."
                  );
                } finally {
                  setExporting(false);
                }
              }}
              activeOpacity={0.7}
              accessibilityLabel="Export transactions to CSV"
              accessibilityRole="button"
              accessibilityState={{ disabled: exporting }}
            >
              <MaterialCommunityIcons name="file-download-outline" size={20} color={colors.accent} />
              <Text style={styles.addMenuText}>
                {exporting ? "Exporting…" : "Export Transactions"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  greeting: {
    fontSize: 28,
    fontFamily: fonts.extraBold,
    color: colors.heroSurface,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.labelMedium,
    color: colors.textMuted,
    marginBottom: 24,
    marginTop: 6,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  headerAddButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: `${colors.accent}55`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  addMenuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 11,
  },
  addMenu: {
    position: "absolute",
    top: 0,
    right: 12,
    width: Dimensions.get("window").width / 3 + 40,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
    zIndex: 12,
    shadowColor: colors.heroSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  addMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  addMenuText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginLeft: 12,
  },
  addMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  // Shared hero card — dark surface used by NetWorth / Income / Spending / Health / Accounts
  heroCard: {
    ...heroCard.surface,
    marginBottom: 16,
  },
  heroCardSpaced: {
    // net-worth hero has more content — keep the original marginBottom cadence
  },
  heroCardGlow: heroCard.glow,
  heroCardLabel: heroCard.label,
  heroCardValue: {
    fontSize: 36,
    fontFamily: fonts.extraBold,
    color: colors.heroTextPrimary,
    letterSpacing: -0.5,
  },
  heroCardValueXL: {
    fontSize: 40,
    fontFamily: fonts.extraBold,
    color: colors.heroTextPrimary,
    letterSpacing: -0.5,
  },
  heroCardValueNegative: {
    color: colors.heroNegative,
  },
  heroIncomeValue: {
    color: colors.incomePositive,
  },
  heroCardHint: heroCard.hint,
  heroCardLink: heroCard.link,
  cardLoader: {
    alignSelf: "flex-start",
    marginVertical: 8,
  },
  carouselWrapper: {
    marginBottom: 16,
  },
  carouselContent: {
    alignItems: "stretch",
  },
  carouselCard: {
    marginBottom: 0,
    marginRight: 12,
  },
  carouselCardLast: {
    marginRight: 0,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.dotInactive,
    marginHorizontal: 4,
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  negative: {
    color: colors.negative,
  },
  budgetPillMargin: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
    ...shadows.card,
  },
  budgetChevron: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: -15,
  },
  budgetCategoryRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  budgetCategoryHeader: {
    alignItems: "center",
  },
  budgetCategoryName: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  budgetCategorySpent: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    marginTop: 6,
  },
  budgetCategorySpentSub: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  viewTxnBtn: {
    padding: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.heroTextPrimary,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.heroSurface,
    marginBottom: 12,
    marginTop: 8,
    letterSpacing: -0.3,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`,
    ...shadows.card,
  },
  itemCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemCardLeft: {
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
  itemCardInfo: {
    flex: 1,
  },
  itemCardName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  itemCardSub: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  itemCardRight: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  itemCardAmount: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  itemCardLabel: {
    fontSize: 9,
    fontFamily: fonts.labelMedium,
    color: `${colors.textSecondary}99`,
    letterSpacing: -0.3,
    textTransform: "uppercase",
    marginTop: 1,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
  onboardingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrimSubtle,
    zIndex: 20,
  },
  onboardingPopup: {
    position: "absolute",
    top: 10,
    right: 7,
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 14,
    alignItems: "center",
    zIndex: 21,
    shadowColor: colors.heroSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  onboardingTail: {
    position: "absolute",
    top: -8,
    right: 16,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: colors.surface,
  },
  onboardingClose: {
    position: "absolute",
    top: 8,
    left: 8,
  },
  onboardingTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  onboardingText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textAlign: "center",
  },
  onboardingBold: {
    fontFamily: fonts.bold,
    color: colors.accent,
  },
  accountsWidget: {
    // extends heroCard
  },
  accountsWidgetDecor: {
    position: "absolute",
    top: -10,
    right: -10,
    opacity: 0.12,
  },
  accountsWidgetTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  accountsWidgetTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.heroTextPrimary,
    opacity: 0.9,
  },
  accountsWidgetList: {
    position: "relative",
    zIndex: 1,
  },
  accountsWidgetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 12,
  },
  accountsWidgetRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.heroDivider,
  },
  accountsWidgetLeft: {
    flex: 0.75,
    marginRight: 12,
  },
  accountsWidgetSub: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.heroTextPrimary,
    opacity: 0.7,
    marginBottom: 2,
  },
  accountsWidgetName: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.heroTextPrimary,
  },
  accountsWidgetBalance: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.heroTextPrimary,
    flexShrink: 0,
    textAlign: "right",
  },
  accountsWidgetBalanceDebt: {
    color: colors.heroDebt,
  },
  healthScoreCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
  },
  healthScoreLeft: {
    flex: 1,
    marginRight: 16,
  },
  healthScoreDetail: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.heroTextSecondary,
    marginTop: 2,
  },
  healthScoreRight: {
    alignItems: "center",
  },
  healthScorePill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 72,
  },
  healthScoreValue: {
    fontSize: 32,
    fontFamily: fonts.extraBold,
    letterSpacing: -0.5,
  },
  healthScoreGrade: {
    fontSize: 12,
    fontFamily: fonts.labelMedium,
    letterSpacing: 2,
    marginTop: 0,
  },
});
