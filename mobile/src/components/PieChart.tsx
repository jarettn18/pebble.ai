import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

type Slice = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  slices: Slice[];
  size?: number;
};

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export default function PieChart({ slices, size = 140 }: Props) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  let currentAngle = 0;

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size}>
        {slices.map((slice) => {
          const sliceAngle = (slice.value / total) * 360;
          // Handle full circle case
          if (slices.length === 1) {
            const d = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
            return <Path key={slice.label} d={d} fill={slice.color} />;
          }
          const startAngle = currentAngle;
          const endAngle = currentAngle + sliceAngle;
          currentAngle = endAngle;
          const d = arcPath(cx, cy, r, startAngle, endAngle);
          return <Path key={slice.label} d={d} fill={slice.color} />;
        })}
      </Svg>
      <View style={styles.legend}>
        {slices.slice(0, 5).map((slice) => {
          const pct = ((slice.value / total) * 100).toFixed(0);
          return (
            <View key={slice.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {slice.label}
              </Text>
              <Text style={styles.legendPct}>{pct}%</Text>
            </View>
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
    color: "#1a1a2e",
    flex: 1,
    marginRight: 4,
  },
  legendPct: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    minWidth: 32,
    textAlign: "right",
  },
});
