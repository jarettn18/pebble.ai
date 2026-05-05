import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  fonts,
  borderRadius,
  shadows,
  microLabelSmall,
} from "../../src/theme";
import {
  listApiKeys,
  revokeApiKey,
  SCOPE_OPTIONS,
  type ApiKey,
} from "../../src/api/apiKeys";

function scopeLabel(id: string): string {
  return SCOPE_OPTIONS.find((s) => s.id === id)?.label ?? id;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never used";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "Last used: just now";
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `Last used: ${m}m ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `Last used: ${h}h ago`;
  }
  if (diffSec < 86400 * 30) {
    const d = Math.floor(diffSec / 86400);
    return `Last used: ${d}d ago`;
  }
  const date = new Date(iso);
  return `Last used: ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export default function ApiKeysListScreen() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listApiKeys();
      setKeys(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh whenever the screen comes back into focus (e.g. after creating a new key)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRevoke = (key: ApiKey) => {
    Alert.alert(
      "Revoke API key?",
      `Any AI tool using "${key.name}" will lose access immediately. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            setRevokingId(key.id);
            try {
              await revokeApiKey(key.id);
              await load();
            } catch (e) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Failed to revoke key"
              );
            } finally {
              setRevokingId(null);
            }
          },
        },
      ]
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyCard}>
      <MaterialCommunityIcons
        name="robot-outline"
        size={36}
        color={colors.primary}
      />
      <Text style={styles.emptyTitle}>No connected tools yet</Text>
      <Text style={styles.emptyBody}>
        Create an API key to connect Claude Desktop or another AI assistant to
        your Pebble account. You choose what each tool is allowed to do.
      </Text>
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => router.push("/api-keys/create")}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>+ Connect a tool</Text>
      </TouchableOpacity>
    </View>
  );

  const renderKey = (key: ApiKey) => {
    const revoked = !!key.revoked_at;
    return (
      <View
        key={key.id}
        style={[styles.keyCard, revoked && styles.keyCardRevoked]}
      >
        <View style={styles.keyHeader}>
          <Text style={[styles.keyName, revoked && styles.textRevoked]}>
            {key.name}
          </Text>
          {revoked ? (
            <View style={styles.revokedBadge}>
              <Text style={styles.revokedBadgeText}>REVOKED</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => handleRevoke(key)}
              disabled={revokingId === key.id}
              hitSlop={8}
              style={styles.revokeBtn}
            >
              {revokingId === key.id ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={styles.revokeBtnText}>Revoke</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.scopeChipRow}>
          {key.scopes.map((s) => (
            <View key={s} style={styles.scopeChip}>
              <Text style={styles.scopeChipText}>{scopeLabel(s)}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.lastUsed, revoked && styles.textRevoked]}>
          {revoked ? "Revoked" : relativeTime(key.last_used_at)}
        </Text>
      </View>
    );
  };

  if (isLoading && keys === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>{"←"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connected AI tools</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={load}
              activeOpacity={0.85}
            >
              <Text style={styles.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : keys && keys.length === 0 ? (
          renderEmpty()
        ) : (
          <>
            <Text style={styles.intro}>
              These are the API keys you've issued for AI tools. Revoke any key
              to immediately cut off access.
            </Text>
            {keys?.map(renderKey)}
          </>
        )}
      </ScrollView>

      {keys && keys.length > 0 && !error && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/api-keys/create")}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>+ Connect a tool</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
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
  intro: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginBottom: 20,
    lineHeight: 20,
  },

  // Empty state
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 28,
    alignItems: "center",
    marginTop: 24,
    ...shadows.card,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },

  // Key card
  keyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
    ...shadows.card,
  },
  keyCardRevoked: {
    opacity: 0.55,
  },
  keyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  keyName: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginRight: 12,
  },
  textRevoked: {
    color: colors.textMuted,
  },
  revokeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  revokeBtnText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.error,
  },
  revokedBadge: {
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  revokedBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.error,
    letterSpacing: 1,
  },
  scopeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  scopeChip: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scopeChipText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  lastUsed: {
    ...microLabelSmall,
    color: colors.textMuted,
  },

  // Error
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 20,
    alignItems: "center",
    marginTop: 24,
    ...shadows.card,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontFamily: fonts.medium,
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primary,
  },
  retryBtnText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontFamily: fonts.semiBold,
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
  primaryBtnText: {
    color: colors.heroSurface,
    fontSize: 16,
    fontFamily: fonts.bold,
    letterSpacing: 0.2,
  },
});
