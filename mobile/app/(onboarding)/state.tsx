import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingStep } from "../../src/components/OnboardingStep";
import { useAuthStore } from "../../src/stores/auth";
import { US_STATES } from "../../src/constants/profile";
import { colors, borderRadius } from "../../src/theme";

export default function StateStep() {
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState(user?.state ?? "");
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!state) {
      router.push("/(onboarding)/income");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ state });
      router.push("/(onboarding)/income");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => router.push("/(onboarding)/income");

  return (
    <OnboardingStep
      stepIndex={1}
      totalSteps={6}
      title="Where do you live?"
      subtitle="Your state helps us factor in local taxes and regulations."
      onContinue={handleContinue}
      onSkip={handleSkip}
      isSaving={saving}
    >
      <View style={styles.grid}>
        {US_STATES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, state === s && styles.chipActive]}
            onPress={() => setState(s)}
          >
            <Text
              style={[styles.chipText, state === s && styles.chipTextActive]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 48,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
});
