import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../src/theme";

export default function AiChatScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.empty}>AI Financial Assistant</Text>
      <Text style={styles.hint}>Coming soon — ask questions about your finances</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  empty: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
});
