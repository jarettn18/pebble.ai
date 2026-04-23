import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuthStore } from "../../src/stores/auth";
import { colors, borderRadius } from "../../src/theme";

function formatDobInput(prev: string, next: string): string {
  // Accept backspace freely; otherwise keep only digits and auto-insert dashes
  if (next.length < prev.length) return next;
  const digits = next.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function isValidDob(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  if (d > today) return false;
  if (d.getFullYear() < 1900) return false;
  // Round-trip to catch invalid dates like 2025-02-30
  return d.toISOString().slice(0, 10) === s;
}

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const initiateRegister = useAuthStore((s) => s.initiateRegister);
  const router = useRouter();

  const handleRegister = async () => {
    setError("");
    if (!fullName || !email || !password || !phoneNumber || !dateOfBirth) {
      setError("Please fill in all fields");
      return;
    }
    if (phoneNumber.length !== 10) {
      setError("Phone number must be 10 digits");
      return;
    }
    if (!isValidDob(dateOfBirth)) {
      setError("Enter a valid birthday (YYYY-MM-DD)");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await initiateRegister(
        email.trim().toLowerCase(),
        password,
        fullName.trim(),
        `+1${phoneNumber}`,
        dateOfBirth
      );
      router.push("/(auth)/verify-phone");
    } catch (e: any) {
      setError(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Pebble</Text>
        <Text style={styles.subtitle}>Create your account</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Full name"
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <View style={styles.phoneRow}>
          <View style={styles.phonePrefix}>
            <Text style={styles.phonePrefixText}>+1</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            placeholder="5555550100"
            value={phoneNumber}
            onChangeText={(t) => setPhoneNumber(t.replace(/\D/g, "").slice(0, 10))}
            keyboardType="number-pad"
            autoComplete="tel"
            maxLength={10}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Birthday (YYYY-MM-DD)"
          value={dateOfBirth}
          onChangeText={(t) => setDateOfBirth(formatDobInput(dateOfBirth, t))}
          keyboardType="number-pad"
          autoComplete="birthdate-full"
          maxLength={10}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Sending code..." : "Create Account"}
          </Text>
        </TouchableOpacity>

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkText}>
            Already have an account?{" "}
            <Text style={styles.linkBold}>Sign in</Text>
          </Text>
        </Link>
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
    fontWeight: "700",
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: colors.background,
  },
  phoneRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  phonePrefix: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    justifyContent: "center",
    backgroundColor: colors.background,
    marginRight: 8,
  },
  phonePrefixText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: 16,
    fontSize: 16,
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
    fontWeight: "600",
  },
  link: {
    marginTop: 24,
    alignItems: "center",
  },
  linkText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  linkBold: {
    color: colors.primary,
    fontWeight: "600",
  },
  error: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
});
