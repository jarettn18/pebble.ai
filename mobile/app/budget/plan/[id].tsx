import React, { memo, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiRequest } from "../../../src/api/client";
import {
  useBudgetPlansStore,
  type BudgetPlan,
} from "../../../src/stores/budgetPlans";
import { useBudgetsStore } from "../../../src/stores/budgets";
import { useDashboardStore } from "../../../src/stores/dashboard";
import { colors, fonts, borderRadius } from "../../../src/theme";
import { formatCurrency } from "../../../src/utils/dashboard";
import { withOpacity } from "../../../src/utils/color";
import { getCategoryIcon } from "../../../src/utils/categoryIcons";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

type EditAllocation = {
  category_id: string;
  category_name: string;
  category_color: string | null;
  amount: string;
};

const CategoryPickerRow = memo(function CategoryPickerRow({
  item,
  onPress,
}: {
  item: Category;
  onPress: (cat: Category) => void;
}) {
  const catColor = item.color || colors.primary;
  return (
    <TouchableOpacity
      style={styles.pickerRow}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: withOpacity(catColor, 0.2) },
        ]}
      >
        <MaterialCommunityIcons
          name={getCategoryIcon(item.name) as any}
          size={18}
          color={catColor}
        />
      </View>
      <Text style={styles.pickerRowText}>{item.name}</Text>
    </TouchableOpacity>
  );
});

