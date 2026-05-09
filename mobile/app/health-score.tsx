import { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  useHealthScoreStore,
  type ComponentScore,
  type BenchmarkInsight,
} from "../src/stores/healthScore";
import { useChatUIStore } from "../src/stores/chatUI";
import {
  colors,
  borderRadius,
  shadows,
  fonts,
  progressBarStyles,
} from "../src/theme";

const GRADE_COLORS: Record<string, string> = {
  A: colors.gradeA,
  B: colors.gradeB,
  C: colors.gradeC,
  D: colors.gradeD,
  F: colors.gradeF,
};

const STATUS_COLORS: Record<string, string> = {
  good: colors.gradeA,
  fair: colors.gradeC,
  poor: colors.gradeF,
  no_data: colors.textMuted,
};

const MISSING_DATA_HINTS: Record<string, string> = {
  savings_rate: "Add income transactions or set your annual income in settings",
  debt_to_income: "Link credit card or loan accounts and set your annual income",
  emergency_fund: "Link your bank accounts to track liquid savings",
  budget_adherence: "Set up monthly budgets to track your spending discipline",
  net_worth_trend: "Keep using Pebble — trends need at least a few weeks of data",
  diversification: "Link more account types (savings, investment) or add assets",
};

export default function HealthScoreScreen() {
  const {
    overallScore,
    grade,
    components,
    dataCompleteness,
    missingData,
    insights,
    isLoading,
    load,
    history,
    loadHistory,
  } = useHealthScoreStore();

  useFocusEffect(
    useCallback(() => {
      load();
      loadHistory("3M");
    }, [])
  );

  const gradeColor = grade ? GRADE_COLORS[grade] ?? colors.textMuted : colors.textMuted;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={load}
          tintColor={colors.primary}
        />
      }
    >
      {/* Score Ring */}
      <View style={styles.scoreCard}>
        <View style={[styles.scoreRing, { borderColor: gradeColor }]}>
          <Text style={[styles.scoreNumber, { color: gradeColor }]}>
            {overallScore ?? "—"}
          </Text>
          <Text style={[styles.gradeLabel, { color: gradeColor }]}>
            {grade ?? "—"}
          </Text>
        </View>
        <Text style={styles.scoreTitle}>Financial Health Score</Text>
        {dataCompleteness < 1 && (
          <Text style={styles.completenessHint}>
            Based on {Math.round(dataCompleteness * 100)}% of available data
          </Text>
        )}
      </View>

      {/* Component Breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Score Breakdown</Text>
        {components.map((comp) => (
          <ComponentRow key={comp.name} component={comp} />
        ))}
      </View>

      {/* Demographic Insights */}
      {insights.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How You Compare</Text>
          {insights.map((insight) => (
            <InsightRow key={insight.category} insight={insight} />
          ))}
        </View>
      )}

      {/* Missing Data Suggestions */}
      {missingData.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Improve Your Score</Text>
          {missingData.map((name) => (
            <View key={name} style={styles.hintRow}>
              <View style={styles.hintDot} />
              <Text style={styles.hintText}>
                {MISSING_DATA_HINTS[name] ?? `Add data for ${name}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Score History */}
      {history.length > 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Score History</Text>
          <View style={styles.historyChart}>
            {history.map((point, i) => {
              const maxScore = Math.max(...history.map((h) => h.score), 1);
              const heightPct = (point.score / 100) * 100;
              const pointColor = GRADE_COLORS[point.grade] ?? colors.textMuted;
              return (
                <View key={point.date} style={styles.historyBar}>
                  <Text style={styles.historyValue}>{point.score}</Text>
                  <View style={styles.historyTrack}>
                    <View
                      style={[
                        styles.historyFill,
                        {
                          height: `${Math.max(heightPct, 2)}%`,
                          backgroundColor: pointColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.historyDate}>
                    {new Date(point.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Ask AI Button */}
      <TouchableOpacity
        style={styles.aiButton}
        activeOpacity={0.8}
        onPress={() => useChatUIStore.getState().openChat()}
      >
        <Text style={styles.aiButtonText}>Ask AI for Tips</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ComponentRow({ component }: { component: ComponentScore }) {
  const statusColor =
    STATUS_COLORS[component.status] ?? colors.textMuted;

  return (
    <View style={styles.componentRow}>
      <View style={styles.componentHeader}>
        <Text style={styles.componentName}>{component.label}</Text>
        <View style={styles.componentScoreRow}>
          <Text style={[styles.componentScore, { color: statusColor }]}>
            {component.has_data ? component.score : "—"}
          </Text>
          <Text style={styles.componentMax}>/100</Text>
        </View>
      </View>
      <View style={progressBarStyles.track}>
        <View
          style={[
            progressBarStyles.fill,
            {
              width: component.has_data ? `${component.score}%` : "0%",
              backgroundColor: statusColor,
            },
          ]}
        />
      </View>
      <Text style={styles.componentDetail}>{component.detail}</Text>
    </View>
  );
}

function InsightRow({ insight }: { insight: BenchmarkInsight }) {
  const percentile = insight.percentile;
  const barColor =
    percentile !== null && percentile >= 75
      ? colors.gradeA
      : percentile !== null && percentile >= 50
        ? colors.gradeB
        : percentile !== null && percentile >= 25
          ? colors.gradeC
          : colors.gradeF;

  return (
    <View style={styles.insightRow}>
      <Text style={styles.insightTitle}>{insight.title}</Text>
      {percentile !== null && (
        <View style={styles.insightBarContainer}>
          <View style={styles.insightBarTrack}>
            <View
              style={[
                styles.insightBarFill,
                { width: `${percentile}%`, backgroundColor: barColor },
              ]}
            />
            <View
              style={[
                styles.insightBarMarker,
                { left: `${percentile}%` },
              ]}
            />
          </View>
          <Text style={[styles.insightPercentile, { color: barColor }]}>
            {insight.comparison === "above median" || insight.comparison === "excellent" || insight.comparison === "above average"
              ? insight.comparison
              : `${percentile}th percentile`}
          </Text>
        </View>
      )}
      <Text style={styles.insightDescription}>{insight.description}</Text>
      <Text style={styles.insightSource}>{insight.source}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // Score ring card
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 28,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`,
    ...shadows.card,
  },
  scoreRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 42,
    fontFamily: fonts.bold,
  },
  gradeLabel: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    marginTop: -4,
  },
  scoreTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  completenessHint: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 4,
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`,
    ...shadows.card,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 16,
  },

  // Component rows
  componentRow: {
    marginBottom: 16,
  },
  componentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  componentName: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  componentScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  componentScore: {
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  componentMax: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  componentDetail: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 4,
  },

  // Missing data hints
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  hintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 5,
    marginRight: 10,
  },
  hintText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    flex: 1,
  },

  // History chart
  historyChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 140,
  },
  historyBar: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  historyValue: {
    fontSize: 10,
    fontFamily: fonts.labelMedium,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  historyTrack: {
    flex: 1,
    width: "50%",
    justifyContent: "flex-end",
  },
  historyFill: {
    width: "100%",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 2,
  },
  historyDate: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 6,
  },

  // Insight rows
  insightRow: {
    marginBottom: 20,
  },
  insightTitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  insightBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  insightBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 4,
    marginRight: 10,
    position: "relative",
  },
  insightBarFill: {
    height: "100%" as unknown as number,
    borderRadius: 4,
  },
  insightBarMarker: {
    position: "absolute",
    top: -3,
    width: 3,
    height: 14,
    backgroundColor: colors.textPrimary,
    borderRadius: 1.5,
    marginLeft: -1.5,
  },
  insightPercentile: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    minWidth: 80,
  },
  insightDescription: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  insightSource: {
    fontSize: 10,
    fontFamily: fonts.labelMedium,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: "italic",
  },

  // AI button
  aiButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  aiButtonText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.textOnPrimary,
  },
});
