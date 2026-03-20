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
import { useBudgetsStore } from "../../src/stores/budgets";
import { formatCurrency } from "../../src/utils/dashboard";

function getCurrentMonth() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function monthLabel(month: number, year: number) {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function BudgetsScreen() {
  const router = useRouter();
  const { budgets, isLoading, error, load } = useBudgetsStore();
  const [period, setPeriod] = useState(getCurrentMonth);

  // Fetch budgets every time the tab is focused or month changes
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

  const total = budgets.reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0);

  return (
    <View style={styles.container}>
      {/* Month Selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={12}>
          <Text style={styles.monthArrow}>{"\u2190"}</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel(period.month, period.year)}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={12}>
          <Text style={styles.monthArrow}>{"\u2192"}</Text>
        </TouchableOpacity>
      </View>

      {/* Total */}
      {budgets.length > 0 && (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Budgeted</Text>
          <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
        </View>
      )}

      {/* Budget List */}
      {isLoading && budgets.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1a1a2e" />
        </View>
      ) : budgets.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No budgets for this month</Text>
          <Text style={styles.emptyHint}>
            Tap the button below to create one
          </Text>
        </View>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => load(period.month, period.year)} tintColor="#1a1a2e" />
          }
          renderItem={({ item }) => {
            const budgeted = parseFloat(item.amount || "0");
            const spent = parseFloat(item.spent || "0");
            const remaining = budgeted - spent;
            const progress = budgeted > 0 ? Math.min(spent / budgeted, 1) : 0;
            const overBudget = spent > budgeted;

            return (
              <TouchableOpacity
                style={styles.budgetRow}
                onPress={() => router.push(`/budget/${item.id}?month=${period.month}&year=${period.year}`)}
                activeOpacity={0.7}
              >
                <View style={styles.budgetTop}>
                  <Text style={styles.budgetCategory} numberOfLines={1}>
                    {item.category_name || "Uncategorized"}
                  </Text>
                  <Text style={[styles.budgetRemaining, overBudget && styles.overBudget]}>
                    {overBudget ? "-" : ""}{formatCurrency(Math.abs(remaining))} left
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress * 100}%` },
                      overBudget && styles.progressOverBudget,
                    ]}
                  />
                </View>
                <View style={styles.budgetBottom}>
                  <Text style={styles.budgetSpent}>
                    {formatCurrency(spent)} spent
                  </Text>
                  <Text style={styles.budgetTotal}>
                    of {formatCurrency(budgeted)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Create Button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push(`/budget/new?month=${period.month}&year=${period.year}`)}
        activeOpacity={0.8}
      >
        <Text style={styles.createButtonText}>+ Create Budget</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  monthArrow: {
    fontSize: 22,
    color: "#1a1a2e",
    fontWeight: "600",
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  totalCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 14,
    color: "#666",
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
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
  listContent: {
    paddingHorizontal: 20,
  },
  budgetRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  budgetTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  budgetCategory: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a2e",
    flex: 1,
    marginRight: 8,
  },
  budgetRemaining: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2e7d32",
  },
  overBudget: {
    color: "#d32f2f",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    marginBottom: 8,
    overflow: "hidden" as const,
  },
  progressFill: {
    height: "100%" as unknown as number,
    backgroundColor: "#1a1a2e",
    borderRadius: 3,
  },
  progressOverBudget: {
    backgroundColor: "#d32f2f",
  },
  budgetBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  budgetSpent: {
    fontSize: 13,
    color: "#666",
  },
  budgetTotal: {
    fontSize: 13,
    color: "#999",
  },
  separator: {
    height: 8,
  },
  errorText: {
    color: "#d32f2f",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  createButton: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    margin: 20,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
