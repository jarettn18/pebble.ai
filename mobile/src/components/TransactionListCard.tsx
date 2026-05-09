import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { colors, borderRadius, shadows, fonts, microLabelSmall } from "../theme";
import { formatTransactionDateGroup } from "../utils/date";
import {
  TransactionRow,
  TransactionSeparator,
  Transaction,
} from "./TransactionRow";

type Props = {
  transactions: Transaction[];
  title?: string;
  emptyMessage?: string;
  emptyHint?: string;
};

type DateGroup = {
  key: string;
  label: string;
  transactions: Transaction[];
};

function groupByDate(transactions: Transaction[]): DateGroup[] {
  const groups: DateGroup[] = [];
  let current: DateGroup | null = null;

  for (const txn of transactions) {
    const key = txn.date || "";
    if (!current || current.key !== key) {
      current = {
        key,
        label: formatTransactionDateGroup(key),
        transactions: [],
      };
      groups.push(current);
    }
    current.transactions.push(txn);
  }

  return groups;
}

export const TransactionListCard = memo(function TransactionListCard({
  transactions,
  title,
  emptyMessage = "No transactions",
  emptyHint = "No transactions found",
}: Props) {
  const router = useRouter();
  const groups = useMemo(() => groupByDate(transactions), [transactions]);

  if (transactions.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
        <Text style={styles.emptyHint}>{emptyHint}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {title ?? `Transactions (${transactions.length})`}
      </Text>
      {groups.map((group, gi) => (
        <View key={group.key || `g-${gi}`}>
          <View style={[styles.groupHeader, gi === 0 && styles.groupHeaderFirst]}>
            <Text style={styles.groupHeaderText}>{group.label}</Text>
          </View>
          {group.transactions.map((txn, i) => (
            <View key={txn.id}>
              {i > 0 && <TransactionSeparator />}
              <TouchableOpacity
                onPress={() => router.push(`/transaction/${txn.id}`)}
                activeOpacity={0.7}
              >
                <TransactionRow txn={txn} hideDate />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`,
    ...shadows.card,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  groupHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  groupHeaderFirst: {
    paddingTop: 8,
  },
  groupHeaderText: {
    ...microLabelSmall,
    color: colors.textMuted,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
