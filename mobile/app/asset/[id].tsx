import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiRequest } from "../../src/api/client";
import { colors, borderRadius, shadows } from "../../src/theme";
import { useAssetsStore } from "../../src/stores/assets";
import { useDashboardStore } from "../../src/stores/dashboard";
import { formatCurrency } from "../../src/utils/dashboard";

type AssetDetail = {
  id: string;
  name: string;
  asset_type: string;
  estimated_value: string;
  address: string | null;
  notes: string | null;
};

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

const ASSET_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ASSET_TYPES.map((t) => [t.value, t.label])
);

const PROPERTY_TYPES = new Set([
  "primary_residence",
  "rental",
  "investment_property",
  "vacation",
  "land",
]);

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const removeAsset = useAssetsStore((s) => s.remove);
  const refreshDashboard = useDashboardStore((s) => s.refresh);

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function fetchAsset() {
      try {
        const data = await apiRequest<AssetDetail>(`/v1/assets/${id}`);
        setAsset(data);
        setName(data.name);
        setAssetType(data.asset_type);
        setEstimatedValue(data.estimated_value);
        setAddress(data.address || "");
        setNotes(data.notes || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    }
    fetchAsset();
  }, [id]);

  const hasChanges =
    asset !== null &&
    (name !== asset.name ||
      assetType !== asset.asset_type ||
      estimatedValue !== asset.estimated_value ||
      (address || null) !== (asset.address || null) ||
      (notes || null) !== (asset.notes || null));

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
      const updated = await apiRequest<AssetDetail>(`/v1/assets/${id}`, {
        method: "PUT",
        body: {
          name: name.trim(),
          asset_type: assetType,
          estimated_value: parseFloat(estimatedValue.trim()).toFixed(2),
          address: showAddress && address.trim() ? address.trim() : null,
          notes: notes.trim() || null,
        },
      });
      setAsset(updated);
      setName(updated.name);
      setAssetType(updated.asset_type);
      setEstimatedValue(updated.estimated_value);
      setAddress(updated.address || "");
      setNotes(updated.notes || "");
      refreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      "Delete Asset",
      "Are you sure you want to delete this asset? This will affect your net worth.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeAsset(id!);
              refreshDashboard();
              router.back();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete");
            }
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && !asset) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const value = asset ? parseFloat(asset.estimated_value) : 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Value Display */}
        <Text style={styles.valueDisplay}>{formatCurrency(value)}</Text>
        <Text style={styles.typeLabel}>
          {ASSET_TYPE_LABELS[asset?.asset_type ?? ""] ?? asset?.asset_type}
        </Text>

        {error && <Text style={styles.errorBanner}>{error}</Text>}

        {/* Asset Type */}
        <Text style={styles.sectionLabel}>Type</Text>
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
        <Text style={styles.sectionLabel}>Name</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Asset name"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Estimated Value */}
        <Text style={styles.sectionLabel}>Estimated Value</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={estimatedValue}
            onChangeText={setEstimatedValue}
            placeholder="e.g. 350000"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Address (property types only) */}
        {showAddress && (
          <>
            <Text style={styles.sectionLabel}>Address</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="123 Main St, City, State"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </>
        )}

        {/* Notes */}
        <Text style={styles.sectionLabel}>Notes</Text>
        <View style={styles.card}>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Save Button */}
        {hasChanges && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Delete Asset</Text>
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
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  valueDisplay: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipScroll: {
    flexGrow: 0,
    marginBottom: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
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
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  saveBtnText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  deleteBtnText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  errorBanner: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    padding: 12,
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.sm,
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
  },
  backBtnText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
});
