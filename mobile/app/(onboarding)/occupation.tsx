import { useState } from "react";
import { TextInput, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingStep } from "../../src/components/OnboardingStep";
import { useAuthStore } from "../../src/stores/auth";
import { colors, borderRadius } from "../../src/theme";

export default function OccupationStep() {
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const user = useAuthStore((s) => s.user);
  const [occupation, setOccupation] = useState(user?.occupation ?? "");
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!occupation.trim()) {
      router.push("/(onboarding)/state");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ occupation: occupation.trim() });
      router.push("/(onboarding)/state");
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to save"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => router.push("/(onboarding)/state");

  return (
    <OnboardingStep
      stepIndex={0}
      totalSteps={6}
      title="What do you do?"
      subtitle="We'll use your occupation to tailor financial tips."
      onContinue={handleContinue}
      onSkip={handleSkip}
      isSaving={saving}
    >
      <TextInput
        style={styles.input}
        value={occupation}
        onChangeText={setOccupation}
        placeholder="e.g. Software Engineer"
        placeholderTextColor={colors.textMuted}
        maxLength={100}
        autoFocus
      />
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
