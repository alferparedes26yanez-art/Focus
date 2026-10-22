// Number formats shown in the interface.

const usd = new Intl.NumberFormat("es", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Estimated AI costs: tiny amounts read as "menos de 0,01 USD".
export function formatEstimatedUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) return "menos de 0,01 USD";
  return usd.format(amount);
}
