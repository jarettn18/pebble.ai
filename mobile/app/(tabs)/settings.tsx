import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/stores/auth";
import { colors, borderRadius, shadows } from "../../src/theme";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

const MARITAL_OPTIONS = ["single", "married", "divorced", "widowed", "separated"];

const GOAL_OPTIONS = [
  { value: "emergency_fund", label: "Emergency Fund" },
  { value: "debt_payoff", label: "Debt Payoff" },
  { value: "home_purchase", label: "Home Purchase" },
  { value: "retirement", label: "Retirement" },
  { value: "investing", label: "Investing" },
  { value: "education", label: "Education" },
  { value: "travel", label: "Travel" },
  { value: "savings", label: "General Savings" },
];

function formatIncome(val: string) {
  const num = parseInt(val.replace(/[^0-9]/g, ""), 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US");
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SettingsScreen() {
  const { user, logout, updateProfile } = useAuthStore();

  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingFinancial, setEditingFinancial] = useState(false);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth ?? "");
  const [occupation, setOccupation] = useState(user?.occupation ?? "");
  const [annualIncome, setAnnualIncome] = useState(
    user?.annual_income != null ? String(user.annual_income) : ""
  );
  const [state, setState] = useState(user?.state ?? "");
  const [maritalStatus, setMaritalStatus] = useState(user?.marital_status ?? "");
  const [dependents, setDependents] = useState(
    user?.dependents != null ? String(user.dependents) : "0"
  );
  const [financialGoals, setFinancialGoals] = useState<string[]>(
    user?.financial_goals ?? []
  );

  const [isSaving, setIsSaving] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);

  // Reset form state when user data changes (e.g. after save)
  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name ?? "");
    setDateOfBirth(user.date_of_birth ?? "");
    setOccupation(user.occupation ?? "");
    setAnnualIncome(user.annual_income != null ? String(user.annual_income) : "");
    setState(user.state ?? "");
    setMaritalStatus(user.marital_status ?? "");
    setDependents(user.dependents != null ? String(user.dependents) : "0");
    setFinancialGoals(user.financial_goals ?? []);
  }, [user]);

  const toggleGoal = useCallback((goal: string) => {
    setFinancialGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  }, []);

  const resetPersonal = () => {
    setFullName(user?.full_name ?? "");
    setDateOfBirth(user?.date_of_birth ?? "");
    setOccupation(user?.occupation ?? "");
    setState(user?.state ?? "");
    setMaritalStatus(user?.marital_status ?? "");
    setDependents(user?.dependents != null ? String(user.dependents) : "0");
    setShowStatePicker(false);
  };

  const resetFinancial = () => {
    setAnnualIncome(user?.annual_income != null ? String(user.annual_income) : "");
    setFinancialGoals(user?.financial_goals ?? []);
  };

  const hasPersonalChanges =
    fullName !== (user?.full_name ?? "") ||
    dateOfBirth !== (user?.date_of_birth ?? "") ||
    occupation !== (user?.occupation ?? "") ||
    state !== (user?.state ?? "") ||
    maritalStatus !== (user?.marital_status ?? "") ||
    dependents !== (user?.dependents != null ? String(user.dependents) : "0");

  const hasFinancialChanges =
    annualIncome !== (user?.annual_income != null ? String(user.annual_income) : "") ||
    JSON.stringify(financialGoals) !== JSON.stringify(user?.financial_goals ?? []);

  const handleSavePersonal = async () => {
    setIsSaving(true);
    try {
      const data: Record<string, unknown> = {};
      if (fullName !== (user?.full_name ?? "")) data.full_name = fullName;
      if (dateOfBirth !== (user?.date_of_birth ?? ""))
        data.date_of_birth = dateOfBirth || null;
      if (occupation !== (user?.occupation ?? ""))
        data.occupation = occupation || null;
      if (state !== (user?.state ?? "")) data.state = state || null;
      if (maritalStatus !== (user?.marital_status ?? ""))
        data.marital_status = maritalStatus || null;
      if (dependents !== (user?.dependents != null ? String(user.dependents) : "0"))
        data.dependents = dependents ? parseInt(dependents, 10) : 0;

      if (Object.keys(data).length > 0) await updateProfile(data);
      setEditingPersonal(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save profile";
      Alert.alert("Error", message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFinancial = async () => {
    setIsSaving(true);
    try {
      const data: Record<string, unknown> = {};
      if (annualIncome !== (user?.annual_income != null ? String(user.annual_income) : ""))
        data.annual_income = annualIncome ? parseInt(annualIncome, 10) : null;
      if (JSON.stringify(financialGoals) !== JSON.stringify(user?.financial_goals ?? []))
        data.financial_goals = financialGoals.length > 0 ? financialGoals : null;

      if (Object.keys(data).length > 0) await updateProfile(data);
      setEditingFinancial(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save profile";
      Alert.alert("Error", message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  const displayValue = (val: string | null | undefined, placeholder = "Not set") =>
    val || placeholder;

  const goalsLabel =
    financialGoals.length > 0
      ? financialGoals
          .map((g) => GOAL_OPTIONS.find((o) => o.value === g)?.label ?? g)
          .join(", ")
      : "Not set";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Header */}
        <View style={styles.card}>
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {user?.subscription_tier?.toUpperCase()} PLAN
            </Text>
          </View>
        </View>

        {/* Personal Info */}
        <SectionHeader
          title="Personal Information"
          editing={editingPersonal}
          onEdit={() => setEditingPersonal(true)}
        />
        <View style={styles.card}>
          {editingPersonal ? (
            <>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Date of Birth</Text>
              <TextInput
                style={styles.input}
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.label}>Occupation</Text>
              <TextInput
                style={styles.input}
                value={occupation}
                onChangeText={setOccupation}
                placeholder="e.g. Software Engineer"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>State of Residency</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowStatePicker(!showStatePicker)}
              >
                <Text
                  style={[styles.inputText, !state && { color: colors.textMuted }]}
                >
                  {state || "Select state"}
                </Text>
              </TouchableOpacity>
              {showStatePicker && (
                <View style={styles.chipGrid}>
                  {US_STATES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.stateChip, state === s && styles.stateChipActive]}
                      onPress={() => {
                        setState(s);
                        setShowStatePicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.stateChipText,
                          state === s && styles.stateChipTextActive,
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Marital Status</Text>
              <View style={styles.chipRow}>
                {MARITAL_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, maritalStatus === opt && styles.chipActive]}
                    onPress={() =>
                      setMaritalStatus(maritalStatus === opt ? "" : opt)
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        maritalStatus === opt && styles.chipTextActive,
                      ]}
                    >
                      {capitalize(opt)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Dependents</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() =>
                    setDependents(String(Math.max(0, parseInt(dependents || "0", 10) - 1)))
                  }
                >
                  <Text style={styles.stepperText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{dependents || "0"}</Text>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() =>
                    setDependents(String(parseInt(dependents || "0", 10) + 1))
                  }
                >
                  <Text style={styles.stepperText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.saveButton, (isSaving || !hasPersonalChanges) && { opacity: 0.5 }]}
                  onPress={handleSavePersonal}
                  disabled={isSaving || !hasPersonalChanges}
                >
                  {isSaving ? (
                    <ActivityIndicator color={colors.textOnPrimary} size="small" />
                  ) : (
                    <Text style={styles.saveText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    resetPersonal();
                    setEditingPersonal(false);
                  }}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <FieldRow label="Full Name" value={displayValue(fullName)} />
              <FieldRow label="Date of Birth" value={displayValue(dateOfBirth)} />
              <FieldRow label="Occupation" value={displayValue(occupation)} />
              <FieldRow label="State" value={displayValue(state)} />
              <FieldRow
                label="Marital Status"
                value={displayValue(maritalStatus ? capitalize(maritalStatus) : "")}
              />
              <FieldRow label="Dependents" value={dependents || "0"} last />
            </>
          )}
        </View>

        {/* Financial Info */}
        <SectionHeader
          title="Financial Information"
          editing={editingFinancial}
          onEdit={() => setEditingFinancial(true)}
        />
        <View style={styles.card}>
          {editingFinancial ? (
            <>
              <Text style={styles.label}>Annual Income</Text>
              <View style={styles.incomeRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={formatIncome(annualIncome)}
                  onChangeText={(val) =>
                    setAnnualIncome(val.replace(/[^0-9]/g, ""))
                  }
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
              </View>

              <Text style={styles.label}>Financial Goals</Text>
              <View style={styles.chipRow}>
                {GOAL_OPTIONS.map((goal) => (
                  <TouchableOpacity
                    key={goal.value}
                    style={[
                      styles.chip,
                      financialGoals.includes(goal.value) && styles.chipActive,
                    ]}
                    onPress={() => toggleGoal(goal.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        financialGoals.includes(goal.value) && styles.chipTextActive,
                      ]}
                    >
                      {goal.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.saveButton, (isSaving || !hasFinancialChanges) && { opacity: 0.5 }]}
                  onPress={handleSaveFinancial}
                  disabled={isSaving || !hasFinancialChanges}
                >
                  {isSaving ? (
                    <ActivityIndicator color={colors.textOnPrimary} size="small" />
                  ) : (
                    <Text style={styles.saveText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    resetFinancial();
                    setEditingFinancial(false);
                  }}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <FieldRow
                label="Annual Income"
                value={annualIncome ? `$${formatIncome(annualIncome)}` : "Not set"}
              />
              <FieldRow label="Financial Goals" value={goalsLabel} last />
            </>
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Section header with pencil icon */
function SectionHeader({
  title,
  editing,
  onEdit,
}: {
  title: string;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!editing && (
        <TouchableOpacity onPress={onEdit} hitSlop={8}>
          <MaterialCommunityIcons
            name="pencil-outline"
            size={18}
            color={colors.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Read-only field row for view mode */
function FieldRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const isPlaceholder = value === "Not set";
  return (
    <View style={[styles.fieldRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text
        style={[styles.fieldValue, isPlaceholder && { color: colors.textMuted }]}
        numberOfLines={2}
      >
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
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 16,
    ...shadows.card,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceGreen,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 8,
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  // -- View mode field rows --
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "right",
    flexShrink: 1,
    marginLeft: 16,
  },
  // -- Edit mode inputs --
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  stateChip: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 42,
    alignItems: "center",
  },
  stateChipActive: {
    backgroundColor: colors.primary,
  },
  stateChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  stateChipTextActive: {
    color: colors.textOnPrimary,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  stepperButton: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    minWidth: 24,
    textAlign: "center",
  },
  incomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dollarSign: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: "600",
  },
});
