import { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { useFocusEffect, useRouter, useNavigation } from "expo-router";
import type { AccountSummary, AssetSummary } from "../../src/stores/dashboard";
import { useAuthStore } from "../../src/stores/auth";
import { useDashboardStore } from "../../src/stores/dashboard";
import { useAccountsStore } from "../../src/stores/accounts";
import { useTransactionsStore } from "../../src/stores/transactions";
import { usePlaidLink } from "../../src/hooks/usePlaidLink";
import { apiRequest } from "../../src/api/client";
import { formatCurrency } from "../../src/utils/dashboard";
import PieChart from "../../src/components/PieChart";
import NetWorthChart from "../../src/components/NetWorthChart";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, borderRadius, shadows, fonts } from "../../src/theme";

const PIE_COLORS = colors.spendingPalette;
const INCOME_COLORS = colors.incomePalette;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  depository: "Bank",
  credit: "Credit Card",
  loan: "Loan",
  investment: "Investment",
};

const ACCOUNT_TYPE_ICONS: Record<string, string> = {
  depository: "bank-outline",
  credit: "credit-card-outline",
  loan: "cash-minus",
  investment: "chart-line",
};

const ACCOUNT_ICON_BG: Record<string, string> = {
  depository: colors.primaryFixed,
  credit: colors.secondaryContainer,
  loan: colors.tertiaryFixed,
  investment: `${colors.primaryFixed}99`,
};

