import { View, Text, StyleSheet } from "react-native";

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
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  empty: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  hint: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
});
