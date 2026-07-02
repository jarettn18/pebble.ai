// Fake persona "Alex Rivera". All money fields are strings.
// Convention: expense amount > 0, income amount < 0.

export type DemoCategory = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type DemoAccount = {
  id: string;
  name: string;
  nickname: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  balance_current: string | null;
  balance_available: string | null;
  iso_currency_code: string | null;
  institution_name: string | null;
};

export type DemoAsset = {
  id: string;
  name: string;
  asset_type: string;
  estimated_value: string;
  address: string | null;
  notes: string | null;
};

export type DemoTransaction = {
  id: string;
  account_id: string;
  account_name: string | null;
  amount: string;
  date: string; // YYYY-MM-DD
  name: string;
  merchant_name: string | null;
  pending: boolean;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
};

export const demoUser = {
  id: "demo-user",
  email: "alex@demo.pebble.app",
  full_name: "Alex Rivera",
  subscription_tier: "premium",
  phone_number: "+15555550123",
  phone_verified: true,
  date_of_birth: "1992-05-14",
  occupation: "Product Designer",
  annual_income: 96000,
  state: "CA",
  marital_status: "single",
  dependents: 0,
  financial_goals: ["emergency_fund", "retirement", "home_purchase"],
  onboarding_completed: true,
  active: true,
};

export const demoCategories: DemoCategory[] = [
  { id: "cat-housing", name: "Housing", icon: "home", color: "#4F46E5" },
  { id: "cat-groceries", name: "Groceries", icon: "cart", color: "#059669" },
  { id: "cat-dining", name: "Dining", icon: "restaurant", color: "#DC2626" },
  { id: "cat-transport", name: "Transport", icon: "car", color: "#D97706" },
  { id: "cat-utilities", name: "Utilities", icon: "flash", color: "#0891B2" },
  { id: "cat-entertainment", name: "Entertainment", icon: "film", color: "#7C3AED" },
  { id: "cat-health", name: "Health", icon: "heart", color: "#DB2777" },
  { id: "cat-shopping", name: "Shopping", icon: "bag", color: "#EA580C" },
  { id: "cat-income", name: "Income", icon: "cash", color: "#16A34A" },
];

export const demoAccounts: DemoAccount[] = [
  {
    id: "acc-checking",
    name: "Everyday Checking",
    nickname: null,
    mask: "4821",
    type: "depository",
    subtype: "checking",
    balance_current: "4820.55",
    balance_available: "4620.55",
    iso_currency_code: "USD",
    institution_name: "Chase",
  },
  {
    id: "acc-savings",
    name: "High-Yield Savings",
    nickname: "Emergency Fund",
    mask: "9012",
    type: "depository",
    subtype: "savings",
    balance_current: "18250.00",
    balance_available: "18250.00",
    iso_currency_code: "USD",
    institution_name: "Ally",
  },
  {
    id: "acc-credit",
    name: "Sapphire Card",
    nickname: null,
    mask: "3344",
    type: "credit",
    subtype: "credit card",
    balance_current: "-1320.40",
    balance_available: "8679.60",
    iso_currency_code: "USD",
    institution_name: "Chase",
  },
];

export const demoAssets: DemoAsset[] = [
  {
    id: "asset-car",
    name: "2021 Honda Civic",
    asset_type: "vehicle",
    estimated_value: "19500.00",
    address: null,
    notes: "Paid off",
  },
  {
    id: "asset-brokerage",
    name: "Vanguard Brokerage",
    asset_type: "investment",
    estimated_value: "34200.00",
    address: null,
    notes: null,
  },
];

// Recurring monthly templates. day = day-of-month. amount follows the sign
// convention (expense > 0, income < 0).
type Template = {
  name: string;
  merchant: string | null;
  amount: string;
  day: number;
  account_id: string;
  category_id: string;
};

const TEMPLATES: Template[] = [
  { name: "Paycheck", merchant: "Acme Corp", amount: "-4000.00", day: 1, account_id: "acc-checking", category_id: "cat-income" },
  { name: "Paycheck", merchant: "Acme Corp", amount: "-4000.00", day: 15, account_id: "acc-checking", category_id: "cat-income" },
  { name: "Rent", merchant: "Skyline Apartments", amount: "2100.00", day: 2, account_id: "acc-checking", category_id: "cat-housing" },
  { name: "Whole Foods", merchant: "Whole Foods", amount: "142.30", day: 5, account_id: "acc-credit", category_id: "cat-groceries" },
  { name: "Trader Joe's", merchant: "Trader Joe's", amount: "88.75", day: 19, account_id: "acc-credit", category_id: "cat-groceries" },
  { name: "Dinner Out", merchant: "Nobu", amount: "76.40", day: 12, account_id: "acc-credit", category_id: "cat-dining" },
  { name: "Uber", merchant: "Uber", amount: "23.10", day: 8, account_id: "acc-credit", category_id: "cat-transport" },
  { name: "Electric Bill", merchant: "PG&E", amount: "94.20", day: 21, account_id: "acc-checking", category_id: "cat-utilities" },
  { name: "Netflix", merchant: "Netflix", amount: "15.99", day: 7, account_id: "acc-credit", category_id: "cat-entertainment" },
  { name: "Gym", merchant: "Equinox", amount: "68.00", day: 3, account_id: "acc-credit", category_id: "cat-health" },
  { name: "Amazon", merchant: "Amazon", amount: "54.99", day: 17, account_id: "acc-credit", category_id: "cat-shopping" },
];

function categoryName(id: string): string | null {
  return demoCategories.find((c) => c.id === id)?.name ?? null;
}
function categoryColor(id: string): string | null {
  return demoCategories.find((c) => c.id === id)?.color ?? null;
}
function accountName(id: string): string | null {
  return demoAccounts.find((a) => a.id === id)?.name ?? null;
}

/** Expand templates over the last `months` calendar months (including current). */
function generateTransactions(months: number): DemoTransaction[] {
  const out: DemoTransaction[] = [];
  const now = new Date();
  for (let back = 0; back < months; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    for (const t of TEMPLATES) {
      const day = String(t.day).padStart(2, "0");
      const date = `${y}-${String(m).padStart(2, "0")}-${day}`;
      // Every month is fully populated (including the current one) so the
      // dashboard's default month is never empty — even on the 1st.
      out.push({
        id: `txn-${y}-${m}-${t.day}-${t.name.replace(/\s+/g, "")}`,
        account_id: t.account_id,
        account_name: accountName(t.account_id),
        amount: t.amount,
        date,
        name: t.name,
        merchant_name: t.merchant,
        pending: false,
        category_id: t.category_id,
        category_name: categoryName(t.category_id),
        category_color: categoryColor(t.category_id),
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export const demoTransactions: DemoTransaction[] = generateTransactions(6);
