import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAccountsStore, Account } from "../src/stores/accounts";
import { useDashboardStore } from "../src/stores/dashboard";
import { useTransactionsStore } from "../src/stores/transactions";
import { apiUpload } from "../src/api/client";
import { colors, borderRadius, fonts } from "../src/theme";

type ImportResult = {
  imported: number;
  skipped: number;
  failed: number;
  errors: { row: number; reason: string }[];
};

export default function ImportCSVScreen() {
  const router = useRouter();
  const accounts = useAccountsStore((s) => s.accounts);
  const loadAccounts = useAccountsStore((s) => s.load);
  const refreshDashboard = useDashboardStore((s) => s.refresh);
  const refreshTransactions = useTransactionsStore((s) => s.fetchFiltered);

  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function pickFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/csv", "*/*"],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets.length > 0) {
        const asset = res.assets[0];
        const name = (asset.name || "").toLowerCase();
        if (!name.endsWith(".csv")) {
          setError("Please select a CSV file");
          return;
        }
        setFile(asset);
        setError(null);
        setResult(null);
      }
    } catch {
      setError("Failed to pick file");
    }
  }

  async function handleImport() {
    if (!selectedAccount || !file) return;

    setIsImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name || "import.csv",
        type: "text/csv",
      } as unknown as Blob);
      formData.append("account_id", selectedAccount.id);

      const res = await apiUpload<ImportResult>(
        "/v1/transactions/import-csv",
        formData
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  function handleDone() {
    refreshTransactions();
    refreshDashboard();
    router.back();
  }

  // Show results view after successful import
  if (result) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.resultCard}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={48}
              color={colors.primary}
              style={styles.resultIcon}
            />
            <Text style={styles.resultTitle}>Import Complete</Text>

            <View style={styles.resultRow}>
              <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
              <Text style={styles.resultText}>
                {result.imported} transaction{result.imported !== 1 ? "s" : ""} imported
              </Text>
            </View>

            {result.skipped > 0 && (
              <View style={styles.resultRow}>
                <MaterialCommunityIcons name="skip-next" size={20} color={colors.textMuted} />
                <Text style={styles.resultTextMuted}>
                  {result.skipped} duplicate{result.skipped !== 1 ? "s" : ""} skipped
                </Text>
              </View>
            )}

            {result.failed > 0 && (
              <>
                <TouchableOpacity
                  style={styles.resultRow}
                  onPress={() => setShowErrors(!showErrors)}
                >
                  <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
                  <Text style={styles.resultTextError}>
                    {result.failed} row{result.failed !== 1 ? "s" : ""} failed
                  </Text>
                  <MaterialCommunityIcons
                    name={showErrors ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>

                {showErrors && result.errors.map((e, i) => (
                  <Text key={i} style={styles.errorDetail}>
                    Row {e.row}: {e.reason}
                  </Text>
                ))}
              </>
            )}
          </View>

          <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Account Picker */}
        <Text style={styles.label}>Select Account</Text>
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
                selectedAccount?.id === acct.id && styles.chipSelected,
              ]}
              onPress={() => {
                setSelectedAccount(acct);
                setError(null);
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedAccount?.id === acct.id && styles.chipTextSelected,
                ]}
                numberOfLines={1}
              >
                {acct.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {accounts.length === 0 && (
          <Text style={styles.hintText}>
            No accounts found. Add an account first.
          </Text>
        )}

        {/* File Picker */}
        <Text style={[styles.label, { marginTop: 24 }]}>CSV File</Text>
        <TouchableOpacity style={styles.filePicker} onPress={pickFile}>
          <MaterialCommunityIcons
            name={file ? "file-check-outline" : "file-upload-outline"}
            size={32}
            color={file ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.filePickerText, file && { color: colors.textPrimary }]}>
            {file ? file.name : "Tap to select a CSV file"}
          </Text>
          {file && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setFile(null);
                setResult(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <Text style={styles.hintText}>
          Supported columns: date, description, amount (or debit/credit), category
        </Text>

        {/* Import Button */}
        <TouchableOpacity
          style={[
            styles.importBtn,
            (!selectedAccount || !file) && styles.importBtnDisabled,
          ]}
          onPress={handleImport}
          disabled={!selectedAccount || !file || isImporting}
        >
          {isImporting ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.importBtnText}>Import Transactions</Text>
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
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
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
  filePicker: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filePickerText: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
  },
  hintText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    padding: 12,
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.sm,
  },
  importBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
  },
  importBtnDisabled: {
    opacity: 0.5,
  },
  importBtnText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 24,
    alignItems: "center",
    marginTop: 16,
  },
  resultIcon: {
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    width: "100%",
  },
  resultText: {
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
  },
  resultTextMuted: {
    fontSize: 15,
    color: colors.textMuted,
    flex: 1,
  },
  resultTextError: {
    fontSize: 15,
    color: colors.error,
    flex: 1,
  },
  errorDetail: {
    fontSize: 12,
    color: colors.textMuted,
    paddingLeft: 28,
    paddingVertical: 2,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  doneBtnText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
});
