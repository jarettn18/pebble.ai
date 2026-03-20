import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { apiRequest } from "../api/client";
import LineChart from "./LineChart";
import { formatCurrency } from "../utils/dashboard";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - 80; // card padding + container padding

type NetWorthPoint = {
  date: string;
  value: string;
};

type NetWorthHistoryResponse = {
  period: string;
  points: NetWorthPoint[];
  current: string | null;
  change: string | null;
  change_pct: string | null;
};

const PERIODS = ["1M", "3M", "1Y", "5Y"] as const;
type Period = (typeof PERIODS)[number];

type NetWorthChartProps = {
  /** Change this value to trigger a re-fetch of chart data. */
  refreshKey?: number;
};

export default function NetWorthChart({ refreshKey }: NetWorthChartProps) {
  const [period, setPeriod] = useState<Period>("1Y");
  const [data, setData] = useState<NetWorthHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res = await apiRequest<NetWorthHistoryResponse>(
        `/v1/dashboard/net-worth-history?period=${p}`
      );
      setData(res);
    } catch {
      // silently fail — the main dashboard still shows the number
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData, refreshKey]);

  const points = data?.points ?? [];
  const change = data?.change ? parseFloat(data.change) : null;
  const changePct = data?.change_pct ? parseFloat(data.change_pct) : null;
  const isPositive = change !== null && change >= 0;

  const chartColor = isPositive ? "#2e7d32" : "#d32f2f";

  const MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Build x-axis labels from point dates based on period
  const xLabels: { index: number; label: string }[] = [];
  if (points.length > 0) {
    const seen = new Set<string>();
    const maxLabels = period === "1M" ? 5 : period === "3M" ? 4 : period === "1Y" ? 6 : 5;
    const step = Math.max(1, Math.floor(points.length / maxLabels));

    for (let i = 0; i < points.length; i += step) {
      const d = new Date(points[i].date + "T00:00:00");
      let label: string;
      let key: string;

      if (period === "1M") {
        // Show day: "Mar 5"
        label = `${MONTH_ABBR[d.getMonth() + 1]} ${d.getDate()}`;
        key = label;
      } else if (period === "3M" || period === "1Y") {
        // Show month: "Mar"
        label = MONTH_ABBR[d.getMonth() + 1];
        key = `${d.getFullYear()}-${d.getMonth()}`;
      } else {
        // 5Y — show year: "2024"
        label = String(d.getFullYear());
        key = label;
      }

      if (!seen.has(key)) {
        seen.add(key);
        xLabels.push({ index: i, label });
      }
    }
  }

  return (
    <View style={styles.container}>
      {/* Change indicator */}
      {change !== null && (
        <View style={styles.changeRow}>
          <Text style={[styles.changeArrow, { color: chartColor }]}>
            {isPositive ? "\u2197" : "\u2198"}
          </Text>
          <Text style={[styles.changeText, { color: chartColor }]}>
            {isPositive ? "+" : "-"}{formatCurrency(Math.abs(change))}
            {changePct !== null ? ` (${isPositive ? "+" : ""}${changePct}%)` : ""}
          </Text>
        </View>
      )}

      {/* Chart */}
      {points.length >= 2 && (
        <View style={styles.chartContainer}>
          <LineChart
            data={points.map((p) => ({ value: parseFloat(p.value) }))}
            width={CHART_WIDTH}
            height={140}
            color={chartColor}
            showYAxis
            xLabels={xLabels}
          />
        </View>
      )}

      {/* Period tabs */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodTab, period === p && styles.periodTabActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.periodLabel,
                period === p && styles.periodLabelActive,
              ]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  changeArrow: {
    fontSize: 16,
    marginRight: 4,
  },
  changeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  chartContainer: {
    alignItems: "center",
    marginVertical: 8,
  },
  periodRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    marginTop: 4,
  },
  periodTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
  },
  periodTabActive: {
    backgroundColor: "#1a1a2e",
  },
  periodLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  periodLabelActive: {
    color: "#fff",
  },
});
