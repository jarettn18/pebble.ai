import { useState } from "react";
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
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  fonts,
  borderRadius,
  shadows,
  microLabelSmall,
} from "../../src/theme";
import { createApiKey, SCOPE_OPTIONS } from "../../src/api/apiKeys";

const DEFAULT_ON: ReadonlyArray<string> = SCOPE_OPTIONS.filter((s) =>
  s.id.startsWith("read:")
).map((s) => s.id);

export default function CreateApiKeyScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([...DEFAULT_ON]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleScope = (id: string) => {
    setScopes((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const canSubmit = name.trim().length > 0 && scopes.length > 0;

  const handleGenerate = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const res = await createApiKey(name.trim(), scopes);
      setRawKey(res.raw_key);
      setStep(2);
    } catch (e) {
      Alert.alert(
        "Could not create API key",
        e instanceof Error ? e.message : "Something went wrong"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!rawKey) return;
    await Clipboard.setStringAsync(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    router.replace("/api-keys");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        {step === 1 ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>{"←"}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
        <Text style={styles.headerTitle}>
          {step === 1 ? "Connect a tool" : "Your new key"}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <>
            <Text style={styles.stepTitle}>Name this connection</Text>
            <Text style={styles.stepDescription}>
              Pick a name so you can recognize it later (e.g. which device or
              tool it's for).
            </Text>

            <View style={styles.card}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Claude Desktop"
                placeholderTextColor={colors.textMuted}
                autoFocus
                returnKeyType="done"
                maxLength={64}
              />
            </View>

            <Text style={styles.sectionLabel}>Permissions</Text>
            <Text style={styles.sectionHelp}>
              Choose what this tool can do on your behalf. You can revoke access
              at any time.
            </Text>

            <View style={styles.scopeList}>
              {SCOPE_OPTIONS.map((opt) => {
                const active = scopes.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.scopeRow, active && styles.scopeRowActive]}
                    onPress={() => toggleScope(opt.id)}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        active && styles.checkboxActive,
                      ]}
                    >
                      {active && (
                        <MaterialCommunityIcons
                          name="check"
                          size={14}
                          color={colors.textOnPrimary}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.scopeLabel,
                        active && styles.scopeLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.stepTitle}>Copy your API key</Text>
            <Text style={styles.stepDescription}>
              Paste this into the AI tool you're connecting. We'll only show it
              once — for your security, you won't be able to view it again.
            </Text>

            <View style={styles.keyCard}>
              <Text style={styles.keyMono} selectable>
                {rawKey}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnCopied]}
              onPress={handleCopy}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name={copied ? "check" : "content-copy"}
                size={18}
                color={colors.heroSurface}
              />
              <Text style={styles.copyBtnText}>
                {copied ? "Copied!" : "Copy to clipboard"}
              </Text>
            </TouchableOpacity>

            <View style={styles.warningCard}>
              <MaterialCommunityIcons
                name="alert-outline"
                size={20}
                color={colors.error}
              />
              <Text style={styles.warningText}>
                This key will not be shown again. Store it somewhere safe — if
                you lose it, you'll need to revoke it and create a new one.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {step === 1 ? (
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!canSubmit || isSubmitting) && styles.btnDisabled,
            ]}
            onPress={handleGenerate}
            disabled={!canSubmit || isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.heroSurface} />
            ) : (
              <Text style={styles.primaryBtnText}>Generate API key</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleDone}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Done</Text>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
    ...shadows.card,
  },
  nameInput: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    padding: 0,
  },
  sectionLabel: {
    ...microLabelSmall,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  sectionHelp: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  scopeList: {
    gap: 10,
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
    ...shadows.card,
  },
  scopeRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceContainerLow,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: colors.surface,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scopeLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  scopeLabelActive: {
    fontFamily: fonts.semiBold,
  },

  // Step 2 — key reveal
  keyCard: {
    backgroundColor: colors.heroSurface,
    borderRadius: borderRadius.md,
    padding: 18,
    marginBottom: 16,
    ...shadows.card,
  },
  keyMono: {
    fontSize: 13,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    color: colors.heroTextPrimary,
    letterSpacing: 0.4,
    lineHeight: 20,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.pill,
    paddingVertical: 14,
    marginBottom: 24,
    ...shadows.card,
  },
  copyBtnCopied: {
    backgroundColor: colors.primaryFixed,
  },
  copyBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.heroSurface,
  },
  warningCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.md,
    padding: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.error,
    lineHeight: 18,
  },

  // Footer
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
