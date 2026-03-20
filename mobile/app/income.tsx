import { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useDashboardStore } from "../src/stores/dashboard";
import { formatCurrency } from "../src/utils/dashboard";

const CATEGORY_COLORS = [
  "#2e7d32",
  "#388e3c",
  "#43a047",
  "#4caf50",
  "#66bb6a",
  "#81c784",
  "#a5d6a7",
  "#c8e6c9",
  "#1b5e20",
  "#2e7d32",
];

export default function IncomeScreen() {
  const {
    monthlyIncome,
    incomeByCategory,
    incomeOverTime,
    isLoading,
    load,
    refresh,
  } = useDashboardStore();

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const maxCategoryAmount = Math.max(
    ...incomeByCategory.map((c) => parseFloat(c.amount)),
    1
  );

  const maxMonthAmount = Math.max(
    ...incomeOverTime.map((p) => parseFloat(p.amount)),
    1
  );

  const totalCatIncome = incomeByCategory.reduce(
    (sum, c) => sum + parseFloat(c.amount),
    0
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refresh}
          tintColor="#1a1a2e"
        />
      }
    >
      {/* Monthly Total */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>This Month's Income</Text>
        <Text style={styles.totalAmount}>{formatCurrency(monthlyIncome)}</Text>
      </View>

      {/* Monthly Trend Bar Chart */}
      {incomeOverTime.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Trend</Text>
          <View style={styles.barChart}>
            {incomeOverTime.map((point, i) => {
              const amount = parseFloat(point.amount);
              const heightPct = maxMonthAmount > 0 ? (amount / maxMonthAmount) * 100 : 0;
              const isCurrentMonth = i === incomeOverTime.length - 1;
              return (
                <View key={`${point.year}-${point.month}`} style={styles.barColumn}>
                  <Text style={styles.barValue}>
                    {amount > 0 ? formatCurrency(amount) : ""}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(heightPct, 2)}%`,
                          backgroundColor: isCurrentMonth ? "#43a047" : "#2e7d32",
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      isCurrentMonth && styles.barLabelActive,
                    ]}
                  >
                    {point.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Category Breakdown — Horizontal Bars */}
      {incomeByCategory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Category</Text>

          {/* Stacked summary bar */}
          <View style={styles.stackedBar}>
            {incomeByCategory.map((cat, i) => {
              const pct =
                totalCatIncome > 0
                  ? (parseFloat(cat.amount) / totalCatIncome) * 100
                  : 0;
              if (pct < 1) return null;
              return (
                <View
                  key={cat.category_name}
                  style={[
                    styles.stackedSegment,
                    {
                      width: `${pct}%`,
                      backgroundColor:
                        CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                    },
                    i === 0 && styles.stackedFirst,
                    i === incomeByCategory.length - 1 && styles.stackedLast,
                  ]}
                />
              );
            })}
          </View>

          {/* Individual category bars */}
          {incomeByCategory.map((cat, i) => {
            const amount = parseFloat(cat.amount);
            const pct = (amount / maxCategoryAmount) * 100;
            const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <View key={cat.category_name} style={styles.categoryRow}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryLabelRow}>
                    <View
                      style={[styles.categoryDot, { backgroundColor: color }]}
                    />
                    <Text style={styles.categoryName}>{cat.category_name}</Text>
                  </View>
                  <Text style={styles.categoryAmount}>
                    {formatCurrency(amount)}
                  </Text>
                </View>
                <View style={styles.horizontalBarTrack}>
                  <View
                    style={[
                      styles.horizontalBar,
                      {
                        width: `${pct}%`,
                        backgroundColor: color,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {incomeByCategory.length === 0 && !isLoading && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No income data yet</Text>
          <Text style={styles.emptyHint}>
            Income transactions will appear here once synced
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: "700",
    color: "#2e7d32",
  },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 180,
    marginTop: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  barValue: {
    fontSize: 10,
    color: "#666",
    marginBottom: 4,
    textAlign: "center",
  },
  barTrack: {
    flex: 1,
    width: "60%",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 4,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 6,
    fontWeight: "500",
  },
  barLabelActive: {
    color: "#43a047",
    fontWeight: "700",
  },
  stackedBar: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 16,
  },
  stackedSegment: {
    height: "100%",
  },
  stackedFirst: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  stackedLast: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  categoryRow: {
    marginBottom: 14,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a2e",
    flex: 1,
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  horizontalBarTrack: {
    height: 6,
    backgroundColor: "#f0f0f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  horizontalBar: {
    height: "100%",
    borderRadius: 3,
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
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
  },
});
