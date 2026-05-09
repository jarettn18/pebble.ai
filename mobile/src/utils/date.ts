/**
 * Parse an ISO date string ("YYYY-MM-DD") as a local Date. Avoids the UTC
 * shift that `new Date("2026-04-30")` produces in negative-UTC timezones.
 */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffDays(a: Date, b: Date): number {
  return Math.round(
    (startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000,
  );
}

const SHORT_MONTH = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const SHORT_MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const FULL_GROUP = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const FULL_GROUP_YEAR = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * Compact label used inline (e.g. "Today", "Yesterday", "Apr 30").
 * Includes the year when older than the current year.
 */
export function formatTransactionDate(iso: string): string {
  if (!iso) return "";
  const date = parseLocalDate(iso);
  const today = new Date();
  const days = diffDays(today, date);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";

  return date.getFullYear() === today.getFullYear()
    ? SHORT_MONTH.format(date)
    : SHORT_MONTH_YEAR.format(date);
}

/**
 * Section-header label for grouped transaction lists.
 * "Today" / "Yesterday" / "Mon, Apr 30" / "Mon, Apr 30, 2025".
 */
export function formatTransactionDateGroup(iso: string): string {
  if (!iso) return "";
  const date = parseLocalDate(iso);
  const today = new Date();
  const days = diffDays(today, date);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";

  return date.getFullYear() === today.getFullYear()
    ? FULL_GROUP.format(date)
    : FULL_GROUP_YEAR.format(date);
}