export default function BudgetPlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { removePlan, refresh: refreshPlans } = useBudgetPlansStore();
  const loadBudgets = useBudgetsStore((s) => s.load);
  const refreshDashboard = useDashboardStore((s) => s.refresh);

  const refreshBudgets = async () => {
    const now = new Date();
    await loadBudgets(now.getMonth() + 1, now.getFullYear());
  };

  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingRecurrence, setTogglingRecurrence] = useState(false);

  // Inline editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit mode state (add/remove allocations)
  const [isEditing, setIsEditing] = useState(false);
  const [editAllocations, setEditAllocations] = useState<EditAllocation[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [savingEdits, setSavingEdits] = useState(false);

  useEffect(() => {
    loadPlan();
  }, [id]);

  async function loadPlan() {
    try {
      const data = await apiRequest<BudgetPlan>(`/v1/budget-plans/${id}`);
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plan");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleRecurrence(val: boolean) {
    if (!plan) return;
    setTogglingRecurrence(true);
    try {
      await apiRequest(`/v1/budget-plans/${id}`, {
        method: "PUT",
        body: { recurring_active: val },
      });
      const [freshPlan] = await Promise.all([
        apiRequest<BudgetPlan>(`/v1/budget-plans/${id}`),
        refreshPlans(),
      ]);
      setPlan(freshPlan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setTogglingRecurrence(false);
    }
  }

  async function saveField() {
    if (!plan || !editingField) return;

    if (editingField === "name") {
      const trimmed = editingValue.trim();
      if (trimmed === (plan.name || "")) {
        setEditingField(null);
        return;
      }
      setSaving(true);
      try {
        await apiRequest(`/v1/budget-plans/${id}`, {
          method: "PUT",
          body: { name: trimmed || null },
        });
        const [freshPlan] = await Promise.all([
          apiRequest<BudgetPlan>(`/v1/budget-plans/${id}`),
          refreshPlans(),
        ]);
        setPlan(freshPlan);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setSaving(false);
        setEditingField(null);
      }
    } else if (editingField === "total") {
      const parsed = parseFloat(editingValue);
      if (isNaN(parsed) || parsed < 0) {
        setEditingField(null);
        return;
      }
      if (parsed.toFixed(2) === parseFloat(plan.total_amount).toFixed(2)) {
        setEditingField(null);
        return;
      }
      setSaving(true);
      try {
        await apiRequest(`/v1/budget-plans/${id}`, {
          method: "PUT",
          body: { total_amount: parsed.toFixed(2) },
        });
        const [freshPlan] = await Promise.all([
          apiRequest<BudgetPlan>(`/v1/budget-plans/${id}`),
          refreshPlans(),
          refreshBudgets(),
          refreshDashboard(),
        ]);
        setPlan(freshPlan);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setSaving(false);
        setEditingField(null);
      }
    } else if (editingField.startsWith("alloc:")) {
      const allocId = editingField.replace("alloc:", "");
      const parsed = parseFloat(editingValue);
      if (isNaN(parsed) || parsed < 0) {
        setEditingField(null);
        return;
      }
      setSaving(true);
      try {
        const updatedAllocations = plan.allocations.map((a) => ({
          category_id: a.category_id,
          amount: a.id === allocId ? parsed.toFixed(2) : a.amount,
        }));
        await apiRequest(`/v1/budget-plans/${id}`, {
          method: "PUT",
          body: { allocations: updatedAllocations },
        });
        const [freshPlan] = await Promise.all([
          apiRequest<BudgetPlan>(`/v1/budget-plans/${id}`),
          refreshPlans(),
          refreshBudgets(),
          refreshDashboard(),
        ]);
        setPlan(freshPlan);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setSaving(false);
        setEditingField(null);
      }
    }
  }

  function handleDelete() {
    Alert.alert(
      "Delete Budget Plan",
      "Do you also want to delete all budgets generated by this plan?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Keep Budgets, Delete Plan",
          onPress: () => deletePlan(false),
        },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: () => deletePlan(true),
        },
      ]
    );
  }

  async function deletePlan(deleteBudgets: boolean) {
    try {
      await apiRequest(
        `/v1/budget-plans/${id}?delete_budgets=${deleteBudgets}`,
        { method: "DELETE" }
      );
      removePlan(id!);
      await Promise.all([refreshBudgets(), refreshDashboard()]);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function enterEditMode() {
    if (!plan) return;
    setEditAllocations(
      plan.allocations.map((a) => ({
        category_id: a.category_id,
        category_name: a.category_name || "Unknown",
        category_color: a.category_color,
        amount: a.amount,
      }))
    );
    setIsEditing(true);
    // Fetch all categories for the picker
    try {
      const data = await apiRequest<{ categories: Category[] }>("/v1/categories");
      setAllCategories(data.categories);
    } catch {}
  }

  function cancelEditMode() {
    setIsEditing(false);
    setEditAllocations([]);
  }

  function removeEditAllocation(categoryId: string) {
    setEditAllocations((prev) => prev.filter((a) => a.category_id !== categoryId));
  }

  function updateEditAmount(categoryId: string, amount: string) {
    setEditAllocations((prev) =>
      prev.map((a) => (a.category_id === categoryId ? { ...a, amount } : a))
    );
  }

  const addCategory = useCallback((cat: Category) => {
    setEditAllocations((prev) => [
      ...prev,
      {
        category_id: cat.id,
        category_name: cat.name,
        category_color: cat.color,
        amount: "0",
      },
    ]);
    setShowCategoryPicker(false);
  }, []);

  async function saveEditAllocations() {
    if (!plan) return;
    setSavingEdits(true);
    try {
      const allocations = editAllocations
        .filter((a) => parseFloat(a.amount) > 0)
        .map((a) => ({ category_id: a.category_id, amount: parseFloat(a.amount).toFixed(2) }));
      await apiRequest(`/v1/budget-plans/${id}`, {
        method: "PUT",
        body: { allocations },
      });
      // Wait for ALL refreshes + a fresh plan GET to complete before updating UI
      const [freshPlan] = await Promise.all([
        apiRequest<BudgetPlan>(`/v1/budget-plans/${id}`),
        refreshPlans(),
        refreshBudgets(),
        refreshDashboard(),
      ]);
      setPlan(freshPlan);
      setIsEditing(false);
      setEditAllocations([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingEdits(false);
    }
  }

  const availableCategories = allCategories.filter(
    (c) => !editAllocations.some((a) => a.category_id === c.id)
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || "Plan not found"}</Text>
      </View>
    );
  }

  const allocatedTotal = plan.allocations.reduce(
    (sum, a) => sum + parseFloat(a.amount),
    0
  );
  const totalAmount = parseFloat(plan.total_amount);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>{"\u2190"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Budget Plan</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
        {/* Plan summary */}
        <View style={styles.summaryCard}>
          {editingField === "name" ? (
            <View style={styles.inlineEditRow}>
              <TextInput
                style={[styles.planName, styles.inlineInput]}
                value={editingValue}
                onChangeText={setEditingValue}
                placeholder="Budget Plan"
                placeholderTextColor={colors.textMuted}
                autoFocus
                onSubmitEditing={saveField}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={saveField} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="check" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setEditingField("name");
                setEditingValue(plan.name || "");
              }}
            >
              <Text style={styles.planName}>{plan.name || "Budget Plan"}</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.totalLabel}>TOTAL BUDGET</Text>
          {editingField === "total" ? (
            <View style={styles.inlineEditRow}>
              <TextInput
                style={[styles.totalAmount, styles.inlineInput, { flex: 1 }]}
                value={editingValue}
                onChangeText={setEditingValue}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                onSubmitEditing={saveField}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={saveField} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="check" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setEditingField("total");
                setEditingValue(plan.total_amount);
              }}
            >
              <Text style={styles.totalAmount}>
                {formatCurrency(totalAmount)}/mo
              </Text>
            </TouchableOpacity>
          )}
          {plan.is_recurring && (
            <View style={styles.recurringBadge}>
              <MaterialCommunityIcons
                name="sync"
                size={14}
                color={plan.recurring_active ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.recurringBadgeText,
                  !plan.recurring_active && { color: colors.textMuted },
                ]}
              >
                {plan.recurring_active ? "Recurring" : "Recurring (paused)"}
              </Text>
            </View>
          )}
        </View>

        {/* Recurrence toggle */}
        {plan.is_recurring && (
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Recurring Active</Text>
                <Text style={styles.toggleHint}>
                  {plan.recurring_active
                    ? "New budgets will be created each month"
                    : "Stopped \u2014 existing budgets are kept"}
                </Text>
              </View>
              <Switch
                value={plan.recurring_active}
                onValueChange={handleToggleRecurrence}
                disabled={togglingRecurrence}
                trackColor={{
                  false: colors.border,
                  true: colors.primaryLight,
                }}
                thumbColor={plan.recurring_active ? colors.primary : "#f4f3f4"}
              />
            </View>
          </View>
        )}

        {/* Allocations */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Allocations</Text>
          <TouchableOpacity
            onPress={isEditing ? cancelEditMode : enterEditMode}
            hitSlop={8}
          >
            <Text style={styles.editBtn}>{isEditing ? "Cancel" : "Edit"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {isEditing ? (
            <>
              {editAllocations.map((a) => {
                const catColor = a.category_color || colors.primary;
                return (
                  <View key={a.category_id} style={styles.allocRow}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: withOpacity(catColor, 0.2) },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={getCategoryIcon(a.category_name) as any}
                        size={18}
                        color={catColor}
                      />
                    </View>
                    <Text style={styles.allocName} numberOfLines={1}>
                      {a.category_name}
                    </Text>
                    <TextInput
                      style={styles.allocAmountInput}
                      value={a.amount}
                      onChangeText={(val) => updateEditAmount(a.category_id, val)}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                    <TouchableOpacity
                      onPress={() => removeEditAllocation(a.category_id)}
                      hitSlop={8}
                      style={styles.removeBtn}
                    >
                      <MaterialCommunityIcons name="close-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Add Category */}
              <TouchableOpacity
                style={styles.addCategoryBtn}
                onPress={() => setShowCategoryPicker(true)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addCategoryText}>Add Category</Text>
              </TouchableOpacity>

              <View style={styles.divider} />
              {(() => {
                const editTotal = editAllocations.reduce(
                  (sum, a) => sum + (parseFloat(a.amount) || 0), 0
                );
                const unalloc = totalAmount - editTotal;
                return (
                  <>
                    <View style={styles.allocRow}>
                      <View style={{ width: 40 }} />
                      <Text style={styles.allocTotalLabel}>Total Allocated</Text>
                      <Text style={styles.allocAmount}>
                        {formatCurrency(editTotal)}
                      </Text>
                    </View>
                    {unalloc > 0 && (
                      <View style={styles.allocRow}>
                        <View style={{ width: 40 }} />
                        <Text style={[styles.allocTotalLabel, { color: colors.textMuted }]}>
                          Unallocated
                        </Text>
                        <Text style={[styles.allocAmount, { color: colors.textMuted }]}>
                          {formatCurrency(unalloc)}
                        </Text>
                      </View>
                    )}
                  </>
                );
              })()}

              {/* Save */}
              <TouchableOpacity
                style={styles.saveAllocBtn}
                onPress={saveEditAllocations}
                disabled={savingEdits}
                activeOpacity={0.8}
              >
                {savingEdits ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveAllocBtnText}>Save Allocations</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {plan.allocations.map((a) => {
                const catColor = a.category_color || colors.primary;
                const isEditingThis = editingField === `alloc:${a.id}`;
                return (
                  <View key={a.id} style={styles.allocRow}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: withOpacity(catColor, 0.2) },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={getCategoryIcon(a.category_name || "") as any}
                        size={18}
                        color={catColor}
                      />
                    </View>
                    <Text style={styles.allocName} numberOfLines={1}>
                      {a.category_name || "Unknown"}
                    </Text>
                    {isEditingThis ? (
                      <View style={styles.allocEditRow}>
                        <TextInput
                          style={styles.allocAmountInput}
                          value={editingValue}
                          onChangeText={setEditingValue}
                          keyboardType="decimal-pad"
                          autoFocus
                          selectTextOnFocus
                          onSubmitEditing={saveField}
                          returnKeyType="done"
                        />
                        <TouchableOpacity onPress={saveField} disabled={saving}>
                          {saving ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          setEditingField(`alloc:${a.id}`);
                          setEditingValue(a.amount);
                        }}
                      >
                        <Text style={styles.allocAmount}>
                          {formatCurrency(parseFloat(a.amount))}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              <View style={styles.divider} />
              <View style={styles.allocRow}>
                <View style={{ width: 40 }} />
                <Text style={styles.allocTotalLabel}>Total Allocated</Text>
                <Text style={styles.allocAmount}>
                  {formatCurrency(allocatedTotal)}
                </Text>
              </View>
              {totalAmount - allocatedTotal > 0 && (
                <View style={styles.allocRow}>
                  <View style={{ width: 40 }} />
                  <Text style={[styles.allocTotalLabel, { color: colors.textMuted }]}>
                    Unallocated
                  </Text>
                  <Text
                    style={[styles.allocAmount, { color: colors.textMuted }]}
                  >
                    {formatCurrency(totalAmount - allocatedTotal)}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Created date */}
        <Text style={styles.createdAt}>
          Created{" "}
          {new Date(plan.created_at).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Delete */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <Text style={styles.deleteBtnText}>Delete Plan</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>Add Category</Text>
            {availableCategories.length === 0 ? (
              <Text style={styles.pickerEmpty}>All categories are already allocated</Text>
            ) : (
              <FlatList
                data={availableCategories}
                keyExtractor={(item) => item.id}
                style={styles.pickerList}
                renderItem={({ item }) => (
                  <CategoryPickerRow item={item} onPress={addCategory} />
                )}
              />
            )}
            <TouchableOpacity
              style={styles.pickerCancelBtn}
              onPress={() => setShowCategoryPicker(false)}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
    backgroundColor: colors.surface,
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backArrow: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
    paddingBottom: 40,
  },

  // Summary
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 20,
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 12,
    flex: 1,
  },
  inlineEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  inlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 4,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 11,
    fontFamily: fonts.labelMedium,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  recurringBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  recurringBadgeText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.primary,
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  editBtn: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  // Toggle
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  toggleHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 2,
    maxWidth: 250,
  },

  // Allocations
  allocRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  allocName: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  allocAmount: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  allocEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  allocAmountInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    paddingVertical: 4,
    width: 90,
    textAlign: "right",
  },
  allocTotalLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
    marginLeft: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },

  // Footer
  createdAt: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 24,
  },
  deleteBtn: {
    borderRadius: borderRadius.lg,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteBtnText: {
    color: colors.error,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },

  // Edit mode
  removeBtn: {
    marginLeft: 8,
  },
  addCategoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  addCategoryText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  saveAllocBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveAllocBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },

  // Category Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 24,
    width: "85%",
    maxHeight: "60%",
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  pickerEmpty: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 20,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  pickerRowText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginLeft: 12,
  },
  pickerCancelBtn: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 10,
  },
  pickerCancelText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
});
