import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, borderRadius } from "../theme";
import { withOpacity } from "../utils/color";
import { formatCurrency } from "../utils/dashboard";
import { getCategoryIcon } from "../utils/categoryIcons";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type AllocationEntry = {
  category_id: string;
  amount: string;
};

type Props = {
  categories: Category[];
  allocations: AllocationEntry[];
  totalBudget: number;
  onAllocationsChange: (allocations: AllocationEntry[]) => void;
};


export default function CategoryAllocation({
  categories,
  allocations,
  totalBudget,
  onAllocationsChange,
}: Props) {
  const allocated = allocations.reduce(
    (sum, a) => sum + (parseFloat(a.amount) || 0),
    0
  );
  const remaining = totalBudget - allocated;

  function updateAmount(categoryId: string, value: string) {
    const existing = allocations.find((a) => a.category_id === categoryId);
    if (existing) {
      if (value === "" || value === "0") {
        // Remove allocation when cleared
        onAllocationsChange(
          allocations.filter((a) => a.category_id !== categoryId)
        );
      } else {
        onAllocationsChange(
          allocations.map((a) =>
            a.category_id === categoryId ? { ...a, amount: value } : a
          )
        );
      }
    } else if (value && value !== "0") {
      onAllocationsChange([
        ...allocations,
        { category_id: categoryId, amount: value },
      ]);
    }
  }

  function getAllocAmount(categoryId: string): string {
    return allocations.find((a) => a.category_id === categoryId)?.amount || "";
  }

  return (
    <View style={styles.container}>
      {/* Running total */}
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>Allocated</Text>
          <Text style={styles.summaryValue}>{formatCurrency(allocated)}</Text>
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryLabel}>Remaining</Text>
          <Text
            style={[
              styles.summaryValue,
              remaining < 0 && styles.overAllocated,
            ]}
          >
            {formatCurrency(Math.abs(remaining))}
            {remaining < 0 ? " over" : " left"}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min((allocated / Math.max(totalBudget, 1)) * 100, 100)}%`,
            },
            remaining < 0 && { backgroundColor: colors.error },
          ]}
        />
      </View>

      {/* Category list */}
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const catColor = item.color || colors.primary;
          const amount = getAllocAmount(item.id);
          const hasAmount = !!amount && parseFloat(amount) > 0;

          return (
            <View style={styles.categoryRow}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: withOpacity(catColor, 0.2) },
                ]}
              >
                <MaterialCommunityIcons
                  name={getCategoryIcon(item.name) as any}
                  size={20}
                  color={catColor}
                />
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    hasAmount && styles.amountInputActive,
                  ]}
                  value={amount}
                  onChangeText={(v) => updateAmount(item.id, v)}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  summaryRight: {
    alignItems: "flex-end",
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: fonts.labelMedium,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  overAllocated: {
    color: colors.error,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: 9999,
    marginBottom: 20,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 9999,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
  },
  dollarSign: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    marginRight: 2,
  },
  amountInput: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    minWidth: 60,
    textAlign: "right",
  },
  amountInputActive: {
    color: colors.primary,
  },
  separator: {
    height: 4,
  },
});
