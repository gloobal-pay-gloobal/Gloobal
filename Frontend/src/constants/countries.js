import {
  Search,
} from "lucide-react";

// Turns an ISO-2 country code into its flag emoji via regional indicator
// symbols, so we don't have to hand-type 50 emoji literals.
export function isoToFlag(iso2) {
  return iso2
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
// Top 50 countries for the phone-code picker's default view: name, ISO-2,
// dial code.
export const TOP_COUNTRIES = [
  ["United States", "US", "+1"],
  ["United Kingdom", "GB", "+44"],
  ["Canada", "CA", "+1"],
  ["Australia", "AU", "+61"],
  ["Germany", "DE", "+49"],
  ["France", "FR", "+33"],
  ["Italy", "IT", "+39"],
  ["Spain", "ES", "+34"],
  ["Netherlands", "NL", "+31"],
  ["Belgium", "BE", "+32"],
  ["Switzerland", "CH", "+41"],
  ["Austria", "AT", "+43"],
  ["Sweden", "SE", "+46"],
  ["Norway", "NO", "+47"],
  ["Denmark", "DK", "+45"],
  ["Finland", "FI", "+358"],
  ["Ireland", "IE", "+353"],
  ["Portugal", "PT", "+351"],
  ["Poland", "PL", "+48"],
  ["Greece", "GR", "+30"],
  ["Russia", "RU", "+7"],
  ["Turkey", "TR", "+90"],
  ["Ukraine", "UA", "+380"],
  ["India", "IN", "+91"],
  ["China", "CN", "+86"],
  ["Japan", "JP", "+81"],
  ["South Korea", "KR", "+82"],
  ["Indonesia", "ID", "+62"],
  ["Philippines", "PH", "+63"],
  ["Vietnam", "VN", "+84"],
  ["Thailand", "TH", "+66"],
  ["Malaysia", "MY", "+60"],
  ["Singapore", "SG", "+65"],
  ["Pakistan", "PK", "+92"],
  ["Bangladesh", "BD", "+880"],
  ["Saudi Arabia", "SA", "+966"],
  ["United Arab Emirates", "AE", "+971"],
  ["Israel", "IL", "+972"],
  ["Egypt", "EG", "+20"],
  ["South Africa", "ZA", "+27"],
  ["Nigeria", "NG", "+234"],
  ["Kenya", "KE", "+254"],
  ["Brazil", "BR", "+55"],
  ["Mexico", "MX", "+52"],
  ["Argentina", "AR", "+54"],
  ["Chile", "CL", "+56"],
  ["Colombia", "CO", "+57"],
  ["Peru", "PE", "+51"],
  ["New Zealand", "NZ", "+64"],
  ["Iceland", "IS", "+354"],
].map(([name, iso, dialCode]) => ({ name, iso, dialCode, flag: isoToFlag(iso) }));
// Every other country, shown when someone taps "See all countries" or
// searches for something outside the top 50.
export const REST_COUNTRIES = [
  ["Afghanistan", "AF", "+93"],
  ["Albania", "AL", "+355"],
  ["Algeria", "DZ", "+213"],
  ["Andorra", "AD", "+376"],
  ["Angola", "AO", "+244"],
  ["Antigua and Barbuda", "AG", "+1268"],
  ["Armenia", "AM", "+374"],
  ["Azerbaijan", "AZ", "+994"],
  ["Bahamas", "BS", "+1242"],
  ["Bahrain", "BH", "+973"],
  ["Barbados", "BB", "+1246"],
  ["Belarus", "BY", "+375"],
  ["Belize", "BZ", "+501"],
  ["Benin", "BJ", "+229"],
  ["Bhutan", "BT", "+975"],
  ["Bolivia", "BO", "+591"],
  ["Bosnia and Herzegovina", "BA", "+387"],
  ["Botswana", "BW", "+267"],
  ["Brunei", "BN", "+673"],
  ["Bulgaria", "BG", "+359"],
  ["Burkina Faso", "BF", "+226"],
  ["Burundi", "BI", "+257"],
  ["Cabo Verde", "CV", "+238"],
  ["Cambodia", "KH", "+855"],
  ["Cameroon", "CM", "+237"],
  ["Central African Republic", "CF", "+236"],
  ["Chad", "TD", "+235"],
  ["Comoros", "KM", "+269"],
  ["Congo (DRC)", "CD", "+243"],
  ["Congo (Republic)", "CG", "+242"],
  ["Costa Rica", "CR", "+506"],
  ["Croatia", "HR", "+385"],
  ["Cuba", "CU", "+53"],
  ["Cyprus", "CY", "+357"],
  ["Czech Republic", "CZ", "+420"],
  ["Djibouti", "DJ", "+253"],
  ["Dominica", "DM", "+1767"],
  ["Dominican Republic", "DO", "+1809"],
  ["Ecuador", "EC", "+593"],
  ["El Salvador", "SV", "+503"],
  ["Equatorial Guinea", "GQ", "+240"],
  ["Eritrea", "ER", "+291"],
  ["Estonia", "EE", "+372"],
  ["Eswatini", "SZ", "+268"],
  ["Ethiopia", "ET", "+251"],
  ["Fiji", "FJ", "+679"],
  ["Gabon", "GA", "+241"],
  ["Gambia", "GM", "+220"],
  ["Georgia", "GE", "+995"],
  ["Ghana", "GH", "+233"],
  ["Grenada", "GD", "+1473"],
  ["Guatemala", "GT", "+502"],
  ["Guinea", "GN", "+224"],
  ["Guinea-Bissau", "GW", "+245"],
  ["Guyana", "GY", "+592"],
  ["Haiti", "HT", "+509"],
  ["Honduras", "HN", "+504"],
  ["Hungary", "HU", "+36"],
  ["Jamaica", "JM", "+1876"],
  ["Jordan", "JO", "+962"],
  ["Kazakhstan", "KZ", "+7"],
  ["Kiribati", "KI", "+686"],
  ["Kosovo", "XK", "+383"],
  ["Kuwait", "KW", "+965"],
  ["Kyrgyzstan", "KG", "+996"],
  ["Laos", "LA", "+856"],
  ["Latvia", "LV", "+371"],
  ["Lebanon", "LB", "+961"],
  ["Lesotho", "LS", "+266"],
  ["Liberia", "LR", "+231"],
  ["Libya", "LY", "+218"],
  ["Liechtenstein", "LI", "+423"],
  ["Lithuania", "LT", "+370"],
  ["Luxembourg", "LU", "+352"],
  ["Madagascar", "MG", "+261"],
  ["Malawi", "MW", "+265"],
  ["Maldives", "MV", "+960"],
  ["Mali", "ML", "+223"],
  ["Malta", "MT", "+356"],
  ["Marshall Islands", "MH", "+692"],
  ["Mauritania", "MR", "+222"],
  ["Mauritius", "MU", "+230"],
  ["Micronesia", "FM", "+691"],
  ["Moldova", "MD", "+373"],
  ["Monaco", "MC", "+377"],
  ["Mongolia", "MN", "+976"],
  ["Montenegro", "ME", "+382"],
  ["Morocco", "MA", "+212"],
  ["Mozambique", "MZ", "+258"],
  ["Myanmar", "MM", "+95"],
  ["Namibia", "NA", "+264"],
  ["Nauru", "NR", "+674"],
  ["Nepal", "NP", "+977"],
  ["Nicaragua", "NI", "+505"],
  ["Niger", "NE", "+227"],
  ["North Korea", "KP", "+850"],
  ["North Macedonia", "MK", "+389"],
  ["Oman", "OM", "+968"],
  ["Palau", "PW", "+680"],
  ["Palestine", "PS", "+970"],
  ["Panama", "PA", "+507"],
  ["Papua New Guinea", "PG", "+675"],
  ["Paraguay", "PY", "+595"],
  ["Qatar", "QA", "+974"],
  ["Romania", "RO", "+40"],
  ["Rwanda", "RW", "+250"],
  ["Samoa", "WS", "+685"],
  ["San Marino", "SM", "+378"],
  ["Sao Tome and Principe", "ST", "+239"],
  ["Senegal", "SN", "+221"],
  ["Serbia", "RS", "+381"],
  ["Seychelles", "SC", "+248"],
  ["Sierra Leone", "SL", "+232"],
  ["Slovakia", "SK", "+421"],
  ["Slovenia", "SI", "+386"],
  ["Solomon Islands", "SB", "+677"],
  ["Somalia", "SO", "+252"],
  ["South Sudan", "SS", "+211"],
  ["Sri Lanka", "LK", "+94"],
  ["St Kitts and Nevis", "KN", "+1869"],
  ["St Lucia", "LC", "+1758"],
  ["St Vincent and Grenadines", "VC", "+1784"],
  ["Sudan", "SD", "+249"],
  ["Suriname", "SR", "+597"],
  ["Syria", "SY", "+963"],
  ["Taiwan", "TW", "+886"],
  ["Tajikistan", "TJ", "+992"],
  ["Tanzania", "TZ", "+255"],
  ["Timor-Leste", "TL", "+670"],
  ["Togo", "TG", "+228"],
  ["Tonga", "TO", "+676"],
  ["Trinidad and Tobago", "TT", "+1868"],
  ["Tunisia", "TN", "+216"],
  ["Turkmenistan", "TM", "+993"],
  ["Tuvalu", "TV", "+688"],
  ["Uganda", "UG", "+256"],
  ["Uruguay", "UY", "+598"],
  ["Uzbekistan", "UZ", "+998"],
  ["Vanuatu", "VU", "+678"],
  ["Vatican City", "VA", "+379"],
  ["Venezuela", "VE", "+58"],
  ["Yemen", "YE", "+967"],
  ["Zambia", "ZM", "+260"],
  ["Zimbabwe", "ZW", "+263"],
].map(([name, iso, dialCode]) => ({ name, iso, dialCode, flag: isoToFlag(iso) }));
// Full list, used for search so someone can find any country regardless of
// whether "See all" has been tapped.
export const ALL_COUNTRIES = [...TOP_COUNTRIES, ...REST_COUNTRIES];
// Single source of truth for country identity (name / flag / dial code),
// keyed by ISO-2 code. Every other screen (dashboard, send money, add bank,
// global coverage) looks a country up here instead of keeping its own copy
// of names/flags, so the data is always identical everywhere.
export const COUNTRY_BY_ISO = Object.fromEntries(ALL_COUNTRIES.map((c) => [c.iso, c]));
// Reads the country calling code back off a stored mobile number
// ("+918114491364" -> "+91"). The longest matching dial code wins, so
// +1868 (Trinidad) is preferred over +1 when both prefix the same number.
// Used at login to check which country an account is actually registered
// under, instead of trusting whichever flag happens to be selected.
export function dialCodeFromNumber(mobileNumber) {
  const raw = String(mobileNumber || "").replace(/[\s-]/g, "");
  if (!raw.startsWith("+")) return null;
  let best = null;
  for (const c of ALL_COUNTRIES) {
    if (raw.startsWith(c.dialCode) && (!best || c.dialCode.length > best.length)) best = c.dialCode;
  }
  return best;
}
// The country record behind a stored mobile number, or null if its dial
// code doesn't match any country we know.
export function countryFromNumber(mobileNumber) {
  const code = dialCodeFromNumber(mobileNumber);
  if (!code) return null;
  return ALL_COUNTRIES.find((c) => c.dialCode === code) || null;
}
// The one search predicate used by every country search box in the app
// (registration's country picker, and the Gloobal Coverage search) so
// ordering/matching behavior is identical everywhere a country is searched.
export function countryMatches(country, rawQuery) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  return (
    country.name.toLowerCase().includes(q) ||
    (!!country.dialCode && country.dialCode.includes(q))
  );
}
// A national mobile number (the part after the country's dial code) isn't
// the same length everywhere, and a handful of countries genuinely accept
// a small range rather than one fixed length. This is the single shared
// source of truth for that — used both at registration (so the call/verify
// button only lights up on a real, complete number) and in Send Money's
// mobile search (so the dial pad and Search button expect the right
// length for whichever country is selected). Approximate national
// significant number ranges; any ISO not listed falls back to the
// 10-digit default below.
export const MOBILE_DIGIT_RANGE_BY_ISO = {
  US: [10, 10], CA: [10, 10], GB: [10, 10], AU: [9, 9], DE: [10, 11], FR: [9, 9],
  IT: [9, 10], ES: [9, 9], NL: [9, 9], BE: [8, 9], CH: [9, 9], AT: [10, 11],
  SE: [7, 9], NO: [8, 8], DK: [8, 8], FI: [9, 10], IE: [9, 9], PT: [9, 9],
  PL: [9, 9], GR: [10, 10], RU: [10, 10], TR: [10, 10], UA: [9, 9], IN: [10, 10],
  CN: [11, 11], JP: [10, 10], KR: [9, 10], ID: [9, 12], PH: [10, 10], VN: [9, 10],
  TH: [9, 9], MY: [9, 10], SG: [8, 8], PK: [10, 10], BD: [10, 10], SA: [9, 9],
  AE: [9, 9], IL: [9, 9], EG: [10, 10], ZA: [9, 9], NG: [10, 10], KE: [9, 9],
  BR: [10, 11], MX: [10, 10], AR: [10, 11], CL: [9, 9], CO: [10, 10], PE: [9, 9],
  NZ: [8, 9], IS: [7, 7],
};
export const DEFAULT_MOBILE_DIGIT_RANGE = [10, 10];
// Looks up a country's [min, max] national number length by ISO code.
export function mobileDigitRange(iso) {
  return MOBILE_DIGIT_RANGE_BY_ISO[iso] || DEFAULT_MOBILE_DIGIT_RANGE;
}
// There's no real name data behind any of this (no signup name field, no
// contact lookup) — so wherever a person's name needs to show up next to
// their flag, this hands back a plausible placeholder instead of leaving
// it blank. Purely cosmetic demo data.
export const DEMO_FIRST_NAMES = ["Aarav", "Mia", "Noah", "Sofia", "Liam", "Zara", "Ethan", "Amara", "Kenji", "Elena", "Omar", "Priya", "Lucas", "Ines", "Yusuf", "Chloe"];
export const DEMO_LAST_NAMES = ["Sharma", "Rossi", "Müller", "Tanaka", "Silva", "Kim", "Dubois", "Khan", "Petrov", "Costa", "Nakamura", "Fischer", "Alvarez", "Novak", "Haddad"];
export function randomName() {
  const first = DEMO_FIRST_NAMES[Math.floor(Math.random() * DEMO_FIRST_NAMES.length)];
  const last = DEMO_LAST_NAMES[Math.floor(Math.random() * DEMO_LAST_NAMES.length)];
  return `${first} ${last}`;
}
// A plausible-looking (not real) national number for a country, used to
// auto-fill the receiver's phone once a Gloobal ID search resolves — a
// real backend would return the phone tied to that ID; this stands in for
// that lookup.
export function randomLocalPhone(iso) {
  const [minLen, maxLen] = mobileDigitRange(iso);
  const len = minLen === maxLen ? minLen : minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
  let digits = "";
  for (let i = 0; i < len; i++) digits += Math.floor(Math.random() * 10);
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ");
}
