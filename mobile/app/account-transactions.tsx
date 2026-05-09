import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiRequest } from "../src/api/client";
import { formatCurrency } from "../src/utils/dashboard";
import { colors, borderRadius, shadows, fonts } from "../src/theme";
import { Transaction } from "../src/components/TransactionRow";
import { TransactionListCard } from "../src/components/TransactionListCard";
import { useAccountsStore } from "../src/stores/accounts";
import { useDashboardStore } from "../src/stores/dashboard";

const HIT_SLOP_8 = { top: 8, bottom: 8, left: 8, right: 8 };

export default function AccountTransactionsScreen() {
  const params = useLocalSearchParams<{ account_id: string }>();
  const accountId = params.account_id;

  const accounts = useAccountsStore((s) => s.accounts);
  const loadAccounts = useAccountsStore((s) => s.load);
  const updateNickname = useAccountsStore((s) => s.updateNickname);
  const refreshDashboard = useDashboardStore((s) => s.refresh);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const account = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  );

  const displayName = account?.nickname ?? account?.name ?? "Account";
  const balanceCurrent = account?.balance_current
    ? parseFloat(account.balance_current)
    : null;
  const accountType = account?.type ?? "";
  const institutionName = account?.institution_name ?? "";
  const mask = account?.mask ?? null;
  const isDebt = accountType === "credit" || accountType === "loan";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSaving, setRenameSaving] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!accountId) return;
    const data = await apiRequest<{ transactions: Transaction[] }>(
      `/v1/transactions?account_id=${accountId}&limit=200`
    );
    setTransactions(data.transactions);
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchTransactions().finally(() => setIsLoading(false));
    }, [fetchTransactions])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  }, [fetchTransactions]);

  const openRename = useCallback(() => {
    setRenameValue(account?.nickname ?? "");
    setRenameError(null);
    setRenameOpen(true);
  }, [account?.nickname]);

  const closeRename = useCallback(() => {
    if (renameSaving) return;
    setRenameOpen(false);
  }, [renameSaving]);

  const submitRename = useCallback(async () => {
    if (!accountId) return;
    setRenameSaving(true);
    setRenameError(null);
    try {
      await updateNickname(accountId, renameValue.trim());
      await refreshDashboard();
      setRenameOpen(false);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Failed to rename");
    } finally {
      setRenameSaving(false);
    }
  }, [accountId, renameValue, updateNickname, refreshDashboard]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Account Summary Card */}
      <View style={styles.card}>
        {institutionName ? (
          <Text style={styles.cardSubtitle}>{institutionName}</Text>
        ) : null}
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
            {displayName}
            {mask ? ` ··${mask}` : ""}
          </Text>
          {account ? (
            <TouchableOpacity
              onPress={openRename}
              hitSlop={HIT_SLOP_8}
              accessibilityLabel="Rename account"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          ) : null}
        </View>
        {balanceCurrent !== null && (
          <Text style={[styles.totalAmount, isDebt && styles.debtAmount]}>
            {isDebt ? "-" : ""}
            {formatCurrency(balanceCurrent)}
          </Text>
        )}
      </View>

      {/* Transactions */}
      {isLoading && (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 32 }}
        />
      )}

      {!isLoading && (
        <TransactionListCard
          transactions={transactions}
          emptyMessage="No transactions"
          emptyHint="No transactions found for this account"
        />
      )}

      <Modal
        visible={renameOpen}
        transparent
        animationType="fade"
        onRequestClose={closeRename}
      >
        <Pressable style={styles.modalScrim} onPress={closeRename}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalCenter}
          >
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Rename account</Text>
              <Text style={styles.modalHint}>
                Give this account a custom name. Leave blank to use the default.
              </Text>
              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder={account?.name ?? "Account name"}
                placeholderTextColor={colors.textMuted}
                style={styles.modalInput}
                autoFocus
                maxLength={64}
                returnKeyType="done"
                onSubmitEditing={submitRename}
                editable={!renameSaving}
              />
              {renameError ? (
                <Text style={styles.modalError}>{renameError}</Text>
              ) : null}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  onPress={closeRename}
                  disabled={renameSaving}
                >
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    styles.modalBtnPrimary,
                    renameSaving && styles.modalBtnDisabled,
                  ]}
                  onPress={submitRename}
                  disabled={renameSaving}
                >
                  {renameSaving ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.modalBtnPrimaryText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </ScrollView>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}1A`,
    ...shadows.card,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  totalAmount: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  debtAmount: {
    color: colors.negative,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalCenter: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    ...shadows.card,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  modalHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceContainerLow,
  },
  modalError: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.error,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
  },
  modalBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnGhost: {
    backgroundColor: "transparent",
  },
  modalBtnGhostText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  modalBtnPrimary: {
    backgroundColor: colors.primary,
    minWidth: 96,
  },
  modalBtnPrimaryText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textOnPrimary,
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
});
