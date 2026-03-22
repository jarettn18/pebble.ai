import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAssetsStore } from "../src/stores/assets";
import { useDashboardStore } from "../src/stores/dashboard";
import { colors, borderRadius, shadows } from "../src/theme";

const ASSET_TYPES = [
  { value: "primary_residence", label: "Primary Residence" },
  { value: "rental", label: "Rental" },
  { value: "investment_property", label: "Investment Property" },
  { value: "vacation", label: "Vacation" },
  { value: "land", label: "Land" },
  { value: "car", label: "Car" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "boat", label: "Boat" },
  { value: "other", label: "Other" },
];

const PROPERTY_TYPES = new Set([
  "primary_residence",
  "rental",
  "investment_property",
  "vacation",
  "land",
]);

export default function AddAssetScreen() {
  const router = useRouter();
  const createAsset = useAssetsStore((s) => s.create);
  const refreshDashboard = useDashboardStore((s) => s.refresh);

  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("primary_residence");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showAddress = PROPERTY_TYPES.has(assetType);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!estimatedValue.trim() || isNaN(parseFloat(estimatedValue))) {
      setError("Enter a valid estimated value");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await createAsset({
        name: name.trim(),
        asset_type: assetType,
        estimated_value: parseFloat(estimatedValue.trim()).toFixed(2),
        address: showAddress && address.trim() ? address.trim() : null,
        notes: notes.trim() || null,
      });
      refreshDashboard();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Asset Type */}
        <Text style={styles.label}>Type</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
        >
          {ASSET_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.chip,
                assetType === type.value && styles.chipSelected,
              ]}
              onPress={() => setAssetType(type.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  assetType === type.value && styles.chipTextSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Name */}
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={
            PROPERTY_TYPES.has(assetType)
              ? "e.g. Beach House"
              : "e.g. 2022 Tesla Model 3"
          }
          placeholderTextColor={colors.textMuted}
        />

        {/* Estimated Value */}
        <Text style={styles.label}>Estimated Value</Text>
        <TextInput
          style={styles.input}
          value={estimatedValue}
          onChangeText={setEstimatedValue}
          placeholder="e.g. 350000"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
        />

        {/* Address (property types only) */}
        {showAddress && (
          <>
            <Text style={styles.label}>Address (optional)</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="123 Main St, City, State"
              placeholderTextColor={colors.textMuted}
            />
          </>
        )}

        {/* Notes */}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add a note..."
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>Add Asset</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 14,
    fontSize: 14,
    color: colors.textPrimary,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.textOnPrimary,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    padding: 12,
    backgroundColor: colors.errorBackground,
    borderRadius: 8,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
});
