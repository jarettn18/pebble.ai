import { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, fonts } from "../theme";
import { formatCurrency } from "../utils/dashboard";

type Slice = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  slices: Slice[];
  size?: number;
};

export default function PieChart({ slices, size = 110 }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 18;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  const innerR = r - strokeWidth / 2;
  const outerR = r + strokeWidth / 2;

  // Compute boundary angles between segments (memoized)
  const boundaries = useMemo(() => {
    const result: number[] = [];
    let angleSoFar = 0;
    for (let i = 0; i < slices.length; i++) {
      const sliceDeg = (slices[i].value / total) * 360;
      angleSoFar += sliceDeg;
      if (i < slices.length - 1) {
        result.push(angleSoFar);
      }
    }
    return result;
  }, [slices, total]);

  let cumulativeOffset = 0;

  // Build invisible hit areas for each segment (filled wedges)
  function wedgePath(startDeg: number, endDeg: number): string {
    const startRad = ((startDeg - 90) * Math.PI) / 180;
    const endRad = ((endDeg - 90) * Math.PI) / 180;
    const x1 = cx + innerR * Math.cos(startRad);
    const y1 = cy + innerR * Math.sin(startRad);
    const x2 = cx + outerR * Math.cos(startRad);
    const y2 = cy + outerR * Math.sin(startRad);
    const x3 = cx + outerR * Math.cos(endRad);
    const y3 = cy + outerR * Math.sin(endRad);
    const x4 = cx + innerR * Math.cos(endRad);
    const y4 = cy + innerR * Math.sin(endRad);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} L ${x2} ${y2} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1} ${y1} Z`;
  }

  const selected = selectedIndex !== null ? slices[selectedIndex] : null;

  return (
    <View style={styles.wrapper}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Colored segments */}
          {slices.map((slice) => {
            const sliceDeg = (slice.value / total) * 360;
            const dashLength = (sliceDeg / 360) * circumference;
            const dashGap = circumference - dashLength;
            const rotation = -90 + cumulativeOffset;
            cumulativeOffset += sliceDeg;

            return (
              <Circle
                key={slice.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${dashGap}`}
                rotation={rotation}
                origin={`${cx}, ${cy}`}
              />
            );
          })}
          {/* Curved divider lines at segment boundaries */}
          {boundaries.map((angleDeg, i) => {
            const rad = ((angleDeg - 90) * Math.PI) / 180;
            const x1 = cx + innerR * Math.cos(rad);
            const y1 = cy + innerR * Math.sin(rad);
            const x2 = cx + outerR * Math.cos(rad);
            const y2 = cy + outerR * Math.sin(rad);
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const curvature = 3;
            const cpX = midX + curvature * -Math.sin(rad);
            const cpY = midY + curvature * Math.cos(rad);
            return (
              <Path
                key={`divider-${i}`}
                d={`M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`}
                stroke="rgba(0,0,0,0.05)"
                strokeWidth={1.5}
                fill="none"
              />
            );
          })}
          {/* Invisible tap targets */}
          {(() => {
            let startAngle = 0;
            return slices.map((slice, i) => {
              const sliceDeg = (slice.value / total) * 360;
              const endAngle = startAngle + sliceDeg;
              const d = wedgePath(startAngle, endAngle);
              startAngle = endAngle;
              return (
                <Path
                  key={`tap-${slice.label}`}
                  d={d}
                  fill="transparent"
                  onPressIn={() => setSelectedIndex(i)}
                  onPressOut={() => setSelectedIndex(null)}
                />
              );
            });
          })()}
        </Svg>
        {/* Center bubble */}
        {selected && (
          <View style={styles.bubble} pointerEvents="none">
            <Text style={styles.bubbleAmount}>{formatCurrency(selected.value)}</Text>
            <Text style={styles.bubbleLabel} numberOfLines={1}>{selected.label}</Text>
          </View>
        )}
      </View>
      <View style={styles.legend}>
        {slices.slice(0, 6).map((slice, i) => {
          const pct = ((slice.value / total) * 100).toFixed(0);
          const isSelected = selectedIndex === i;
          return (
            <TouchableOpacity
              key={slice.label}
              style={styles.legendRow}
              onPress={() => setSelectedIndex(isSelected ? null : i)}
              activeOpacity={0.7}
            >
              <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {slice.label}
              </Text>
              {isSelected ? (
                <Text style={[styles.legendPct, { color: slice.color }]}>
                  {formatCurrency(slice.value)}
                </Text>
              ) : (
                <Text style={styles.legendPct}>{pct}%</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  bubble: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleAmount: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  bubbleLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    maxWidth: 70,
    textAlign: "center",
  },
  legend: {
    flex: 1,
    marginLeft: 16,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 4,
  },
  legendPct: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    minWidth: 32,
    textAlign: "right",
  },
});
