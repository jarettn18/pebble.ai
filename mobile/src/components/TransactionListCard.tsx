import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { colors, borderRadius, shadows, fonts } from "../theme";
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

export function TransactionListCard({
  transactions,
  title,
  emptyMessage = "No transactions",
  emptyHint = "No transactions found",
}: Props) {
  const router = useRouter();

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
      {transactions.map((txn, i) => (
        <View key={txn.id}>
          {i > 0 && <TransactionSeparator />}
          <TouchableOpacity
            onPress={() => router.push(`/transaction/${txn.id}`)}
          >
            <TransactionRow txn={txn} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 12,
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
