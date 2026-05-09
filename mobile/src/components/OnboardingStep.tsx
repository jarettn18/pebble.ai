import { ReactNode } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { colors, borderRadius, fonts } from "../theme";

type Props = {
  stepIndex: number; // 0-based
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onContinue: () => void;
  onSkip: () => void;
  canContinue?: boolean;
  isSaving?: boolean;
  continueLabel?: string;
};

export function OnboardingStep({
  stepIndex,
  totalSteps,
  title,
  subtitle,
  children,
  onContinue,
  onSkip,
  canContinue = true,
  isSaving = false,
  continueLabel = "Continue",
}: Props) {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.progressRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              i <= stepIndex && styles.progressSegmentFilled,
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepLabel}>
          Step {stepIndex + 1} of {totalSteps}
        </Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.body}>{children}</View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!canContinue || isSaving) && styles.buttonDisabled,
          ]}
          onPress={onContinue}
          disabled={!canContinue || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.textOnPrimary} size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>{continueLabel}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSkip}
          disabled={isSaving}
          style={styles.skipButton}
          hitSlop={12}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 12,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: borderRadius.pill,
  },
  progressSegmentFilled: {
    backgroundColor: colors.primary,
  },
  inner: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    flexGrow: 1,
  },
  stepLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  body: {
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: colors.surface,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    padding: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  skipButton: {
    alignItems: "center",
    padding: 12,
    marginTop: 4,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.medium,
  },
});
