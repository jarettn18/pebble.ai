import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useTransactionsStore,
} from "../../src/stores/transactions";
import { apiRequest } from "../../src/api/client";
import { colors, borderRadius, shadows, fonts, microLabelSmall } from "../../src/theme";
import { withOpacity } from "../../src/utils/color";
import { getCategoryIcon } from "../../src/utils/categoryIcons";
import { formatCurrency } from "../../src/utils/dashboard";
import { TransactionListCard } from "../../src/components/TransactionListCard";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Category = {
  id: string;
  name: string;
  color: string | null;
};

const HIT_SLOP_8 = { top: 8, bottom: 8, left: 8, right: 8 };

export default function TransactionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ account_id?: string; account_name?: string }>();
  const {
    transactions,
    isLoading,
    isSyncing,
    error,
    filters,
    load,
    syncAndRefresh,
    setFilters,
    clearFilters,
  } = useTransactionsStore();

  const [searchText, setSearchText] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.category_ids?.length ?? 0) +
    (filters.types?.length ?? 0) +
    (filters.date_from ? 1 : 0) +
    (filters.date_to ? 1 : 0) +
    (filters.account_id ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  // Apply account_id filter from navigation params
  useEffect(() => {
    if (params.account_id) {
      setFilters({ ...filters, account_id: params.account_id });
    }
  }, [params.account_id]);

  useEffect(() => {
    load();
    apiRequest<{ categories: Category[] }>("/v1/categories")
      .then((data) => setCategories(data.categories))
      .catch((err) => {
        if (__DEV__) console.warn("Failed to load categories:", err);
      });
  }, [load]);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchText(text);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        setFilters({ ...filters, search: text || undefined });
      }, 400);
    },
    [filters, setFilters]
  );

  function toggleFilters() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilterOpen((prev) => !prev);
  }

  function handleTypeToggle(type: "expense" | "income") {
    const current = filters.types ?? [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setFilters({
      ...filters,
      types: updated.length > 0 ? updated : undefined,
    });
  }

  function handleCategoryToggle(categoryId: string) {
    const current = filters.category_ids ?? [];
    const updated = current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId];
    setFilters({
      ...filters,
      category_ids: updated.length > 0 ? updated : undefined,
    });
  }

  function handleClearFilters() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchText("");
    clearFilters();
    if (params.account_id) {
      router.setParams({ account_id: "", account_name: "" });
    }
  }

  const { spentTotal, earnedTotal } = useMemo(() => {
    let spent = 0;
    let earned = 0;
    for (const t of transactions) {
      const amt = parseFloat(t.amount);
      if (!Number.isFinite(amt)) continue;
      if (amt > 0) spent += amt;
      else earned += Math.abs(amt);
    }
    return { spentTotal: spent, earnedTotal: earned };
  }, [transactions]);

  const filterSummary = useMemo(() => {
    if (!hasActiveFilters) return null;
    const parts: string[] = [];
    if (filters.search) parts.push(`"${filters.search}"`);
    if (filters.types?.length) parts.push(filters.types.join(" · "));
    if (filters.category_ids?.length) {
      parts.push(
        `${filters.category_ids.length} ${filters.category_ids.length === 1 ? "category" : "categories"}`
      );
    }
    if (params.account_name) parts.push(params.account_name as string);
    return parts.join(" · ");
  }, [filters, hasActiveFilters, params.account_name]);

  if (isSyncing && transactions.length === 0 && !hasActiveFilters) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={syncAndRefresh}
            tintColor={colors.accent}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Action Bar ─────────────────────────────────────────────── */}
        <View style={styles.actionBar}>
          {/* Search + Filter on one row */}
          <View style={styles.actionBarRow}>
            <View style={styles.searchInputWrap}>
              <MaterialCommunityIcons
                name="magnify"
                size={18}
                color={colors.textMuted}
                style={styles.searchLeadIcon}
              />
              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={handleSearchChange}
                placeholder="Search transactions..."
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => handleSearchChange("")}
                  hitSlop={HIT_SLOP_8}
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.iconBtn, filterOpen && styles.iconBtnActive]}
              onPress={toggleFilters}
              accessibilityLabel={
                filterOpen
                  ? "Hide filters"
                  : `Show filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ""}`
              }
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="tune-variant"
                size={20}
                color={filterOpen || hasActiveFilters ? colors.accent : colors.textPrimary}
              />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Summary strip — only shown when filters are active */}
          {hasActiveFilters && (
            <View style={styles.summaryRow}>
              <Text style={styles.activeSummary} numberOfLines={1}>
                {filterSummary}
              </Text>
              <TouchableOpacity
                onPress={handleClearFilters}
                hitSlop={HIT_SLOP_8}
                accessibilityLabel="Clear all filters"
                accessibilityRole="button"
              >
                <Text style={styles.clearLink}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Filtered net total — only when filters are active */}
          {hasActiveFilters && (spentTotal > 0 || earnedTotal > 0) && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Filtered total</Text>
              <Text
                style={[
                  styles.totalsValue,
                  {
                    color:
                      earnedTotal >= spentTotal
                        ? colors.incomePositive
                        : colors.accent,
                  },
                ]}
              >
                {earnedTotal >= spentTotal ? "+" : "−"}
                {formatCurrency(Math.abs(earnedTotal - spentTotal))}
              </Text>
            </View>
          )}

          {/* ─── Collapsible Filter Panel ───────────────────────────── */}
          {filterOpen && (
            <View style={styles.filterPanel}>
              {/* Type */}
              <Text style={styles.filterLabel}>TYPE</Text>
              <View style={styles.typeRow}>
                {(["expense", "income"] as const).map((type) => {
                  const active = !!filters.types?.includes(type);
                  const accent = type === "income" ? colors.incomePositive : colors.accent;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeChip,
                        active && {
                          backgroundColor: withOpacity(accent, 0.15),
                          borderColor: withOpacity(accent, 0.5),
                        },
                      ]}
                      onPress={() => handleTypeToggle(type)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <MaterialCommunityIcons
                        name={type === "income" ? "arrow-bottom-left" : "arrow-top-right"}
                        size={14}
                        color={active ? accent : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          active && { color: accent, fontFamily: fonts.bold },
                        ]}
                      >
                        {type === "income" ? "Income" : "Expense"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Categories — wrapping grid */}
              {categories.length > 0 && (
                <>
                  <Text style={styles.filterLabel}>CATEGORY</Text>
                  <View style={styles.categoryGrid}>
                    {categories.map((cat) => {
                      const active = !!filters.category_ids?.includes(cat.id);
                      const catColor = cat.color || colors.textMuted;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.categoryChip,
                            active && {
                              backgroundColor: withOpacity(catColor, 0.15),
                              borderColor: withOpacity(catColor, 0.55),
                            },
                          ]}
                          onPress={() => handleCategoryToggle(cat.id)}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                        >
                          <View
                            style={[
                              styles.categoryChipIcon,
                              { backgroundColor: withOpacity(catColor, 0.18) },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={getCategoryIcon(cat.name) as any}
                              size={14}
                              color={catColor}
                            />
                          </View>
                          <Text
                            style={[
                              styles.categoryChipText,
                              active && { color: colors.heroSurface, fontFamily: fonts.bold },
                            ]}
                            numberOfLines={1}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {/* ─── Transactions ───────────────────────────────────────────── */}
        {isLoading && transactions.length === 0 ? (
          <ActivityIndicator
            size="large"
            color={colors.accent}
            style={styles.loader}
          />
        ) : (
          <TransactionListCard
            transactions={transactions}
            emptyMessage={hasActiveFilters ? "No matching transactions" : "No transactions yet"}
            emptyHint={
              hasActiveFilters
                ? "Try adjusting your filters"
                : "Connect a bank account and pull down to sync"
            }
          />
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/transaction/create")}
        accessibilityLabel="Add transaction"
        accessibilityRole="button"
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={26} color={colors.heroSurface} />
      </TouchableOpacity>
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
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    padding: 12,
    backgroundColor: colors.errorBackground,
  },

  // ─── Action Bar ─────────────────────────────────────────────────────
  actionBar: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`,
    ...shadows.card,
  },
  actionBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingHorizontal: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
    position: "relative",
  },
  iconBtnActive: {
    backgroundColor: colors.accentSoft,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  filterBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.heroSurface,
  },
  activeSummary: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.heroSurface,
    letterSpacing: -0.1,
    marginRight: 12,
  },
  clearLink: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.accent,
    paddingHorizontal: 4,
  },

  // Filtered totals strip
  totalsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  totalsLabel: {
    ...microLabelSmall,
    color: colors.textMuted,
  },
  totalsValue: {
    fontSize: 14,
    fontFamily: fonts.bold,
    letterSpacing: -0.2,
  },

  // ─── Search ─────────────────────────────────────────────────────────
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchLeadIcon: {
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },

  // ─── Filter Panel ───────────────────────────────────────────────────
  filterPanel: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  filterLabel: {
    ...microLabelSmall,
    color: colors.textMuted,
    marginBottom: 10,
  },

  // Type chips
  typeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "transparent",
  },
  typeChipText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },

  // Category grid
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: "transparent",
    maxWidth: "100%",
  },
  categoryChipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    flexShrink: 1,
  },

  // ─── List + FAB ─────────────────────────────────────────────────────
  loader: {
    marginTop: 32,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.heroSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
