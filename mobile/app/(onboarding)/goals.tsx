import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingStep } from "../../src/components/OnboardingStep";
import { useAuthStore } from "../../src/stores/auth";
import { GOAL_OPTIONS } from "../../src/constants/profile";
import { colors, borderRadius, fonts } from "../../src/theme";

export default function GoalsStep() {
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const user = useAuthStore((s) => s.user);
  const [goals, setGoals] = useState<string[]>(user?.financial_goals ?? []);
  const [saving, setSaving] = useState(false);

  const toggle = (v: string) =>
    setGoals((prev) =>
      prev.includes(v) ? prev.filter((g) => g !== v) : [...prev, v]
    );

  const finish = async (includeGoals: boolean) => {
    setSaving(true);
    try {
      await updateProfile({
        ...(includeGoals && goals.length > 0 ? { financial_goals: goals } : {}),
        onboarding_completed: true,
      });
      router.replace("/(tabs)");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStep
      stepIndex={5}
      totalSteps={6}
      title="What are you working toward?"
      subtitle="Pick any goals that matter to you — we'll use them to shape your dashboard."
      onContinue={() => finish(true)}
      onSkip={() => finish(false)}
      isSaving={saving}
      continueLabel="Finish"
    >
      <View style={styles.row}>
        {GOAL_OPTIONS.map((g) => {
          const active = goals.includes(g.value);
          return (
            <TouchableOpacity
              key={g.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggle(g.value)}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {g.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
});
