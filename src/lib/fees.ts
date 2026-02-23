export function addStripeFees(params: {
  baseCents: number;
  feePercent: number; // ej 2.5
  feeFixedCents: number; // ej 25
}) {
  const percent = params.baseCents * (params.feePercent / 100);
  const total = Math.round(params.baseCents + percent + params.feeFixedCents);
  return { totalCents: total, feeCents: total - params.baseCents };
}
