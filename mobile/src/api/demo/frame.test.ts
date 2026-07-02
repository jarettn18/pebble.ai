import { describe, it, expect } from "vitest";
import { shouldShowFrame, FRAME_BREAKPOINT } from "./frame";

describe("shouldShowFrame", () => {
  it("shows the frame when demo is active and the viewport is wide", () => {
    expect(shouldShowFrame(true, 1024)).toBe(true);
  });

  it("shows the frame exactly at the breakpoint", () => {
    expect(shouldShowFrame(true, FRAME_BREAKPOINT)).toBe(true);
  });

  it("hides the frame on a narrow viewport even in demo mode", () => {
    expect(shouldShowFrame(true, 390)).toBe(false);
  });

  it("never shows the frame when demo is inactive", () => {
    expect(shouldShowFrame(false, 1024)).toBe(false);
  });

  it("respects a custom breakpoint", () => {
    expect(shouldShowFrame(true, 500, 400)).toBe(true);
    expect(shouldShowFrame(true, 300, 400)).toBe(false);
  });
});
