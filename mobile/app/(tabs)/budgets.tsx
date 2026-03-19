import { View, Text, StyleSheet } from "react-native";

export default function BudgetsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.empty}>No budgets yet</Text>
      <Text style={styles.hint}>Create a budget to start tracking your spending</Text>
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
