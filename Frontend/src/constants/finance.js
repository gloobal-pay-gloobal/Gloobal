export const CURRENCIES = {
  EUR: { flag: "🇪🇺", label: "EUR" },
  USD: { flag: "🇺🇸", label: "USD" },
  GBP: { flag: "🇬🇧", label: "GBP" },
  CAD: { flag: "🇨🇦", label: "CAD" },
  AUD: { flag: "🇦🇺", label: "AUD" },
  CHF: { flag: "🇨🇭", label: "CHF" },
  SEK: { flag: "🇸🇪", label: "SEK" },
  NOK: { flag: "🇳🇴", label: "NOK" },
  DKK: { flag: "🇩🇰", label: "DKK" },
  PLN: { flag: "🇵🇱", label: "PLN" },
  RUB: { flag: "🇷🇺", label: "RUB" },
  TRY: { flag: "🇹🇷", label: "TRY" },
  UAH: { flag: "🇺🇦", label: "UAH" },
  INR: { flag: "🇮🇳", label: "INR" },
  CNY: { flag: "🇨🇳", label: "CNY" },
  JPY: { flag: "🇯🇵", label: "JPY" },
  KRW: { flag: "🇰🇷", label: "KRW" },
  IDR: { flag: "🇮🇩", label: "IDR" },
  PHP: { flag: "🇵🇭", label: "PHP" },
  VND: { flag: "🇻🇳", label: "VND" },
  THB: { flag: "🇹🇭", label: "THB" },
  MYR: { flag: "🇲🇾", label: "MYR" },
  SGD: { flag: "🇸🇬", label: "SGD" },
  PKR: { flag: "🇵🇰", label: "PKR" },
  BDT: { flag: "🇧🇩", label: "BDT" },
  SAR: { flag: "🇸🇦", label: "SAR" },
  AED: { flag: "🇦🇪", label: "AED" },
  ILS: { flag: "🇮🇱", label: "ILS" },
  EGP: { flag: "🇪🇬", label: "EGP" },
  ZAR: { flag: "🇿🇦", label: "ZAR" },
  NGN: { flag: "🇳🇬", label: "NGN" },
  KES: { flag: "🇰🇪", label: "KES" },
  BRL: { flag: "🇧🇷", label: "BRL" },
  MXN: { flag: "🇲🇽", label: "MXN" },
  ARS: { flag: "🇦🇷", label: "ARS" },
  CLP: { flag: "🇨🇱", label: "CLP" },
  COP: { flag: "🇨🇴", label: "COP" },
  PEN: { flag: "🇵🇪", label: "PEN" },
  NZD: { flag: "🇳🇿", label: "NZD" },
  ISK: { flag: "🇮🇸", label: "ISK" },
};
// Fixed illustrative rates, expressed relative to 1 EUR
// Demo exchange rates, all expressed per 1 EUR — plausible prototype
// values, not live data. Every currency in CURRENCIES has an entry here,
// so convert() can never hit a missing rate through normal UI paths.
export const RATES = {
  EUR: 1, USD: 1.08, GBP: 0.86, CAD: 1.48, AUD: 1.65, CHF: 0.94,
  SEK: 11.3, NOK: 11.5, DKK: 7.46, PLN: 4.3, RUB: 98, TRY: 35, UAH: 44,
  INR: 164.87, CNY: 7.8, JPY: 170.5, KRW: 1450, IDR: 17000, PHP: 61,
  VND: 26500, THB: 39, MYR: 5.1, SGD: 1.45, PKR: 300, BDT: 128,
  SAR: 4.05, AED: 3.97, ILS: 4.0, EGP: 52, ZAR: 20, NGN: 1650, KES: 140,
  BRL: 5.4, MXN: 20, ARS: 950, CLP: 1020, COP: 4300, PEN: 4.05,
  NZD: 1.78, ISK: 150,
};
export function convert(amount, from, to) {
  const n = parseFloat(amount);
  if (isNaN(n)) return 0;
  if (!RATES[from] || !RATES[to]) return 0;
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
// Maps every registerable country's ISO-2 code to its local currency —
// full coverage of TOP_COUNTRIES, so a person from any of them starts
// with their own currency as the sending default (an Indian user sends
// in INR, a Pakistani user in PKR, and so on). USD remains the fallback
// only for long-tail countries outside this set; the person can always
// change it from the currency dropdown.
export const COUNTRY_CURRENCY = {
  US: "USD", GB: "GBP", CA: "CAD", AU: "AUD",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR",
  CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
  RU: "RUB", TR: "TRY", UA: "UAH",
  IN: "INR", CN: "CNY", JP: "JPY", KR: "KRW",
  ID: "IDR", PH: "PHP", VN: "VND", TH: "THB", MY: "MYR", SG: "SGD",
  PK: "PKR", BD: "BDT", SA: "SAR", AE: "AED", IL: "ILS", EG: "EGP",
  ZA: "ZAR", NG: "NGN", KE: "KES",
  BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
  NZ: "NZD", IS: "ISK",
};
