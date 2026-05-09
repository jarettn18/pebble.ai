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
import { colors, fonts, borderRadius, heroCard, shadows, microLabel, microLabelSmall } from "../../src/theme";
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
        <ActivityIndicator size="large" color={colors.accent} />
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

      {/* Step indicators — connected progress bar */}
      <View style={styles.stepRow}>
        <View style={styles.stepProgressMeta}>
          <Text style={styles.stepEyebrow}>
            STEP {step + 1} OF {STEPS.length}
          </Text>
          <Text style={styles.stepCurrentLabel}>{STEPS[step]}</Text>
        </View>
        <View style={styles.stepTrack}>
          <View
            style={[
              styles.stepFill,
              { width: `${((step + 1) / STEPS.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: Total Budget */}
        {step === 0 && (
          <View>
            <Text style={styles.stepTitle}>Set your monthly budget</Text>
            <Text style={styles.stepDescription}>
              How much do you want to spend each month?
            </Text>

            <View style={styles.amountHero}>
              <View style={styles.amountHeroGlow} />
              <Text style={styles.amountHeroLabel}>TOTAL BUDGET</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                  placeholder="3,000"
                  placeholderTextColor={colors.heroPlaceholder}
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
            <Text style={styles.stepTitle}>Review your plan</Text>
            <Text style={styles.stepDescription}>
              One last look before we create it.
            </Text>

            <View style={styles.reviewHero}>
              <View style={styles.reviewHeroGlow} />
              {planName ? (
                <Text style={styles.reviewPlanName}>{planName}</Text>
              ) : null}
              <Text style={styles.reviewHeroLabel}>TOTAL BUDGET</Text>
              <Text style={styles.reviewHeroAmount}>
                {formatCurrency(totalParsed)}
                <Text style={styles.reviewHeroPerMo}>/mo</Text>
              </Text>
              <View style={styles.reviewHeroDivider} />
              <View style={styles.reviewHeroMetaRow}>
                <View style={styles.reviewHeroMetaItem}>
                  <Text style={styles.reviewHeroMetaLabel}>ALLOCATED</Text>
                  <Text style={styles.reviewHeroMetaValue}>
                    {formatCurrency(allocatedTotal)}
                  </Text>
                </View>
                <View style={styles.reviewHeroMetaItem}>
                  <Text style={styles.reviewHeroMetaLabel}>UNALLOCATED</Text>
                  <Text
                    style={[
                      styles.reviewHeroMetaValue,
                      totalParsed - allocatedTotal > 0 && { color: colors.accent },
                    ]}
                  >
                    {formatCurrency(Math.max(0, totalParsed - allocatedTotal))}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Allocations</Text>
            <View style={styles.reviewCard}>
              {allocations.map((a, idx) => {
                const cat = categories.find((c) => c.id === a.category_id);
                return (
                  <View key={a.category_id}>
                    {idx > 0 && <View style={styles.reviewDivider} />}
                    <View style={styles.reviewAllocRow}>
                      <Text style={styles.reviewAllocName}>
                        {cat?.name || "Unknown"}
                      </Text>
                      <Text style={styles.reviewAllocAmount}>
                        {formatCurrency(parseFloat(a.amount) || 0)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Duration</Text>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewDuration}>
                {untilTurnOff
                  ? "Recurring \u2014 until turned off"
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
              <ActivityIndicator color={colors.heroSurface} />
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
    backgroundColor: colors.background,
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 24,
  },
  backArrow: {
    fontSize: 24,
    color: colors.accent,
    fontFamily: fonts.semiBold,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.heroSurface,
    letterSpacing: -0.2,
  },

  // Steps — connected progress bar with labelled step meta
  stepRow: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  stepProgressMeta: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  stepEyebrow: {
    ...microLabelSmall,
    color: colors.textMuted,
  },
  stepCurrentLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.heroSurface,
    letterSpacing: -0.1,
  },
  stepTrack: {
    height: 6,
    backgroundColor: colors.trackLight,
    borderRadius: borderRadius.pill,
    overflow: "hidden",
  },
  stepFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: borderRadius.pill,
  },

  // Body
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: colors.heroSurface,
    letterSpacing: -0.5,
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
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
    ...shadows.card,
  },
  sectionLabel: {
    ...microLabel,
    color: colors.textSecondary,
    marginBottom: 10,
    marginTop: 6,
  },

  // Amount input — hero style
  amountHero: {
    ...heroCard.surface,
    padding: 24,
    marginBottom: 20,
  },
  amountHeroGlow: heroCard.glow,
  amountHeroLabel: {
    ...microLabelSmall,
    color: colors.heroLabel,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  amountPrefix: {
    fontSize: 44,
    fontFamily: fonts.extraBold,
    color: colors.accent,
    marginRight: 6,
    letterSpacing: -1,
  },
  amountInput: {
    flex: 1,
    fontSize: 44,
    fontFamily: fonts.extraBold,
    color: colors.heroTextPrimary,
    letterSpacing: -1,
    padding: 0,
  },
  amountHint: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.heroTextSecondary,
    marginTop: 6,
  },
  nameInput: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    padding: 0,
  },

  // Review — hero total + lighter subcards
  reviewHero: {
    ...heroCard.surface,
    padding: 24,
    marginBottom: 24,
  },
  reviewHeroGlow: heroCard.glow,
  reviewPlanName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.heroTextPrimary,
    marginBottom: 8,
  },
  reviewHeroLabel: {
    ...microLabelSmall,
    color: colors.heroLabel,
    marginBottom: 6,
  },
  reviewHeroAmount: {
    fontSize: 40,
    fontFamily: fonts.extraBold,
    color: colors.heroTextPrimary,
    letterSpacing: -0.8,
  },
  reviewHeroPerMo: {
    fontSize: 18,
    fontFamily: fonts.medium,
    color: colors.heroTextSecondary,
    letterSpacing: 0,
  },
  reviewHeroDivider: {
    height: 1,
    backgroundColor: colors.heroDivider,
    marginTop: 20,
    marginBottom: 16,
  },
  reviewHeroMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reviewHeroMetaItem: {
    flex: 1,
  },
  reviewHeroMetaLabel: {
    ...microLabelSmall,
    color: colors.heroLabel,
    marginBottom: 4,
  },
  reviewHeroMetaValue: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.heroTextPrimary,
    letterSpacing: -0.3,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
    ...shadows.card,
  },
  reviewAllocRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  reviewAllocName: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  reviewAllocAmount: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.accentDark,
  },
  reviewDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
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

  // Footer — accent CTA
  footer: {
    padding: 24,
    paddingBottom: 36,
    backgroundColor: colors.background,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.pill,
    padding: 16,
    alignItems: "center",
    ...shadows.card,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: colors.heroSurface,
    fontSize: 16,
    fontFamily: fonts.bold,
    letterSpacing: 0.2,
  },
});
