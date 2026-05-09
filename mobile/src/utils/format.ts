export function formatIncome(val: string) {
  const num = parseInt(val.replace(/[^0-9]/g, ""), 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US");
}
