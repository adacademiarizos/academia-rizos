export function formatPriceCents(cents: number, currency = "EUR"): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export function formatPriceRange(
  minCents: number | null,
  maxCents: number | null,
  currency = "EUR"
): string {
  if (minCents == null && maxCents == null) return "Consultar";
  if (minCents != null && maxCents != null && minCents === maxCents) {
    return formatPriceCents(minCents, currency);
  }
  if (minCents != null && maxCents != null) {
    return `${(minCents / 100).toFixed(0)} - ${(maxCents / 100).toFixed(0)} ${currency}`;
  }
  return formatPriceCents(minCents ?? maxCents!, currency);
}
