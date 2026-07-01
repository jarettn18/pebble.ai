import { describe, it, expect } from "vitest";
import {
  demoUser,
  demoAccounts,
  demoAssets,
  demoCategories,
  demoTransactions,
} from "./data";

describe("demo data", () => {
  it("user has completed onboarding", () => {
    expect(demoUser.onboarding_completed).toBe(true);
  });

  it("has at least one account and asset", () => {
    expect(demoAccounts.length).toBeGreaterThan(0);
    expect(demoAssets.length).toBeGreaterThan(0);
  });

  it("generates dated transactions across multiple months", () => {
    const months = new Set(demoTransactions.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(3);
  });

  it("every transaction references a real category or null", () => {
    const ids = new Set(demoCategories.map((c) => c.id));
    for (const t of demoTransactions) {
      if (t.category_id !== null) expect(ids.has(t.category_id)).toBe(true);
    }
  });

  it("every transaction references a real account", () => {
    const ids = new Set(demoAccounts.map((a) => a.id));
    for (const t of demoTransactions) expect(ids.has(t.account_id)).toBe(true);
  });

  it("has both expense (positive) and income (negative) amounts", () => {
    const amts = demoTransactions.map((t) => parseFloat(t.amount));
    expect(amts.some((a) => a > 0)).toBe(true);
    expect(amts.some((a) => a < 0)).toBe(true);
  });
});
