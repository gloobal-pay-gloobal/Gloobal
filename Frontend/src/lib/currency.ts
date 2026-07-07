
export const CURRENCIES = {
  EUR: { flag: "🇪🇸", label: "EUR" },
  USD: { flag: "🇺🇸", label: "USD" },
  GBP: { flag: "🇬🇧", label: "GBP" },
  INR: { flag: "🇮🇳", label: "INR" },
  JPY: { flag: "🇯🇵", label: "JPY" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

// Fixed illustrative rates, expressed relative to 1 EUR
export const RATES: Record<CurrencyCode, number> = { EUR: 1, USD: 1.08, GBP: 0.86, INR: 164.87, JPY: 170.5 };

export function convert(amount: string, from: CurrencyCode, to: CurrencyCode): number {
  const n = parseFloat(amount);
  if (isNaN(n)) return 0;
  const eur = n / RATES[from];
  return eur * RATES[to];
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
