export const colors = {
  // Primary (Material 3 style)
  primary: "#45655a",
  primaryDark: "#2d4d42",
  primaryLight: "#87a99c",
  primaryContainer: "#87a99c",
  primaryFixed: "#c7eadc",
  primaryFixedDim: "#abcec0",
  onPrimaryFixedVariant: "#2d4d42",

  // Secondary
  secondary: "#23686a",
  secondaryContainer: "#aaebed",

  // Tertiary
  tertiary: "#005faf",
  tertiaryContainer: "#5ea4ff",
  tertiaryFixed: "#d4e3ff",

  // Surfaces
  background: "#ffffff",
  surface: "#e4e8e3",
  surfaceContainer: "#eeeeee",
  surfaceContainerLow: "#f3f3f3",
  surfaceContainerHigh: "#e8e8e8",
  surfaceGreen: "#c7eadc",

  // Text
  textPrimary: "#1b3d2f",
  textSecondary: "#2a3230",
  textMuted: "#717975",
  textOnPrimary: "#ffffff",

  // Semantic
  income: "#45655a",
  expense: "#1a1c1c",
  negative: "#ba1a1a",
  error: "#ba1a1a",
  errorBackground: "#ffdad6",

  // Chart palettes — design system colors
  // Extended category palette (8 distinct colors)
  categoryPalette: [
    "#45655A", // Sage (Housing)
    "#E67E66", // Soft Coral (Food & Drink)
    "#D99E33", // Ochre (Transport)
    "#8B7EBF", // Dusty Lavender (Shopping)
    "#C26D4D", // Terracotta (Entertainment)
    "#23686A", // Teal (Utilities)
    "#5B8D80", // Forest Green (Health)
    "#5488A8", // Ocean Blue (Subscriptions)
  ],
  spendingPalette: [
    "#45655A",
    "#E67E66",
    "#D99E33",
    "#8B7EBF",
    "#C26D4D",
    "#23686A",
    "#5B8D80",
    "#5488A8",
  ],
  incomePalette: [
    "#45655A",
    "#E67E66",
    "#D99E33",
    "#8B7EBF",
    "#C26D4D",
    "#23686A",
    "#5B8D80",
    "#5488A8",
  ],

  // Color picker palette (16 options)
  colorPickerPalette: [
    "#45655A", "#E67E66", "#D99E33", "#8B7EBF",
    "#C26D4D", "#23686A", "#5B8D80", "#5488A8",
    "#4CAF50", "#FF5722", "#9C27B0", "#3F51B5",
    "#FF9800", "#00BCD4", "#795548", "#607D8B",
  ],

  // Progress bars
  progressBar: "#45655a",

  // Borders/dividers
  border: "#c1c8c4",
  outlineVariant: "#c1c8c4",
  divider: "#e8e8e8",

  // Misc
  dotInactive: "#c1c8c4",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const borderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 9999,
};

export const fonts = {
  // Headline / body — Plus Jakarta Sans
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semiBold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold",
  // Label — Inter
  labelRegular: "Inter_400Regular",
  labelMedium: "Inter_500Medium",
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 20,
    elevation: 1,
  },
};

/** Reusable progress-bar styles (budget pill pattern). */
export const progressBarStyles = {
  container: {
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-end" as const,
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.labelMedium,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    color: colors.textPrimary,
    opacity: 0.7,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  valueSub: {
    fontSize: 13,
    fontWeight: "400" as const,
    opacity: 0.7,
  },
  remaining: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  track: {
    height: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 9999,
  },
  fill: {
    height: "100%" as unknown as number,
    backgroundColor: colors.progressBar,
    borderRadius: 9999,
  },
};
