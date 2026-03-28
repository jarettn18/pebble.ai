import React, { memo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
import { colors, fonts, borderRadius } from "../theme";

type MonthYear = { month: number; year: number };

type Props = {
  selected: MonthYear[];
  onSelectionChange: (months: MonthYear[]) => void;
  untilTurnOff: boolean;
  onUntilTurnOffChange: (val: boolean) => void;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function getUpcomingMonths(count: number): MonthYear[] {
  const now = new Date();
  const months: MonthYear[] = [];
  let m = now.getMonth(); // 0-indexed
  let y = now.getFullYear();
  for (let i = 0; i < count; i++) {
    months.push({ month: m + 1, year: y }); // convert to 1-indexed
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return months;
}

function isSelected(m: MonthYear, selected: MonthYear[]): boolean {
  return selected.some((s) => s.month === m.month && s.year === m.year);
}

export default memo(function MonthPicker({
  selected,
  onSelectionChange,
  untilTurnOff,
  onUntilTurnOffChange,
}: Props) {
  const [showYear, setShowYear] = useState(new Date().getFullYear());
  const upcoming = getUpcomingMonths(12);

  function toggleMonth(m: MonthYear) {
    if (untilTurnOff) return; // disabled when recurring
    if (isSelected(m, selected)) {
      onSelectionChange(
        selected.filter((s) => !(s.month === m.month && s.year === m.year))
      );
    } else {
      onSelectionChange([...selected, m]);
    }
  }

  function handleUntilToggle(val: boolean) {
    onUntilTurnOffChange(val);
    if (val) {
      // Auto-select current month only
      const now = new Date();
      onSelectionChange([
        { month: now.getMonth() + 1, year: now.getFullYear() },
      ]);
    }
  }

  return (
    <View style={styles.container}>
      {/* Until I turn off toggle */}
      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.toggleLabel}>Until I turn off</Text>
          <Text style={styles.toggleHint}>
            Auto-generates each month
          </Text>
        </View>
        <Switch
          value={untilTurnOff}
          onValueChange={handleUntilToggle}
          trackColor={{ false: colors.border, true: colors.primaryLight }}
          thumbColor={untilTurnOff ? colors.primary : "#f4f3f4"}
        />
      </View>

      {/* Month grid */}
      {!untilTurnOff && (
        <View style={styles.grid}>
          {upcoming.map((m) => {
            const sel = isSelected(m, selected);
            return (
              <TouchableOpacity
                key={`${m.year}-${m.month}`}
                style={[styles.monthCell, sel && styles.monthCellSelected]}
                onPress={() => toggleMonth(m)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.monthText, sel && styles.monthTextSelected]}
                >
                  {MONTH_NAMES[m.month - 1]}
                </Text>
                <Text
                  style={[styles.yearText, sel && styles.yearTextSelected]}
                >
                  {m.year}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {untilTurnOff && (
        <View style={styles.recurringNote}>
          <Text style={styles.recurringNoteText}>
            Budget will be created for the current month and automatically
            generated for each future month.
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {},
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  toggleHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  monthCell: {
    width: "30%",
    paddingVertical: 14,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  monthCellSelected: {
    backgroundColor: colors.primary,
  },
  monthText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  monthTextSelected: {
    color: colors.textOnPrimary,
  },
  yearText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  yearTextSelected: {
    color: colors.textOnPrimary,
    opacity: 0.8,
  },
  recurringNote: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.sm,
    padding: 16,
  },
  recurringNoteText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
