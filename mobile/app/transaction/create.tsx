import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAccountsStore, Account } from "../../src/stores/accounts";
import { useTransactionsStore } from "../../src/stores/transactions";
import { apiRequest } from "../../src/api/client";
import { colors, borderRadius, fonts } from "../../src/theme";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export default function CreateTransactionScreen() {
  const router = useRouter();
  const { accounts, load: loadAccounts } = useAccountsStore();
  const addTransaction = useTransactionsStore((s) => s.addTransaction);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [amount, setAmount] = useState("");
  const [isExpense, setIsExpense] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [name, setName] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
    apiRequest<{ categories: Category[] }>("/v1/categories").then((data) =>
      setCategories(data.categories)
    );
  }, [loadAccounts]);

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(accounts[0]);
    }
  }, [accounts, selectedAccount]);

  async function handleSave() {
    if (!selectedAccount) {
      setError("Select an account");
      return;
    }
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!amount.trim() || isNaN(parseFloat(amount))) {
      setError("Enter a valid amount");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Date must be YYYY-MM-DD");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const rawAmount = Math.abs(parseFloat(amount.trim()));
      const finalAmount = isExpense ? rawAmount : -rawAmount;
      await addTransaction({
        account_id: selectedAccount.id,
        amount: finalAmount.toFixed(2),
        date,
        name: name.trim(),
        merchant_name: merchantName.trim() || null,
        category_id: selectedCategoryId,
        notes: notes.trim() || null,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>{"\u2190"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Transaction</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Account Picker */}
        <Text style={styles.label}>Account</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
        >
          {accounts.map((acct) => (
            <TouchableOpacity
              key={acct.id}
              style={[
                styles.chip,
                acct.id === selectedAccount?.id && styles.chipSelected,
              ]}
              onPress={() => setSelectedAccount(acct)}
            >
              <Text
                style={[
                  styles.chipText,
                  acct.id === selectedAccount?.id && styles.chipTextSelected,
                ]}
              >
                {acct.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Type Toggle */}
        <Text style={styles.label}>Type</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, isExpense && styles.toggleBtnActive]}
            onPress={() => setIsExpense(true)}
          >
            <Text
              style={[
                styles.toggleBtnText,
                isExpense && styles.toggleBtnTextActive,
              ]}
            >
              Expense
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !isExpense && styles.toggleBtnIncome]}
            onPress={() => setIsExpense(false)}
          >
            <Text
              style={[
                styles.toggleBtnText,
                !isExpense && styles.toggleBtnTextActive,
              ]}
            >
              Income
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="e.g. 42.50"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
        />

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
        />

        {/* Name */}
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Transaction name"
          placeholderTextColor={colors.textMuted}
        />

        {/* Merchant */}
        <Text style={styles.label}>Merchant (optional)</Text>
        <TextInput
          style={styles.input}
          value={merchantName}
          onChangeText={setMerchantName}
          placeholder="Merchant name"
          placeholderTextColor={colors.textMuted}
        />

        {/* Category */}
        <Text style={styles.label}>Category (optional)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.chip,
                cat.id === selectedCategoryId && styles.chipSelected,
              ]}
              onPress={() =>
                setSelectedCategoryId(
                  cat.id === selectedCategoryId ? null : cat.id
                )
              }
            >
              <View
                style={[
                  styles.chipDot,
                  { backgroundColor: cat.color || colors.dotInactive },
                ]}
              />
              <Text
                style={[
                  styles.chipText,
                  cat.id === selectedCategoryId && styles.chipTextSelected,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Notes */}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add a note..."
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>Add Transaction</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    fontFamily: fonts.semiBold,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 14,
    fontSize: 14,
    color: colors.textPrimary,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.textOnPrimary,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleBtnIncome: {
    backgroundColor: colors.income,
  },
  toggleBtnText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  toggleBtnTextActive: {
    color: colors.textOnPrimary,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    padding: 12,
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.sm,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
});
