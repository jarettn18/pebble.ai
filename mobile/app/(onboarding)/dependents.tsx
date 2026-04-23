import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingStep } from "../../src/components/OnboardingStep";
import { useAuthStore } from "../../src/stores/auth";
import { colors, borderRadius } from "../../src/theme";

export default function DependentsStep() {
  const router = useRouter();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const user = useAuthStore((s) => s.user);
  const [count, setCount] = useState<number>(user?.dependents ?? 0);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    setSaving(true);
    try {
      await updateProfile({ dependents: count });
      router.push("/(onboarding)/goals");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => router.push("/(onboarding)/goals");

  return (
    <OnboardingStep
      stepIndex={4}
      totalSteps={6}
      title="How many dependents?"
      subtitle="People who rely on your income — children, parents, etc."
      onContinue={handleContinue}
      onSkip={handleSkip}
      isSaving={saving}
    >
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setCount((c) => Math.max(0, c - 1))}
        >
          <Text style={styles.buttonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.value}>{count}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setCount((c) => c + 1)}
        >
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    marginTop: 16,
  },
  button: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    fontSize: 26,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  value: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.textPrimary,
    minWidth: 52,
    textAlign: "center",
  },
});
