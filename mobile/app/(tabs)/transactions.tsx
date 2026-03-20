import { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useTransactionsStore } from "../../src/stores/transactions";

export default function TransactionsScreen() {
  const router = useRouter();
  const { transactions, isLoading, isSyncing, error, load, syncAndRefresh } =
    useTransactionsStore();

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading || (isSyncing && transactions.length === 0)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
    );
  }

  if (transactions.length === 0 && !error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No transactions yet</Text>
        <Text style={styles.emptyHint}>
          Connect a bank account and pull down to sync
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && <Text style={styles.errorText}>{error}</Text>}
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
          <TouchableOpacity onPress={() => router.push(`/transaction/${item.id}`)}>
            <TransactionRow txn={item} />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.listContent}
      />
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
});
