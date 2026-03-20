import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiRequest } from "../../src/api/client";
import { useBudgetsStore, type Budget } from "../../src/stores/budgets";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

type CategoryListResponse = {
  categories: Category[];
};

export default function BudgetDetailScreen() {
  const { id, month: monthParam, year: yearParam } = useLocalSearchParams<{
    id: string;
    month: string;
    year: string;
  }>();
  const router = useRouter();
  const { upsertBudget, removeBudget } = useBudgetsStore();

  const isNew = id === "new";
  const defaultMonth = monthParam ? parseInt(monthParam, 10) : new Date().getMonth() + 1;
  const defaultYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const catData = await apiRequest<CategoryListResponse>("/v1/categories");
        setCategories(catData.categories);

        if (!isNew) {
          const budget = await apiRequest<Budget>(`/v1/budgets/${id}`);
          setSelectedCategoryId(budget.category_id);
          setAmount(budget.amount);
          setMonth(budget.month);
          setYear(budget.year);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id]);

  async function handleSave() {
    if (!selectedCategoryId) {
      setError("Select a category");
      return;
    }
    const parsed = parseFloat(amount);
    if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await apiRequest<Budget>("/v1/budgets", {
          method: "POST",
          body: {
            category_id: selectedCategoryId,
            amount: parsed.toFixed(2),
            month,
            year,
          },
        });
        upsertBudget(created);
      } else {
        const updated = await apiRequest<Budget>(`/v1/budgets/${id}`, {
          method: "PUT",
          body: {
            category_id: selectedCategoryId,
            amount: parsed.toFixed(2),
            month,
            year,
          },
        });
        upsertBudget(updated);
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    Alert.alert("Delete Budget", "Are you sure you want to delete this budget?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/v1/budgets/${id}`, { method: "DELETE" });
            removeBudget(id!);
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete");
          }
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
    );
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>{"\u2190"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isNew ? "Create Budget" : "Edit Budget"}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Amount */}
        <Text style={styles.sectionLabel}>Amount</Text>
        <View style={styles.card}>
          <View style={styles.amountRow}>
            <Text style={styles.amountPrefix}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Category */}
        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.card}>
          {selectedCategory ? (
            <View style={styles.currentCategory}>
              <View style={styles.currentCategoryLeft}>
                <View
                  style={[styles.categoryDot, { backgroundColor: selectedCategory.color || "#999" }]}
                />
                <Text style={styles.currentCategoryText}>{selectedCategory.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedCategoryId(null)}>
                <Text style={styles.clearBtn}>{"\u2715"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.placeholderText}>Select a category</Text>
          )}
          <FlatList
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chipList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.chip,
                  item.id === selectedCategoryId && styles.chipSelected,
                ]}
                onPress={() => setSelectedCategoryId(item.id)}
              >
                <View
                  style={[styles.chipDot, { backgroundColor: item.color || "#999" }]}
                />
                <Text
                  style={[
                    styles.chipText,
                    item.id === selectedCategoryId && styles.chipTextSelected,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Period Info */}
        <Text style={styles.sectionLabel}>Period</Text>
        <View style={styles.card}>
          <Text style={styles.periodText}>
            {new Date(year, month - 1).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>
              {isNew ? "Create Budget" : "Save Changes"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Delete Button */}
        {!isNew && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteBtnText}>Delete Budget</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centered: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  backArrow: {
    fontSize: 24,
    color: "#1a1a2e",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  amountPrefix: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a2e",
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  currentCategory: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  currentCategoryLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  currentCategoryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  clearBtn: {
    fontSize: 16,
    color: "#999",
    padding: 4,
  },
  placeholderText: {
    fontSize: 14,
    color: "#999",
    marginBottom: 12,
  },
  chipList: {
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
  },
  chipSelected: {
    backgroundColor: "#1a1a2e",
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    color: "#666",
  },
  chipTextSelected: {
    color: "#fff",
  },
  periodText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a2e",
  },
  errorText: {
    color: "#d32f2f",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#d32f2f",
  },
  deleteBtnText: {
    color: "#d32f2f",
    fontSize: 16,
    fontWeight: "600",
  },
});
