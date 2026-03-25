import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { apiRequest } from "../../src/api/client";
import { useBudgetsStore } from "../../src/stores/budgets";
import { useBudgetPlansStore } from "../../src/stores/budgetPlans";
import { colors, fonts, borderRadius } from "../../src/theme";
import { formatCurrency } from "../../src/utils/dashboard";
import MonthPicker from "../../src/components/MonthPicker";
import CategoryAllocation, {
  type AllocationEntry,
} from "../../src/components/CategoryAllocation";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

type MonthYear = { month: number; year: number };

const STEPS = ["Total Budget", "Allocate", "Duration", "Review"] as const;

export default function BudgetPlanCreateScreen() {
  const router = useRouter();
  const budgetsRefresh = useBudgetsStore((s) => s.refresh);
  const plansRefresh = useBudgetPlansStore((s) => s.refresh);

  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Total budget
  const [totalAmount, setTotalAmount] = useState("");
  const [planName, setPlanName] = useState("");

  // Step 2: Allocations
  const [allocations, setAllocations] = useState<AllocationEntry[]>([]);

  // Step 3: Duration
  const [selectedMonths, setSelectedMonths] = useState<MonthYear[]>([]);
  const [untilTurnOff, setUntilTurnOff] = useState(false);

  useEffect(() => {
    apiRequest<{ categories: Category[] }>("/v1/categories")
      .then((data) => setCategories(data.categories))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load categories")
      )
      .finally(() => setIsLoadingCategories(false));
  }, []);

  const totalParsed = parseFloat(totalAmount) || 0;
  const allocatedTotal = allocations.reduce(
    (sum, a) => sum + (parseFloat(a.amount) || 0),
    0
  );

  function canAdvance(): boolean {
    switch (step) {
      case 0:
        return totalParsed > 0;
      case 1:
        return allocations.length > 0 && allocatedTotal > 0;
      case 2:
        return selectedMonths.length > 0 || untilTurnOff;
      default:
        return true;
    }
  }

  function next() {
    setError(null);
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  function back() {
    setError(null);
    if (step > 0) setStep(step - 1);
    else router.back();
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      await apiRequest("/v1/budget-plans", {
        method: "POST",
        body: {
          name: planName || null,
          total_amount: totalParsed.toFixed(2),
          allocations: allocations.map((a) => ({
            category_id: a.category_id,
            amount: parseFloat(a.amount).toFixed(2),
          })),
          months: untilTurnOff ? [] : selectedMonths,
          is_recurring: untilTurnOff,
        },
      });
      await Promise.all([budgetsRefresh(), plansRefresh()]);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoadingCategories) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={back} hitSlop={12}>
          <Text style={styles.backArrow}>{"\u2190"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Budget Plan</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Step indicators */}
      <View style={styles.stepRow}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                i <= step && styles.stepDotActive,
                i < step && styles.stepDotCompleted,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  i <= step && styles.stepNumberActive,
                ]}
              >
                {i < step ? "\u2713" : i + 1}
              </Text>
            </View>
            <Text
              style={[styles.stepLabel, i <= step && styles.stepLabelActive]}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: Total Budget */}
        {step === 0 && (
          <View>
            <Text style={styles.stepTitle}>Set your total monthly budget</Text>
            <Text style={styles.stepDescription}>
              How much do you want to spend per month?
            </Text>

            <View style={styles.card}>
              <View style={styles.amountRow}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                  placeholder="3,000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  autoFocus
                />
              </View>
              <Text style={styles.amountHint}>per month</Text>
            </View>

            <Text style={styles.sectionLabel}>Plan Name (optional)</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.nameInput}
                value={planName}
                onChangeText={setPlanName}
                placeholder="e.g. Monthly Essentials"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
              />
            </View>
          </View>
        )}

        {/* Step 2: Allocate by Category */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Allocate by category</Text>
            <Text style={styles.stepDescription}>
              Distribute {formatCurrency(totalParsed)} across your spending
              categories. You don't have to assign every dollar.
            </Text>

            <CategoryAllocation
              categories={categories}
              allocations={allocations}
              totalBudget={totalParsed}
              onAllocationsChange={setAllocations}
            />
          </View>
        )}

        {/* Step 3: Select Duration */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Select duration</Text>
            <Text style={styles.stepDescription}>
              Choose which months this budget applies to.
            </Text>

            <MonthPicker
              selected={selectedMonths}
              onSelectionChange={setSelectedMonths}
              untilTurnOff={untilTurnOff}
              onUntilTurnOffChange={setUntilTurnOff}
            />
          </View>
        )}

        {/* Step 4: Review */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Review your budget plan</Text>

            <View style={styles.reviewCard}>
              {planName ? (
                <Text style={styles.reviewPlanName}>{planName}</Text>
              ) : null}
              <Text style={styles.reviewLabel}>TOTAL BUDGET</Text>
              <Text style={styles.reviewAmount}>
                {formatCurrency(totalParsed)}/mo
              </Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>ALLOCATIONS</Text>
              {allocations.map((a) => {
                const cat = categories.find((c) => c.id === a.category_id);
                return (
                  <View key={a.category_id} style={styles.reviewAllocRow}>
                    <Text style={styles.reviewAllocName}>
                      {cat?.name || "Unknown"}
                    </Text>
                    <Text style={styles.reviewAllocAmount}>
                      {formatCurrency(parseFloat(a.amount) || 0)}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.reviewDivider} />
              <View style={styles.reviewAllocRow}>
                <Text style={styles.reviewAllocName}>Allocated</Text>
                <Text style={styles.reviewAllocAmount}>
                  {formatCurrency(allocatedTotal)}
                </Text>
              </View>
              {totalParsed - allocatedTotal > 0 && (
                <View style={styles.reviewAllocRow}>
                  <Text style={[styles.reviewAllocName, { color: colors.textMuted }]}>
                    Unallocated
                  </Text>
                  <Text style={[styles.reviewAllocAmount, { color: colors.textMuted }]}>
                    {formatCurrency(totalParsed - allocatedTotal)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>DURATION</Text>
              <Text style={styles.reviewDuration}>
                {untilTurnOff
                  ? "Recurring \u2014 Until turned off"
                  : selectedMonths
                      .map((m) =>
                        new Date(m.year, m.month - 1).toLocaleDateString(
                          "en-US",
                          { month: "short", year: "numeric" }
                        )
                      )
                      .join(", ")}
              </Text>
            </View>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      {/* Bottom buttons */}
      <View style={styles.footer}>
        {step < STEPS.length - 1 ? (
          <TouchableOpacity
            style={[styles.primaryBtn, !canAdvance() && styles.btnDisabled]}
            onPress={next}
            disabled={!canAdvance()}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, isSaving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Create Budget Plan</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
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
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },

  // Steps
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.background,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepDotCompleted: {
    backgroundColor: colors.primaryLight,
  },
  stepNumber: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  stepNumberActive: {
    color: colors.textOnPrimary,
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: fonts.labelMedium,
    color: colors.textMuted,
  },
  stepLabelActive: {
    color: colors.primary,
  },

  // Body
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginBottom: 24,
    lineHeight: 22,
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },

  // Amount input
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  amountPrefix: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  amountHint: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 8,
  },
  nameInput: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },

  // Review
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 16,
  },
  reviewPlanName: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  reviewLabel: {
    fontSize: 11,
    fontFamily: fonts.labelMedium,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginBottom: 8,
  },
  reviewAmount: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  reviewAllocRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  reviewAllocName: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  reviewAllocAmount: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  reviewDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  reviewDuration: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },

  // Error
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },

  // Footer
  footer: {
    padding: 24,
    paddingBottom: 36,
    backgroundColor: colors.background,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    padding: 16,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
});
