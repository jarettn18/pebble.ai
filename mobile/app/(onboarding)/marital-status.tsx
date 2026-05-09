import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingStep } from "../../src/components/OnboardingStep";
import { useAuthStore } from "../../src/stores/auth";
import { MARITAL_OPTIONS, capitalize } from "../../src/constants/profile";
import { colors, borderRadius, fonts } from "../../src/theme";

export default function MaritalStatusStep() {
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState(user?.marital_status ?? "");
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!status) {
      router.push("/(onboarding)/dependents");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ marital_status: status });
      router.push("/(onboarding)/dependents");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => router.push("/(onboarding)/dependents");

  return (
    <OnboardingStep
      stepIndex={3}
      totalSteps={6}
      title="Marital status?"
      onContinue={handleContinue}
      onSkip={handleSkip}
      isSaving={saving}
    >
      <View style={styles.row}>
        {MARITAL_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, status === opt && styles.chipActive]}
            onPress={() => setStatus(status === opt ? "" : opt)}
          >
            <Text
              style={[styles.chipText, status === opt && styles.chipTextActive]}
            >
              {capitalize(opt)}
            </Text>
          </TouchableOpacity>
        ))}
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
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
});
