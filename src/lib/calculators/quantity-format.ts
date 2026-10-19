/**
 * How a quantity reads on the page: at most two decimals once it is 1 or more; below 1 it keeps two significant figures
 * (5 µL written as 0.005 mL stays 0.005, not 0.01); very large values use powers of ten. Storage keeps the exact value.
 */
export function formatQuantity(value: number) {
  if (value === 0 || !Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 1e9) return value.toExponential(2);
  const rounded = Math.abs(value) >= 1 ? Number(value.toFixed(2)) : Number(value.toPrecision(2));
  return rounded.toLocaleString('en', { maximumFractionDigits: 12, useGrouping: false });
}
