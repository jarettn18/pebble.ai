import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  useTransactionsStore,
} from "../../src/stores/transactions";
import { apiRequest } from "../../src/api/client";
import { colors, borderRadius, shadows, fonts } from "../../src/theme";
import { TransactionListCard } from "../../src/components/TransactionListCard";

type Category = {
  id: string;
  name: string;
  color: string | null;
};

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
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters =
    !!filters.search ||
    (filters.category_ids && filters.category_ids.length > 0) ||
    !!filters.date_from ||
    !!filters.date_to ||
    (filters.types && filters.types.length > 0) ||
    !!filters.account_id;

  // Apply account_id filter from navigation params
  useEffect(() => {
    if (params.account_id) {
      setFilters({ ...filters, account_id: params.account_id });
    }
  }, [params.account_id]);

  useEffect(() => {
    load();
    apiRequest<{ categories: Category[] }>("/v1/categories").then((data) =>
      setCategories(data.categories)
    );
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
    setSearchText("");
    clearFilters();
    if (params.account_id) {
      router.setParams({ account_id: "", account_name: "" });
    }
  }

  if (isSyncing && transactions.length === 0 && !hasActiveFilters) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
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
            tintColor={colors.primary}
          />
        }
      >
        {/* Filter Card */}
        <View style={styles.card}>
          {/* Search */}
          <View style={styles.searchInputWrap}>
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
                hitSlop={8}
              >
                <Text style={styles.clearSearch}>{"\u2715"}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Type Filter */}
          <Text style={styles.filterLabel}>Type</Text>
          <View style={styles.filterChipRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                filters.types?.includes("expense") && styles.filterChipActive,
              ]}
              onPress={() => handleTypeToggle("expense")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filters.types?.includes("expense") && styles.filterChipTextActive,
                ]}
              >
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                filters.types?.includes("income") && styles.filterChipIncome,
              ]}
              onPress={() => handleTypeToggle("income")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filters.types?.includes("income") && styles.filterChipTextActive,
                ]}
              >
                Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* Category Filter */}
          <Text style={styles.filterLabel}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  filters.category_ids?.includes(cat.id) && styles.filterChipActive,
                ]}
                onPress={() => handleCategoryToggle(cat.id)}
              >
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: cat.color || "#999" },
                  ]}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    filters.category_ids?.includes(cat.id) &&
                      styles.filterChipTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {hasActiveFilters && (
            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={handleClearFilters}
            >
              <Text style={styles.clearFiltersBtnText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Transactions */}
        {isLoading && transactions.length === 0 ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 32 }}
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
      >
        <Text style={styles.fabText}>+</Text>
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
  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`,
    ...shadows.card,
  },
  // Search
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 14,
    height: 42,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  clearSearch: {
    fontSize: 14,
    color: colors.textMuted,
    padding: 4,
  },
  // Filters
  filterLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  filterChipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  chipScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipIncome: {
    backgroundColor: colors.income,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textOnPrimary,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  clearFiltersBtn: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 8,
  },
  clearFiltersBtnText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.error,
  },
  // FAB
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: colors.textOnPrimary,
    fontSize: 28,
    fontFamily: fonts.semiBold,
    marginTop: -2,
  },
});
