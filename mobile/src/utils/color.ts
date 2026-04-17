/**
 * Append hex alpha to a hex color string.
 * withOpacity("#45655A", 0.5) => "#45655A80"
 */
export function withOpacity(hex: string, opacity: number): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`;
}

/**
 * Return a category color, falling back to a palette color by index.
 */
export function getCategoryColor(
  color: string | null | undefined,
  palette: string[],
  index: number,
): string {
  return color || palette[index % palette.length];
}

/**
 * Return a contrasting foreground color (white or dark) for a given hex background.
 */
export function contrastForeground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Perceived luminance (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1a1c1c" : "#ffffff";
}
