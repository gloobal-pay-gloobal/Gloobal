export const CURRENCIES = {
  EUR: { flag: "🇪🇸", label: "EUR" },
  USD: { flag: "🇺🇸", label: "USD" },
  GBP: { flag: "🇬🇧", label: "GBP" },
  INR: { flag: "🇮🇳", label: "INR" },
  JPY: { flag: "🇯🇵", label: "JPY" },
};
// Fixed illustrative rates, expressed relative to 1 EUR
export const RATES = { EUR: 1, USD: 1.08, GBP: 0.86, INR: 164.87, JPY: 170.5 };
export function convert(amount, from, to) {
  const n = parseFloat(amount);
  if (isNaN(n)) return 0;
  const eur = n / RATES[from];
  return eur * RATES[to];
}
export function fmt(n) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
// Demo PIN — in production this would be verified server-side / via biometrics
export const CORRECT_PIN = "1234";
// Maps a country's ISO-2 code to one of the currencies this screen supports.
// Falls back to USD for any country outside that demo currency set — the
// person can always change it from the currency dropdown.
export const COUNTRY_CURRENCY = {
  ES: "EUR", FR: "EUR", DE: "EUR", IT: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR",
  GB: "GBP",
  IN: "INR",
  JP: "JPY",
  US: "USD",
};
