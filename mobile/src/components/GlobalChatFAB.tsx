import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadows } from "../theme";
import { useChatUIStore } from "../stores/chatUI";

// Approximate height of the bottom tab bar — used to lift the FAB so it
// doesn't sit on top of tab labels.
const TAB_BAR_HEIGHT = 64;
const FAB_MARGIN = 16;
const FAB_SIZE = 56;

export default function GlobalChatFAB() {
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const openChat = useChatUIStore((s) => s.openChat);
  const open = useChatUIStore((s) => s.open);

  // Hide on auth/onboarding flows — chat is meaningless before the user
  // has a financial profile.
  const inAuth = segments[0] === "(auth)";
  const inOnboarding = segments[0] === "(onboarding)";
  if (inAuth || inOnboarding) return null;

  // Hide while the sheet is open so the FAB isn't visible behind the
  // dimmed backdrop.
  if (open) return null;

  // Lift above the tab bar when we're inside the tabs group; otherwise
  // just respect the safe-area inset.
  const inTabs = segments[0] === "(tabs)";
  const bottom =
    insets.bottom + FAB_MARGIN + (inTabs ? TAB_BAR_HEIGHT : 0);

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom }]}>
      <TouchableOpacity
        style={styles.fab}
        onPress={openChat}
        activeOpacity={0.85}
        accessibilityLabel="Open Pebble AI chat"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="robot-outline"
          size={26}
          color={colors.textOnPrimary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: FAB_MARGIN,
    // bottom is set dynamically
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.hero,
  },
});
