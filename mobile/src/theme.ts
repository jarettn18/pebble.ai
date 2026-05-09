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
  background: "#FAFAF7",
  surface: "#ffffff",
  surfaceContainer: "#f3f3f0",
  surfaceContainerLow: "#f7f7f4",
  surfaceContainerHigh: "#ebebe8",
  surfaceGreen: "#c7eadc",
  surfaceTinted: "#e4e8e3",

  // Hero / accent (2026-04-23 dashboard redesign)
  heroSurface: "#0F3D2E",
  heroSurfaceAlt: "#1A5D46",
  heroBorder: "rgba(255,255,255,0.08)",
  heroDivider: "rgba(255,255,255,0.10)",
  heroFill: "rgba(255,255,255,0.06)",        // subtle inner surface on hero
  heroTrack: "rgba(255,255,255,0.12)",       // progress track on hero
  heroFillStrong: "rgba(255,255,255,0.18)",  // emphasized inner surface on hero
  heroPlaceholder: "rgba(255,255,255,0.35)", // placeholder text on hero
  heroTextPrimary: "#ffffff",
  heroTextSecondary: "rgba(255,255,255,0.70)",
  heroTextMuted: "rgba(255,255,255,0.55)",
  heroLabel: "rgba(255,255,255,0.65)",
  heroNegative: "#FF9A85",
  heroDebt: "rgba(255,255,255,0.78)",
  accent: "#F4A261",
  accentDark: "#D98E4F",
  accentSoft: "rgba(244,162,97,0.18)",
  accentBorder: "rgba(244,162,97,0.28)",        // 1px borders on accent containers
  accentBorderStrong: "rgba(244,162,97,0.32)",  // active/focused accent border
  accentTrack: "rgba(244,162,97,0.45)",         // switch on-state track
  incomePositive: "#2BA671",
  // Trend chart dim variants (used as faded fills on line/area charts)
  incomeTrendDim: "rgba(43,166,113,0.32)",
  spendingTrendDim: "rgba(244,162,97,0.32)",

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

  // Health score grades (light surfaces)
  gradeA: "#2e7d32",
  gradeB: "#45655a",
  gradeC: "#d99e33",
  gradeD: "#e67e66",
  gradeF: "#ba1a1a",

  // Health score grades (dark hero surfaces — brighter to maintain 4.5:1 contrast)
  gradeADark: "#5ED39B",
  gradeBDark: "#C7EADC",
  gradeCDark: "#F4C261",
  gradeDDark: "#FFB59B",
  gradeFDark: "#FF8A7A",

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
  // Aliases — currently identical; split later if designs diverge
  get spendingPalette() { return this.categoryPalette; },
  get incomePalette() { return this.categoryPalette; },

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
  trackLight: "rgba(15,61,46,0.08)",   // sage-tinted progress track on light surfaces

  // Modal/scrim
  scrim: "rgba(0,0,0,0.4)",            // standard modal/sheet scrim
  scrimStrong: "rgba(0,0,0,0.5)",      // destructive confirmation
  scrimSubtle: "rgba(0,0,0,0.3)",      // header fade / subtle dim

  // Misc
  dotInactive: "#c1c8c4",
  switchThumb: "#f4f3f4",              // iOS default switch thumb
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
    shadowColor: "#0F3D2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  hero: {
    shadowColor: "#0F3D2E",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
};

/** Unified hero-card styling. Used by NetWorth, Accounts, Income, Spending, Health cards. */
export const heroCard = {
  surface: {
    backgroundColor: colors.heroSurface,
    borderRadius: borderRadius.lg,
    padding: 24,
    overflow: "hidden" as const,
    position: "relative" as const,
    ...shadows.hero,
  },
  glow: {
    position: "absolute" as const,
    top: -80,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.heroSurfaceAlt,
    opacity: 0.55,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.labelMedium,
    color: colors.heroLabel,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginBottom: 8,
  },
  value: {
    fontSize: 36,
    fontFamily: fonts.extraBold,
    color: colors.heroTextPrimary,
    letterSpacing: -0.5,
  },
  valueNegative: {
    color: colors.heroNegative,
  },
  hint: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.heroTextSecondary,
    marginTop: 8,
  },
  link: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.accent,
    marginTop: 12,
  },
};

/** Shared micro-label token (tracked, tiny, uppercase). Use for card section headers. */
export const microLabel = {
  fontSize: 12,
  fontFamily: fonts.labelMedium,
  letterSpacing: 2,
  textTransform: "uppercase" as const,
};

/** 11px variant — for eyebrow/section labels on cards and inside compact contexts. */
export const microLabelSmall = {
  fontSize: 11,
  fontFamily: fonts.labelMedium,
  letterSpacing: 2,
  textTransform: "uppercase" as const,
};

/** 10px variant — for the smallest tracked labels (e.g. status caption under a value). */
export const microLabelTiny = {
  fontSize: 10,
  fontFamily: fonts.labelMedium,
  letterSpacing: 2,
  textTransform: "uppercase" as const,
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
    fontSize: 12,
    fontFamily: fonts.labelMedium,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  valueSub: {
    fontSize: 13,
    fontFamily: fonts.regular,
    opacity: 0.7,
  },
  remaining: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  track: {
    height: 14,
    backgroundColor: colors.trackLight,
    borderRadius: borderRadius.pill,
    overflow: "hidden" as const,
  },
  fill: {
    height: "100%" as unknown as number,
    backgroundColor: colors.progressBar,
    borderRadius: borderRadius.pill,
  },
};

/** Progress-pill styles for use on dark hero surfaces. Mirrors progressBarStyles. */
export const heroProgressBarStyles = {
  container: {
    padding: 16,
    backgroundColor: colors.heroFill,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.heroBorder,
    marginTop: 20,
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-end" as const,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.labelMedium,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: colors.heroLabel,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.heroTextPrimary,
  },
  valueSub: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.heroTextSecondary,
  },
  remaining: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.heroTextPrimary,
  },
  track: {
    height: 14,
    backgroundColor: colors.heroTrack,
    borderRadius: borderRadius.pill,
    overflow: "hidden" as const,
  },
  fill: {
    height: "100%" as unknown as number,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.pill,
  },
};
