import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useAuthStore } from "../../src/stores/auth";
import { colors, borderRadius, shadows } from "../../src/theme";

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.full_name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {user?.subscription_tier?.toUpperCase()} plan
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginTop: 8,
    ...shadows.card,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceGreen,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  logoutButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: "600",
  },
});
