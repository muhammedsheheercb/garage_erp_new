/** Returns an amount exactly as represented, without applying display rounding. */
export function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0";
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount) : "0";
}
