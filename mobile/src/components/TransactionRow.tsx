import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

export type Transaction = {
  id: string;
  account_name: string | null;
  amount: string;
  date: string;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  category_name: string | null;
};

export const TransactionRow = memo(function TransactionRow({ txn }: { txn: Transaction }) {
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
          {txn.account_name ? ` · ${txn.account_name}` : ""}
          {txn.category_name ? ` · ${txn.category_name}` : ""}
          {txn.pending ? " · Pending" : ""}
        </Text>
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
    justifyContent: "space-between",
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
    color: colors.textPrimary,
  },
  txnDetail: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  debit: {
    color: colors.textPrimary,
  },
  credit: {
    color: colors.income,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 20,
  },
});
