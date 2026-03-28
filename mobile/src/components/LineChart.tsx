import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { colors, fonts } from "../theme";

type Point = {
  value: number;
};

type XLabel = {
  index: number;
  label: string;
};

type Props = {
  data: Point[];
  width: number;
  height?: number;
  color?: string;
  showGradient?: boolean;
  /** Total number of slots on the x-axis. If greater than data.length,
   *  the chart leaves empty space on the right. */
  totalSlots?: number;
  /** Show dollar amount labels on the y-axis. */
  showYAxis?: boolean;
  /** Labels to display on the x-axis at specific data indices. */
  xLabels?: XLabel[];
};

function formatYLabel(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

const Y_LABEL_WIDTH = 48;
const Y_TICK_COUNT = 4;
const X_LABEL_HEIGHT = 20;

export default memo(function LineChart({
  data,
  width,
  height = 160,
  color = colors.primary,
  showGradient = true,
  totalSlots,
  showYAxis = false,
  xLabels,
}: Props) {
  if (data.length < 2) return null;

  const hasXLabels = xLabels && xLabels.length > 0;
  const labelW = showYAxis ? Y_LABEL_WIDTH : 0;
  const xLabelH = hasXLabels ? X_LABEL_HEIGHT : 0;
  const totalHeight = height + xLabelH;
  const padding = { top: 8, bottom: 4, left: 0, right: 0 };
  const chartW = width - labelW - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const slots = Math.max(totalSlots ?? data.length, data.length);
  function x(i: number) {
    return padding.left + (i / (slots - 1)) * chartW;
  }
  function y(val: number) {
    return padding.top + chartH - ((val - minVal) / range) * chartH;
  }

  // Build smooth SVG path using cubic bezier curves
  let linePath = `M ${x(0)} ${y(values[0])}`;
  for (let i = 1; i < values.length; i++) {
    const x0 = x(i - 1);
    const y0 = y(values[i - 1]);
    const x1 = x(i);
    const y1 = y(values[i]);
    const cpx = (x0 + x1) / 2;
    linePath += ` C ${cpx} ${y0}, ${cpx} ${y1}, ${x1} ${y1}`;
  }

  // Fill path (closed polygon for gradient)
  const fillPath =
    linePath +
    ` L ${x(values.length - 1)} ${height} L ${x(0)} ${height} Z`;

  // Y-axis tick values
  const yTicks: number[] = [];
  if (showYAxis) {
    for (let i = 0; i < Y_TICK_COUNT; i++) {
      yTicks.push(minVal + (range * i) / (Y_TICK_COUNT - 1));
    }
  }

  // Key forces SVG to remount when the path data changes,
  // working around react-native-svg caching stale paths.
  const svgKey = linePath;

  return (
    <View style={[styles.container, { width, height: totalHeight }]}>
      {showYAxis && (
        <View style={[styles.yAxis, { width: labelW, height }]}>
          {yTicks.map((tick, i) => (
            <Text
              key={i}
              style={[
                styles.yLabel,
                {
                  position: "absolute",
                  top: y(tick) - 7,
                },
              ]}
            >
              {formatYLabel(tick)}
            </Text>
          ))}
        </View>
      )}
      <View>
        <Svg key={svgKey} width={chartW} height={height}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.25" />
              <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {showGradient && (
            <Path d={fillPath} fill="url(#grad)" />
          )}
          <Path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        {hasXLabels && (
          <View style={[styles.xAxis, { width: chartW, height: xLabelH }]}>
            {xLabels.map((xl, i) => (
              <Text
                key={i}
                style={[
                  styles.xLabel,
                  {
                    position: "absolute",
                    left: x(xl.index) - 20,
                    width: 40,
                  },
                ]}
              >
                {xl.label}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    flexDirection: "row",
  },
  yAxis: {
    justifyContent: "space-between",
  },
  yLabel: {
    fontSize: 10,
    fontFamily: fonts.labelMedium,
    color: colors.textMuted,
    textAlign: "right",
    paddingRight: 6,
  },
  xAxis: {
    position: "relative",
  },
  xLabel: {
    fontSize: 10,
    fontFamily: fonts.labelMedium,
    color: colors.textMuted,
    textAlign: "center",
  },
});
