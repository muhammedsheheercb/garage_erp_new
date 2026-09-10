/**
 * Applies standard mathematical rounding to the nearest whole number:
 * - If the decimal portion is >= 0.500, round UP to the next whole number.
 * - If the decimal portion is < 0.500, round DOWN to the previous whole number.
 * 
 * Examples:
 * - 100.499 -> 100
 * - 100.500 -> 101
 * - 100.750 -> 101
 * - 100.999 -> 101
 * - 100.100 -> 100
 * - 250.500 -> 251
 */
export function roundAmount(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  if (isNaN(num)) return 0;
  return Math.round(num);
}

export function formatAmount(value: number | string | null | undefined): string {
  return String(roundAmount(value));
}
