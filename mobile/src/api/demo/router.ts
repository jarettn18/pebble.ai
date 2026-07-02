import {
  demoUser,
  demoAccounts,
  demoAssets,
  demoCategories,
  demoTransactions,
  DemoTransaction,
} from "./data";

type Query = URLSearchParams;

function splitPath(path: string): { pathname: string; query: Query } {
  const [pathname, qs = ""] = path.split("?");
  return { pathname, query: new URLSearchParams(qs) };
}

function monthOf(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

function filterTransactions(q: Query): DemoTransaction[] {
  let txns = demoTransactions;
  const from = q.get("date_from");
  const to = q.get("date_to");
  const type = q.get("type");
  const categoryId = q.get("category_id");
  const accountId = q.get("account_id");
  const search = q.get("search");
  const month = q.get("month");
  const year = q.get("year");

  if (from) txns = txns.filter((t) => t.date >= from);
  if (to) txns = txns.filter((t) => t.date <= to);
  if (type === "expense") txns = txns.filter((t) => parseFloat(t.amount) > 0);
  if (type === "income") txns = txns.filter((t) => parseFloat(t.amount) < 0);
  if (categoryId) {
    const ids = categoryId.split(",");
    txns = txns.filter((t) => t.category_id && ids.includes(t.category_id));
  }
  if (accountId) txns = txns.filter((t) => t.account_id === accountId);
  if (search) {
    const s = search.toLowerCase();
    txns = txns.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        (t.merchant_name?.toLowerCase().includes(s) ?? false)
    );
  }
  if (month && year) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    txns = txns.filter((t) => monthOf(t.date) === key);
  }
  const limit = q.get("limit");
  if (limit) txns = txns.slice(0, parseInt(limit, 10));
  return txns;
}

function groupByCategory(txns: DemoTransaction[], sign: "expense" | "income") {
  const map = new Map<string, { name: string; color: string | null; total: number }>();
  for (const t of txns) {
    const amt = parseFloat(t.amount);
    if (sign === "expense" && amt <= 0) continue;
    if (sign === "income" && amt >= 0) continue;
    const id = t.category_id ?? "uncategorized";
    const existing = map.get(id) ?? {
      name: t.category_name ?? "Uncategorized",
      color: t.category_color,
      total: 0,
    };
    existing.total += Math.abs(amt);
    map.set(id, existing);
  }
  return [...map.entries()].map(([category_id, v]) => ({
    category_id,
    category_name: v.name,
    category_color: v.color,
    amount: v.total.toFixed(2),
  }));
}

function netWorth(): number {
  const accountTotal = demoAccounts.reduce(
    (sum, a) => sum + parseFloat(a.balance_current ?? "0"),
    0
  );
  const assetTotal = demoAssets.reduce(
    (sum, a) => sum + parseFloat(a.estimated_value),
    0
  );
  return accountTotal + assetTotal;
}

