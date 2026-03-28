export const CATEGORY_ICONS: Record<string, string> = {
  dining: "silverware-fork-knife",
  food: "silverware-fork-knife",
  restaurant: "silverware-fork-knife",
  groceries: "cart-outline",
  grocery: "cart-outline",
  shopping: "shopping-outline",
  transport: "car-outline",
  transportation: "car-outline",
  travel: "airplane",
  entertainment: "movie-open-outline",
  health: "spa-outline",
  wellness: "spa-outline",
  utilities: "flash-outline",
  subscriptions: "sync",
  rent: "home-outline",
  housing: "home-outline",
  education: "book-open-variant",
  personal: "account-outline",
  insurance: "shield-outline",
  savings: "piggy-bank-outline",
  investments: "chart-line",
};

export function getCategoryIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "clipboard-text-outline";
}
