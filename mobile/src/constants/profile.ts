export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

export const MARITAL_OPTIONS = [
  "single",
  "married",
  "divorced",
  "widowed",
  "separated",
];

export const GOAL_OPTIONS = [
  { value: "emergency_fund", label: "Emergency Fund" },
  { value: "debt_payoff", label: "Debt Payoff" },
  { value: "home_purchase", label: "Home Purchase" },
  { value: "retirement", label: "Retirement" },
  { value: "investing", label: "Investing" },
  { value: "education", label: "Education" },
  { value: "travel", label: "Travel" },
  { value: "savings", label: "General Savings" },
];

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
