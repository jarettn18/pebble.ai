import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiRequest } from "../../src/api/client";
import { useTransactionsStore } from "../../src/stores/transactions";
import { useDashboardStore } from "../../src/stores/dashboard";
import { colors, borderRadius, shadows } from "../../src/theme";

type TransactionDetail = {
  id: string;
  account_id: string;
  amount: string;
  date: string;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  category_name: string | null;
  category_id: string | null;
  notes: string | null;
};

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

type CategoryListResponse = {
  categories: Category[];
};

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const updateTransactionCategory = useTransactionsStore(
    (s) => s.updateTransactionCategory
  );
  const removeTransaction = useTransactionsStore((s) => s.removeTransaction);
  const refreshDashboard = useDashboardStore((s) => s.refresh);

  const [txn, setTxn] = useState<TransactionDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [detail, catData] = await Promise.all([
          apiRequest<TransactionDetail>(`/v1/transactions/${id}`),
          apiRequest<CategoryListResponse>("/v1/categories"),
        ]);
        setTxn(detail);
        setNotes(detail.notes || "");
        setSavedNotes(detail.notes || "");
        setCategories(catData.categories);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id]);

  async function handleCategorySelect(category: Category) {
    if (!txn || category.id === txn.category_id) return;

    const prevCategoryId = txn.category_id;
    const prevCategoryName = txn.category_name;

    // Optimistic update
    setTxn({ ...txn, category_id: category.id, category_name: category.name });
    updateTransactionCategory(txn.id, category.name);

    try {
      await apiRequest(`/v1/transactions/${id}`, {
        method: "PATCH",
        body: { category_id: category.id },
      });
      refreshDashboard();
    } catch {
      // Revert on failure
      setTxn({ ...txn, category_id: prevCategoryId, category_name: prevCategoryName });
      updateTransactionCategory(txn.id, prevCategoryName);
    }
  }

  async function handleClearCategory() {
    if (!txn || !txn.category_id) return;

    const prevCategoryId = txn.category_id;
    const prevCategoryName = txn.category_name;

    setTxn({ ...txn, category_id: null, category_name: null });
    updateTransactionCategory(txn.id, null);

    try {
      await apiRequest(`/v1/transactions/${id}`, {
        method: "PATCH",
        body: { category_id: null },
      });
      refreshDashboard();
    } catch {
      setTxn({ ...txn, category_id: prevCategoryId, category_name: prevCategoryName });
      updateTransactionCategory(txn.id, prevCategoryName);
    }
  }

  async function handleSaveNotes() {
    if (!txn) return;
    setIsSaving(true);
    try {
      const updated = await apiRequest<TransactionDetail>(
        `/v1/transactions/${id}`,
        { method: "PATCH", body: { notes: notes || null } }
      );
      setSavedNotes(updated.notes || "");
      setTxn(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeTransaction(id!);
              router.back();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Failed to delete"
              );
            }
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !txn) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || "Transaction not found"}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const amount = parseFloat(txn.amount);
  const isDebit = amount > 0;
  const displayAmount = isDebit
    ? `-$${amount.toFixed(2)}`
    : `+$${Math.abs(amount).toFixed(2)}`;
  const notesChanged = notes !== savedNotes;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>{"\u2190"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction Detail</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Amount */}
        <Text style={[styles.amount, isDebit ? styles.debit : styles.credit]}>
          {displayAmount}
        </Text>

        {/* Info Card */}
        <View style={styles.card}>
          <InfoRow label="Merchant" value={txn.merchant_name || txn.name} />
          <InfoRow label="Description" value={txn.name} />
          <InfoRow label="Type" value={isDebit ? "Expense" : "Income"} />
          <InfoRow label="Date" value={txn.date} />
          {txn.pending && <InfoRow label="Status" value="Pending" />}
        </View>

        {/* Category Section */}
        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.card}>
          {txn.category_name ? (
            <View style={styles.currentCategory}>
              <Text style={styles.currentCategoryText}>{txn.category_name}</Text>
              <TouchableOpacity onPress={handleClearCategory}>
                <Text style={styles.clearBtn}>{"\u2715"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.noCategoryText}>No category assigned</Text>
          )}
          <FlatList
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chipList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.chip,
                  item.id === txn.category_id && styles.chipSelected,
                ]}
                onPress={() => handleCategorySelect(item)}
              >
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: item.color || "#999" },
                  ]}
                />
                <Text
                  style={[
                    styles.chipText,
                    item.id === txn.category_id && styles.chipTextSelected,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Notes Section */}
        <Text style={styles.sectionLabel}>Notes</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
          {notesChanged && (
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveNotes}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.saveBtnText}>Save Notes</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Delete Transaction</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backArrow: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  amount: {
    fontSize: 36,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  debit: {
    color: colors.textPrimary,
  },
  credit: {
    color: colors.income,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  currentCategory: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  currentCategoryText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  clearBtn: {
    fontSize: 16,
    color: colors.textMuted,
    padding: 4,
  },
  noCategoryText: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
  },
  chipList: {
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.textOnPrimary,
  },
  notesInput: {
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },
  saveBtnText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  backBtnText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  deleteBtnText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "600",
  },
});