function monthTotals(month: string, year: string) {
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const txns = demoTransactions.filter((t) => monthOf(t.date) === key);
  const spending = txns
    .filter((t) => parseFloat(t.amount) > 0)
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const income = txns
    .filter((t) => parseFloat(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
  return { txns, spending, income };
}

function lastMonthsSeries(makeVal: (key: string) => number, count: number) {
  const now = new Date();
  const points = [];
  for (let back = count - 1; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    points.push({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: d.toLocaleString("en-US", { month: "short" }),
      amount: makeVal(key).toFixed(2),
    });
  }
  return points;
}

function budgetsFor(month: string, year: string) {
  const { txns } = monthTotals(month, year);
  const spentByCat = new Map<string, number>();
  for (const t of txns) {
    const amt = parseFloat(t.amount);
    if (amt > 0 && t.category_id)
      spentByCat.set(t.category_id, (spentByCat.get(t.category_id) ?? 0) + amt);
  }
  const budgeted: Record<string, string> = {
    "cat-housing": "2100.00",
    "cat-groceries": "400.00",
    "cat-dining": "200.00",
    "cat-transport": "150.00",
    "cat-utilities": "150.00",
    "cat-entertainment": "80.00",
    "cat-health": "100.00",
    "cat-shopping": "150.00",
  };
  return Object.entries(budgeted).map(([category_id, amount]) => {
    const cat = demoCategories.find((c) => c.id === category_id);
    return {
      id: `budget-${category_id}`,
      category_id,
      category_name: cat?.name ?? null,
      category_color: cat?.color ?? null,
      amount,
      spent: (spentByCat.get(category_id) ?? 0).toFixed(2),
      month: parseInt(month, 10),
      year: parseInt(year, 10),
    };
  });
}

const HEALTH_SCORE = {
  overall_score: 78,
  grade: "B+",
  components: [
    { name: "savings_rate", label: "Savings Rate", score: 82, weight: 0.25, detail: "You save 21% of income", status: "good", has_data: true },
    { name: "emergency_fund", label: "Emergency Fund", score: 74, weight: 0.25, detail: "4.5 months of expenses saved", status: "good", has_data: true },
    { name: "debt_ratio", label: "Debt Ratio", score: 88, weight: 0.25, detail: "Low credit utilization", status: "good", has_data: true },
    { name: "spending", label: "Spending Stability", score: 68, weight: 0.25, detail: "Spending is fairly consistent", status: "fair", has_data: true },
  ],
  data_completeness: 1,
  missing_data: [] as string[],
  insights: [
    {
      category: "savings_rate",
      title: "Above-average saver",
      description: "Your savings rate beats most people in your age bracket.",
      percentile: 72,
      comparison: "higher than 72% of 30-34 year olds",
      source: "Federal Reserve SCF",
      age_bracket_label: "30-34",
    },
  ],
  calculated_at: new Date().toISOString(),
};

function ok(): Record<string, never> {
  return {};
}

export async function handleDemoRequest<T = unknown>(
  path: string,
  method: string = "GET",
  _body?: unknown
): Promise<T> {
  const m = method.toUpperCase();
  const { pathname, query } = splitPath(path);

  // Writes never mutate — return a benign success.
  if (m !== "GET") return ok() as T;

  // Auth
  if (pathname === "/v1/auth/me") return demoUser as T;

  // Accounts
  if (pathname === "/v1/accounts") return { accounts: demoAccounts } as T;
  if (pathname.startsWith("/v1/accounts/")) {
    const id = pathname.split("/")[3];
    return (demoAccounts.find((a) => a.id === id) ?? {}) as T;
  }

  // Dashboard
  if (pathname === "/v1/dashboard") {
    const now = new Date();
    const month = query.get("month") ?? String(now.getMonth() + 1);
    const year = query.get("year") ?? String(now.getFullYear());
    const { spending, income } = monthTotals(month, year);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const monthTxns = demoTransactions.filter((t) => monthOf(t.date) === key);
    return {
      net_worth: netWorth().toFixed(2),
      monthly_spending: spending.toFixed(2),
      monthly_income: income.toFixed(2),
      accounts: demoAccounts.map((a) => ({
        id: a.id, name: a.name, nickname: a.nickname, mask: a.mask,
        type: a.type, subtype: a.subtype, balance_current: a.balance_current,
        institution_name: a.institution_name,
      })),
      assets: demoAssets.map((a) => ({
        id: a.id, name: a.name, asset_type: a.asset_type, estimated_value: a.estimated_value,
      })),
      budget_summaries: budgetsFor(month, year).map((b) => ({
        category_id: b.category_id, category_name: b.category_name,
        category_color: b.category_color, amount: b.amount, spent: b.spent,
      })),
      spending_by_category: groupByCategory(monthTxns, "expense"),
      income_by_category: groupByCategory(monthTxns, "income"),
      spending_over_time: lastMonthsSeries(
        (k) => demoTransactions.filter((t) => monthOf(t.date) === k && parseFloat(t.amount) > 0)
          .reduce((s, t) => s + parseFloat(t.amount), 0),
        6
      ),
      income_over_time: lastMonthsSeries(
        (k) => demoTransactions.filter((t) => monthOf(t.date) === k && parseFloat(t.amount) < 0)
          .reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0),
        6
      ),
    } as T;
  }
  if (pathname === "/v1/dashboard/net-worth-history") {
    const nw = netWorth();
    const points = lastMonthsSeries(() => 0, 12).map((p, i, arr) => ({
      date: `${p.year}-${String(p.month).padStart(2, "0")}-01`,
      value: (nw * (0.85 + (0.15 * (i + 1)) / arr.length)).toFixed(2),
    }));
    const first = parseFloat(points[0].value);
    return {
      period: query.get("period") ?? "1Y",
      points,
      current: nw.toFixed(2),
      change: (nw - first).toFixed(2),
    } as T;
  }

  // Transactions
  if (pathname === "/v1/transactions") {
    const txns = filterTransactions(query);
    return { transactions: txns, count: txns.length } as T;
  }
  if (pathname.startsWith("/v1/transactions/")) {
    const id = pathname.split("/")[3];
    return (demoTransactions.find((t) => t.id === id) ?? {}) as T;
  }

  // Budgets
  if (pathname === "/v1/budgets") {
    const now = new Date();
    const month = query.get("month") ?? String(now.getMonth() + 1);
    const year = query.get("year") ?? String(now.getFullYear());
    return { budgets: budgetsFor(month, year) } as T;
  }
  if (pathname.startsWith("/v1/budgets/")) return {} as T;

  // Budget plans
  if (pathname === "/v1/budget-plans") return { budget_plans: [] } as T;
  if (pathname.startsWith("/v1/budget-plans/")) return {} as T;

  // Assets
  if (pathname === "/v1/assets") return { assets: demoAssets } as T;
  if (pathname.startsWith("/v1/assets/")) {
    const id = pathname.split("/")[3];
    return (demoAssets.find((a) => a.id === id) ?? {}) as T;
  }

  // Categories
  if (pathname === "/v1/categories") return { categories: demoCategories } as T;
  if (pathname.startsWith("/v1/categories/")) return {} as T;

  // Health score
  if (pathname === "/v1/health-score") return HEALTH_SCORE as T;
  if (pathname === "/v1/health-score/history") {
    return {
      period: query.get("period") ?? "6M",
      scores: lastMonthsSeries(() => 0, 6).map((p, i) => ({
        date: `${p.year}-${String(p.month).padStart(2, "0")}-01`,
        score: 70 + i,
        grade: "B",
      })),
    } as T;
  }

  // AI + API keys — empty so nothing errors, feature is disabled elsewhere
  if (pathname === "/v1/ai/models") return { models: [], default: null } as T;
  if (pathname === "/v1/ai/conversations") return { conversations: [] } as T;
  if (pathname.startsWith("/v1/ai/conversations/")) return { messages: [] } as T;
  if (pathname === "/v1/api-keys") return { api_keys: [] } as T;

  // Unknown GET — empty object avoids throwing.
  return {} as T;
}
