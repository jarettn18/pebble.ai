import { ReactNode } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { isDemoMode } from "../api/demo/mode";
import { shouldShowFrame, FRAME_WIDTH } from "../api/demo/frame";

const FRAME_MAX_HEIGHT = 844;
const FRAME_RADIUS = 40;
const BACKDROP = "#e5e7eb";

/**
 * Web-only. When demo mode is active on a wide viewport, renders the app inside
 * a centered, phone-width card so the mobile-designed components render at their
 * intended width. Otherwise (non-demo, or narrow viewport) it passes children
 * through full-bleed.
 */
export default function SimulatorFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();

  if (!shouldShowFrame(isDemoMode(), width)) {
    return <>{children}</>;
  }

  return (
    <View style={styles.backdrop}>
      <View
        style={[
          styles.frame,
          { height: Math.min(FRAME_MAX_HEIGHT, height) },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: BACKDROP,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: FRAME_WIDTH,
    borderRadius: FRAME_RADIUS,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
});
