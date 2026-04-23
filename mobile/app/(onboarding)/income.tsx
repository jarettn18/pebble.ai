import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingStep } from "../../src/components/OnboardingStep";
import { useAuthStore } from "../../src/stores/auth";
import { formatIncome } from "../../src/utils/format";
import { colors, borderRadius } from "../../src/theme";

export default function IncomeStep() {
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const user = useAuthStore((s) => s.user);
  const [income, setIncome] = useState(
    user?.annual_income != null ? String(user.annual_income) : ""
  );
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!income) {
      router.push("/(onboarding)/marital-status");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ annual_income: parseInt(income, 10) });
      router.push("/(onboarding)/marital-status");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => router.push("/(onboarding)/marital-status");

  return (
    <OnboardingStep
      stepIndex={2}
      totalSteps={6}
      title="What's your annual income?"
      subtitle="Used to benchmark budgets and savings goals. Only you can see this."
      onContinue={handleContinue}
      onSkip={handleSkip}
      isSaving={saving}
    >
      <View style={styles.row}>
        <Text style={styles.dollar}>$</Text>
        <TextInput
          style={styles.input}
          value={formatIncome(income)}
          onChangeText={(v) => setIncome(v.replace(/[^0-9]/g, ""))}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          autoFocus
        />
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dollar: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: colors.textPrimary,
  },
});
