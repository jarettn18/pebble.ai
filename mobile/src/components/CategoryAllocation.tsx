import React, { memo, useCallback } from "react";
import { View, Text, StyleSheet, TextInput, FlatList } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, borderRadius, microLabelSmall } from "../theme";
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

// Hoisted static separator
function Separator() {
  return <View style={styles.separator} />;
}

// Extracted memoized row component
interface CategoryRowProps {
  item: Category;
  amount: string;
  onAmountChange: (categoryId: string, value: string) => void;
}

const CategoryRow = memo(function CategoryRow({ item, amount, onAmountChange }: CategoryRowProps) {
  const catColor = item.color || colors.primary;
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
      <View
        style={[
          styles.amountInputWrap,
          hasAmount && styles.amountInputWrapActive,
        ]}
      >
        <Text
          style={[
            styles.dollarSign,
            hasAmount && styles.dollarSignActive,
          ]}
        >
          $
        </Text>
        <TextInput
          style={[
            styles.amountInput,
            hasAmount && styles.amountInputActive,
          ]}
          value={amount}
          onChangeText={(v) => onAmountChange(item.id, v)}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />
      </View>
    </View>
  );
});

export default memo(function CategoryAllocation({
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

  const updateAmount = useCallback((categoryId: string, value: string) => {
    const existing = allocations.find((a) => a.category_id === categoryId);
    if (existing) {
      if (value === "" || value === "0") {
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
  }, [allocations, onAllocationsChange]);

  const getAllocAmount = useCallback((categoryId: string): string => {
    return allocations.find((a) => a.category_id === categoryId)?.amount || "";
  }, [allocations]);

  const renderItem = useCallback(({ item }: { item: Category }) => (
    <CategoryRow
      item={item}
      amount={getAllocAmount(item.id)}
      onAmountChange={updateAmount}
    />
  ), [getAllocAmount, updateAmount]);

  const keyExtractor = useCallback((item: Category) => item.id, []);

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
        keyExtractor={keyExtractor}
        scrollEnabled={false}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: `${colors.outlineVariant}33`,
  },
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
    ...microLabelSmall,
    color: colors.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: colors.heroSurface,
    letterSpacing: -0.3,
  },
  overAllocated: {
    color: colors.error,
  },
  progressTrack: {
    height: 10,
    backgroundColor: colors.trackLight,
    borderRadius: borderRadius.pill,
    marginBottom: 20,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: borderRadius.pill,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
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
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
    borderWidth: 1,
    borderColor: "transparent",
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
    padding: 0,
  },
  amountInputActive: {
    color: colors.accentDark,
  },
  amountInputWrapActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorderStrong,
  },
  dollarSignActive: {
    color: colors.accentDark,
  },
  separator: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: 52,
  },
});
