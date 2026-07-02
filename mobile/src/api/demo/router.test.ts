import { describe, it, expect } from "vitest";
import { handleDemoRequest } from "./router";

describe("handleDemoRequest — reads", () => {
  it("returns the demo user for /v1/auth/me", async () => {
    const res: any = await handleDemoRequest("/v1/auth/me", "GET");
    expect(res.onboarding_completed).toBe(true);
    expect(res.full_name).toBe("Alex Rivera");
  });

  it("returns accounts wrapped in { accounts }", async () => {
    const res: any = await handleDemoRequest("/v1/accounts", "GET");
    expect(Array.isArray(res.accounts)).toBe(true);
    expect(res.accounts.length).toBeGreaterThan(0);
  });

  it("filters transactions by month via dashboard aggregates", async () => {
    const now = new Date();
    const res: any = await handleDemoRequest(
      `/v1/dashboard?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
      "GET"
    );
    expect(parseFloat(res.monthly_income)).toBeGreaterThan(0);
    expect(parseFloat(res.monthly_spending)).toBeGreaterThan(0);
    expect(Array.isArray(res.spending_by_category)).toBe(true);
  });

  it("filters transactions by type=income (negative amounts)", async () => {
    const res: any = await handleDemoRequest(
      "/v1/transactions?type=income&limit=200",
      "GET"
    );
    expect(res.transactions.length).toBeGreaterThan(0);
    for (const t of res.transactions) expect(parseFloat(t.amount)).toBeLessThan(0);
  });

  it("filters transactions by date range", async () => {
    const res: any = await handleDemoRequest(
      "/v1/transactions?date_from=1900-01-01&date_to=1900-12-31&limit=200",
      "GET"
    );
    expect(res.transactions.length).toBe(0);
  });

  it("returns budgets for a month", async () => {
    const res: any = await handleDemoRequest("/v1/budgets?month=1&year=2026", "GET");
    expect(Array.isArray(res.budgets)).toBe(true);
    expect(res.budgets.length).toBeGreaterThan(0);
  });

  it("returns a health score", async () => {
    const res: any = await handleDemoRequest("/v1/health-score", "GET");
    expect(typeof res.overall_score).toBe("number");
    expect(Array.isArray(res.components)).toBe(true);
  });

  it("returns empty AI + api-key lists so nothing errors", async () => {
    expect((await handleDemoRequest("/v1/ai/models", "GET") as any).models).toEqual([]);
    expect((await handleDemoRequest("/v1/ai/conversations", "GET") as any).conversations).toEqual([]);
    expect((await handleDemoRequest("/v1/api-keys", "GET") as any).api_keys).toEqual([]);
  });
});

describe("handleDemoRequest — writes are no-ops", () => {
  it("POST returns success without throwing", async () => {
    const res: any = await handleDemoRequest("/v1/transactions", "POST", {
      account_id: "acc-checking",
      amount: "10.00",
      date: "2026-01-01",
      name: "Test",
    });
    expect(res).toBeTruthy();
  });

  it("DELETE returns undefined-ish success", async () => {
    await expect(
      handleDemoRequest("/v1/budgets/whatever", "DELETE")
    ).resolves.not.toThrow();
  });
});
