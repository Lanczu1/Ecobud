/** Formats a number with comma separators. e.g. 15420 → "15,420" */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}
