import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../theme";
import { withOpacity } from "../utils/color";
import { getCategoryIcon } from "../utils/categoryIcons";

export type Transaction = {
  id: string;
  account_name: string | null;
  amount: string;
  date: string;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  category_name: string | null;
  category_color: string | null;
};

type TransactionRowProps = {
  txn: Transaction;
  /** When true, hide the date in the metadata line (e.g. when the parent list groups by date). */
  hideDate?: boolean;
};

export const TransactionRow = memo(function TransactionRow({
  txn,
  hideDate = false,
}: TransactionRowProps) {
  const amount = parseFloat(txn.amount);
  const isDebit = amount > 0;
  const displayAmount = isDebit
    ? `-$${amount.toFixed(2)}`
    : `+$${Math.abs(amount).toFixed(2)}`;

  const categoryName = txn.category_name ?? "Uncategorized";
  const categoryColor = txn.category_color || colors.textMuted;

  const metaParts: string[] = [];
  if (!hideDate) metaParts.push(txn.date);
  if (txn.category_name) metaParts.push(txn.category_name);
  if (txn.account_name) metaParts.push(txn.account_name);
  const metaLine = metaParts.join(" · ");

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: withOpacity(categoryColor, 0.15) },
        ]}
      >
        <MaterialCommunityIcons
          name={getCategoryIcon(categoryName) as any}
          size={20}
          color={categoryColor}
        />
      </View>

      <View style={styles.rowMain}>
        <View style={styles.titleLine}>
          <Text style={styles.txnName} numberOfLines={1}>
            {txn.merchant_name || txn.name}
          </Text>
          {txn.pending && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>Pending</Text>
            </View>
          )}
        </View>
        {metaLine ? (
          <Text style={styles.txnDetail} numberOfLines={1}>
            {metaLine}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.txnAmount, isDebit ? styles.debit : styles.credit]}>
        {displayAmount}
      </Text>
    </View>
  );
});

export function TransactionSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: {
    flex: 1,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  txnName: {
    flexShrink: 1,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.surfaceContainerHigh,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontFamily: fonts.labelMedium,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  txnDetail: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 15,
    fontFamily: fonts.bold,
    letterSpacing: -0.2,
    fontVariant: ["tabular-nums"],
  },
  debit: {
    color: colors.textPrimary,
  },
  credit: {
    color: colors.incomePositive,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 72, // align with text after the 40px avatar + 12px gap + 20px row inset
  },
});