const ACCOUNT_ICON_FG: Record<string, string> = {
  depository: colors.primary,
  credit: colors.secondary,
  loan: colors.tertiary,
  investment: colors.primary,
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

function AccountRow({ account, onPress }: { account: AccountSummary; onPress: () => void }) {
  const bal = account.balance_current ? parseFloat(account.balance_current) : null;
  const isDebt = account.type === "credit" || account.type === "loan";
  const typeLabel = ACCOUNT_TYPE_LABELS[account.type] ?? account.type;
  const iconName = ACCOUNT_TYPE_ICONS[account.type] ?? "wallet-outline";
  const iconBg = ACCOUNT_ICON_BG[account.type] ?? colors.primaryFixed;
  const iconFg = ACCOUNT_ICON_FG[account.type] ?? colors.primary;

  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.itemCardRow}>
        <View style={styles.itemCardLeft}>
          <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
            <MaterialCommunityIcons name={iconName as any} size={22} color={iconFg} />
          </View>
          <View style={styles.itemCardInfo}>
            <Text style={styles.itemCardName} numberOfLines={1}>{account.name}</Text>
            <Text style={styles.itemCardSub}>
              {account.institution_name ? `${account.institution_name} · ` : ""}{typeLabel}
              {account.subtype ? ` · ${account.subtype}` : ""}
            </Text>
          </View>
        </View>
        <View style={styles.itemCardRight}>
          {bal !== null && Number.isFinite(bal) && (
            <>
              <Text style={[styles.itemCardAmount, isDebt && styles.negative]}>
                {isDebt ? "-" : ""}{formatCurrency(bal)}
              </Text>
              <Text style={styles.itemCardLabel}>BALANCE</Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function AssetRow({ asset, onPress }: { asset: AssetSummary; onPress: () => void }) {
  const value = parseFloat(asset.estimated_value);
  const typeLabel = ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type;
  const iconName = ASSET_TYPE_ICONS[asset.asset_type] ?? "package-variant-closed";

  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.itemCardRow}>
        <View style={styles.itemCardLeft}>
          <View style={[styles.iconCircle, { backgroundColor: `${colors.secondaryContainer}80` }]}>
            <MaterialCommunityIcons name={iconName as any} size={22} color={colors.secondary} />
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

  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const syncTransactions = useTransactionsStore((s) => s.syncAndRefresh);

  const { error, linkResult, openLink, clearResult } =
    usePlaidLink();

  // Refresh balances (if stale) and reload dashboard on tab focus
  useFocusEffect(
    useCallback(() => {
      async function refreshAndLoad() {
        try {
          await apiRequest("/v1/plaid/refresh-balances", { method: "POST" });
        } catch {
          // may fail if no items linked
        }
        await loadDashboard(undefined, undefined, true);
      }
      refreshAndLoad();
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
        >
          <MaterialCommunityIcons name="plus" size={22} color={colors.primary} />
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
          refreshAccounts();
          syncTransactions();
          refreshDashboard();
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

  const totalBudgeted = budgetSummaries.reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0);
  const totalSpent = budgetSummaries.reduce((sum, b) => sum + parseFloat(b.spent || "0"), 0);
  const budgetRemaining = totalBudgeted - totalSpent;
  const budgetPct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const isOverBudget = totalSpent > totalBudgeted;

  const hasAccounts = accounts.length > 0 || assets.length > 0;
  const [carouselPage, setCarouselPage] = useState(0);
  const cardWidth = Dimensions.get("window").width - 40;

  const onCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 12));
    setCarouselPage(page);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={dashLoading}
            onRefresh={refreshDashboard}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.greeting}>
          Hello, {user?.full_name?.split(" ")[0] ?? "there"}
        </Text>
        <Text style={styles.subtitle}>Your financial overview</Text>

      <View style={styles.card}>
        <Text style={styles.netWorthLabel}>YOUR NETWORTH</Text>
        {dashLoading && !hasAccounts ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.cardLoader} />
        ) : (
          <Text style={[styles.cardValue, netWorth !== null && netWorth < 0 && styles.negative]}>
            {netWorth !== null ? formatCurrency(netWorth) : "--"}
          </Text>
        )}
        {hasAccounts && <NetWorthChart refreshKey={refreshCount} />}
        {!hasAccounts && !dashLoading && (
          <Text style={styles.cardHint}>Connect a bank account to get started</Text>
        )}
      </View>

      <View style={styles.carouselWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 12}
          decelerationRate="fast"
          onMomentumScrollEnd={onCarouselScroll}
          contentContainerStyle={styles.carouselContent}
        >
          <TouchableOpacity
            style={[styles.card, styles.carouselCard, { width: cardWidth }]}
            onPress={() => router.push("/income")}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>This Month's Income</Text>
            {dashLoading && !hasAccounts ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.cardLoader} />
            ) : (
              <Text style={[styles.cardValue, styles.incomeValue]}>
                {hasAccounts ? formatCurrency(monthlyIncome) : "--"}
              </Text>
            )}
            {incomeByCategory.length > 0 && (
              <PieChart
                slices={incomeByCategory.map((cat, i) => ({
                  label: cat.category_name,
                  value: parseFloat(cat.amount),
                  color: INCOME_COLORS[i % INCOME_COLORS.length],
                }))}
              />
            )}
            {hasAccounts && (
              <Text style={styles.cardLink}>View details →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.carouselCard, { width: cardWidth }]}
            onPress={() => router.push("/spending")}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>This Month's Spending</Text>
            {dashLoading && !hasAccounts ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.cardLoader} />
            ) : (
              <Text style={styles.cardValue}>
                {hasAccounts ? formatCurrency(monthlySpending) : "--"}
              </Text>
            )}
            {spendingByCategory.length > 0 && (
              <PieChart
                slices={spendingByCategory.map((cat, i) => ({
                  label: cat.category_name,
                  value: parseFloat(cat.amount),
                  color: PIE_COLORS[i % PIE_COLORS.length],
                }))}
              />
            )}
            {hasAccounts && (
              <Text style={styles.cardLink}>View details →</Text>
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
        <View style={styles.budgetPill}>
          <View style={styles.budgetPillTop}>
            <View>
              <Text style={styles.budgetPillLabel}>Overall Budget</Text>
              <Text style={styles.budgetPillValue}>
                {budgetPct}%{" "}
                <Text style={styles.budgetPillValueSub}>
                  of {formatCurrency(totalBudgeted)}
                </Text>
              </Text>
            </View>
            <Text style={[styles.budgetPillRemaining, isOverBudget && styles.negative]}>
              {isOverBudget ? "Over by " : ""}{formatCurrency(Math.abs(budgetRemaining))}{isOverBudget ? "" : " left"}
            </Text>
          </View>
          <View style={styles.budgetProgressTrack}>
            <View
              style={[
                styles.budgetProgressFill,
                { width: `${Math.min(budgetPct, 100)}%` },
                isOverBudget && { backgroundColor: colors.error },
              ]}
            />
          </View>
        </View>
      )}

      {/* Accounts */}
      {accounts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Accounts</Text>
          {accounts.map((acct) => (
            <AccountRow
              key={acct.id}
              account={acct}
              onPress={() => router.push(`/(tabs)/transactions?account_id=${acct.id}&account_name=${encodeURIComponent(acct.name)}`)}
            />
          ))}
        </>
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
            >
              <MaterialCommunityIcons name="bank-outline" size={20} color={colors.primary} />
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
            >
              <MaterialCommunityIcons name="home-outline" size={20} color={colors.primary} />
              <Text style={styles.addMenuText}>Add Property or Vehicle</Text>
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
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 24,
    marginTop: 4,
  },
  headerAddButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: `${colors.textPrimary}26`, // 15% opacity
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
    shadowColor: "#000",
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`,
    ...shadows.card,
  },
  netWorthLabel: {
    fontSize: 12,
    fontFamily: fonts.labelMedium,
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 36,
    fontFamily: fonts.extraBold,
    color: colors.textPrimary,
  },
  cardLoader: {
    alignSelf: "flex-start",
    marginVertical: 8,
  },
  cardHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  cardLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 8,
  },
  incomeValue: {
    color: colors.textSecondary,
  },
  carouselWrapper: {
    marginBottom: 16,
  },
  carouselContent: {
    paddingRight: 20,
  },
  carouselCard: {
    marginBottom: 0,
    marginRight: 12,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.dotInactive,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  negative: {
    color: colors.negative,
  },
  budgetPill: {
    padding: 20,
    backgroundColor: `${colors.primaryFixed}4D`,
    borderRadius: borderRadius.lg,
    marginBottom: 16,
  },
  budgetPillTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  budgetPillLabel: {
    fontSize: 11,
    fontFamily: fonts.labelMedium,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textPrimary,
    opacity: 0.7,
    marginBottom: 4,
  },
  budgetPillValue: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  budgetPillValueSub: {
    fontSize: 13,
    fontWeight: "400",
    opacity: 0.7,
  },
  budgetPillRemaining: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  budgetProgressTrack: {
    height: 16,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderRadius: 9999,
  },
  budgetProgressFill: {
    height: "100%" as unknown as number,
    backgroundColor: colors.primary,
    borderRadius: 9999,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
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
});
