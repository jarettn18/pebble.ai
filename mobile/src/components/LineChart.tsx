import { View, StyleSheet } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from "react-native-svg";

type Point = {
  value: number;
};

type Props = {
  data: Point[];
  width: number;
  height?: number;
  color?: string;
  showGradient?: boolean;
};

export default function LineChart({
  data,
  width,
  height = 160,
  color = "#1a1a2e",
  showGradient = true,
}: Props) {
  if (data.length < 2) return null;

  const padding = { top: 8, bottom: 4, left: 0, right: 0 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  function x(i: number) {
    return padding.left + (i / (data.length - 1)) * chartW;
  }
  function y(val: number) {
    return padding.top + chartH - ((val - minVal) / range) * chartH;
  }

  // Build SVG path
  let linePath = `M ${x(0)} ${y(values[0])}`;
  for (let i = 1; i < values.length; i++) {
    linePath += ` L ${x(i)} ${y(values[i])}`;
  }

  // Fill path (closed polygon for gradient)
  const fillPath =
    linePath +
    ` L ${x(values.length - 1)} ${height} L ${x(0)} ${height} Z`;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.15" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {showGradient && (
          <Path d={fillPath} fill="url(#grad)" />
        )}
        <Path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
