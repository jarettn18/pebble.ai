import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  useTransactionsStore,
  TransactionFilters,
} from "../../src/stores/transactions";
import { apiRequest } from "../../src/api/client";

type Category = {
  id: string;
  name: string;
  color: string | null;
};

export default function TransactionsScreen() {
  const router = useRouter();
  const {
    transactions,
    totalCount,
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
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters =
    !!filters.search ||
    !!filters.category_id ||
    !!filters.date_from ||
    !!filters.date_to ||
    !!filters.type;

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
    setFilters({
      ...filters,
      type: filters.type === type ? undefined : type,
    });
  }

  function handleCategoryToggle(categoryId: string) {
    setFilters({
      ...filters,
      category_id: filters.category_id === categoryId ? undefined : categoryId,
    });
  }

  function handleClearFilters() {
    setSearchText("");
    clearFilters();
  }

  if (!showFilters && !hasActiveFilters && isSyncing && transactions.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
    );
  }

  const selectedCategoryName = categories.find(
    (c) => c.id === filters.category_id
  )?.name;

  return (
    <View style={styles.container}>
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={handleSearchChange}
            placeholder="Search transactions..."
            placeholderTextColor="#999"
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
        <TouchableOpacity
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text
            style={[
              styles.filterToggleText,
              showFilters && styles.filterToggleTextActive,
            ]}
          >
            Filters
          </Text>
          {hasActiveFilters && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* Filter Panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          {/* Type Filter */}
          <Text style={styles.filterLabel}>Type</Text>
          <View style={styles.filterChipRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                filters.type === "expense" && styles.filterChipActive,
              ]}
              onPress={() => handleTypeToggle("expense")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filters.type === "expense" && styles.filterChipTextActive,
                ]}
              >
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                filters.type === "income" && styles.filterChipIncome,
              ]}
              onPress={() => handleTypeToggle("income")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filters.type === "income" && styles.filterChipTextActive,
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
                  filters.category_id === cat.id && styles.filterChipActive,
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
                    filters.category_id === cat.id &&
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
      )}

      {/* Active filter summary */}
      {hasActiveFilters && !showFilters && (
        <View style={styles.activeFiltersBar}>
          <Text style={styles.activeFiltersText} numberOfLines={1}>
            Filtered: {totalCount} result{totalCount !== 1 ? "s" : ""}
            {filters.type ? ` · ${filters.type}` : ""}
            {selectedCategoryName ? ` · ${selectedCategoryName}` : ""}
          </Text>
          <TouchableOpacity onPress={handleClearFilters}>
            <Text style={styles.clearAllText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && transactions.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1a1a2e" />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>
            {hasActiveFilters ? "No matching transactions" : "No transactions yet"}
          </Text>
          <Text style={styles.emptyHint}>
            {hasActiveFilters
              ? "Try adjusting your filters"
              : "Connect a bank account and pull down to sync"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isSyncing}
              onRefresh={syncAndRefresh}
              tintColor="#1a1a2e"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/transaction/${item.id}`)}
            >
              <TransactionRow txn={item} />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={styles.listContent}
        />
      )}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/transaction/create")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

type Transaction = {
  id: string;
  amount: string;
  date: string;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  category_name: string | null;
};

function TransactionRow({ txn }: { txn: Transaction }) {
  const amount = parseFloat(txn.amount);
  const isDebit = amount > 0;
  const displayAmount = isDebit
    ? `-$${amount.toFixed(2)}`
    : `+$${Math.abs(amount).toFixed(2)}`;

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.txnName} numberOfLines={1}>
          {txn.merchant_name || txn.name}
        </Text>
        <Text style={styles.txnDetail}>
          {txn.date}
          {txn.category_name ? ` · ${txn.category_name}` : ""}
          {txn.pending ? " · Pending" : ""}
        </Text>
      </View>
      <Text style={[styles.txnAmount, isDebit ? styles.debit : styles.credit]}>
        {displayAmount}
      </Text>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centered: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  emptyHint: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#d32f2f",
    fontSize: 14,
    textAlign: "center",
    padding: 12,
    backgroundColor: "#fdecea",
  },
  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1a1a2e",
  },
  clearSearch: {
    fontSize: 14,
    color: "#999",
    padding: 4,
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  filterToggleActive: {
    backgroundColor: "#1a1a2e",
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  filterToggleTextActive: {
    color: "#fff",
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d32f2f",
    marginLeft: 6,
  },
  // Filter Panel
  filterPanel: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    marginTop: 4,
  },
  filterChipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  chipScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#1a1a2e",
  },
  filterChipIncome: {
    backgroundColor: "#2e7d32",
  },
  filterChipText: {
    fontSize: 13,
    color: "#666",
  },
  filterChipTextActive: {
    color: "#fff",
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
    marginTop: 4,
  },
  clearFiltersBtnText: {
    fontSize: 13,
    color: "#d32f2f",
    fontWeight: "600",
  },
  // Active filters bar
  activeFiltersBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#e8eaf6",
  },
  activeFiltersText: {
    fontSize: 13,
    color: "#1a1a2e",
    flex: 1,
  },
  clearAllText: {
    fontSize: 13,
    color: "#d32f2f",
    fontWeight: "600",
    marginLeft: 12,
  },
  // List
  listContent: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  txnName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  txnDetail: {
    fontSize: 13,
    color: "#999",
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  debit: {
    color: "#1a1a2e",
  },
  credit: {
    color: "#2e7d32",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e0e0e0",
    marginLeft: 20,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "600",
    marginTop: -2,
  },
});
