import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, borderRadius, fonts } from "../theme";
import { contrastForeground } from "../utils/color";

const PALETTE = colors.colorPickerPalette;

type Props = {
  visible: boolean;
  currentColor: string | null;
  onSelect: (color: string) => void;
  onClose: () => void;
};

export default memo(function ColorPickerModal({ visible, currentColor, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Choose a Color</Text>
          <View style={styles.grid}>
            {PALETTE.map((color) => {
              const isSelected = currentColor?.toUpperCase() === color.toUpperCase();
              return (
                <TouchableOpacity
                  key={color}
                  style={[styles.swatch, { backgroundColor: color }]}
                  onPress={() => onSelect(color)}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check"
                      size={20}
                      color={contrastForeground(color)}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const SWATCH_SIZE = 44;
const GRID_GAP = 12;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: GRID_GAP,
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
});
