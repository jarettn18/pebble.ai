import { describe, it, expect } from "vitest";
import { resolveDemoMode } from "./mode";

describe("resolveDemoMode", () => {
  it("is true when the URL has demo=1", () => {
    expect(resolveDemoMode("?demo=1", null)).toBe(true);
  });

  it("is true when sessionStorage flag is set", () => {
    expect(resolveDemoMode("", "1")).toBe(true);
  });

  it("is false with no param and no stored flag", () => {
    expect(resolveDemoMode("", null)).toBe(false);
  });

  it("is false when demo param is not 1", () => {
    expect(resolveDemoMode("?demo=0", null)).toBe(false);
  });

  it("handles an undefined search string", () => {
    expect(resolveDemoMode(undefined, null)).toBe(false);
  });
});
