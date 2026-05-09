import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/stores/auth";
import { colors, borderRadius, fonts } from "../../src/theme";

const RESEND_COOLDOWN = 60;

export default function VerifyPhoneScreen() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const verifyAndRegister = useAuthStore((s) => s.verifyAndRegister);
  const resendCode = useAuthStore((s) => s.resendCode);
  const pendingPhoneNumber = useAuthStore((s) => s.pendingPhoneNumber);
  const router = useRouter();

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((t) => t - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const maskedPhone = pendingPhoneNumber
    ? pendingPhoneNumber.replace(/.(?=.{4})/g, "*")
    : "";

  const handleVerify = async () => {
    setError("");
    if (code.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      await verifyAndRegister(code);
    } catch (e: any) {
      setError(e.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await resendCode();
      setResendTimer(RESEND_COOLDOWN);
    } catch (e: any) {
      setError(e.message || "Failed to resend code");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Verify Phone</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to {maskedPhone}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          textAlign="center"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Verifying..." : "Verify"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResend}
          disabled={resendTimer > 0}
          style={styles.resendButton}
        >
          <Text
            style={[
              styles.resendText,
              resendTimer > 0 && styles.resendDisabled,
            ]}
          >
            {resendTimer > 0
              ? `Resend code in ${resendTimer}s`
              : "Resend code"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>Go back</Text>
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
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    marginTop: 8,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: 16,
    fontSize: 28,
    letterSpacing: 12,
    marginBottom: 12,
    backgroundColor: colors.background,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  resendButton: {
    marginTop: 24,
    alignItems: "center",
  },
  resendText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  resendDisabled: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
  },
  backButton: {
    marginTop: 16,
    alignItems: "center",
  },
  backText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
});
