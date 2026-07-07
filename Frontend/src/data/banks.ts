import { COUNTRY_BY_ISO } from "./countries";
import type { Bank, Country } from "../types";

export const PALETTE = ["#DE2910", "#005EB8", "#21A038", "#EE2E24", "#8B0000", "#6A1B9A", "#00695C", "#B71C1C", "#0F52BA", "#F57C00"];

// Official bank identity data: [officialName, initials, domain] per
// country. The domain is used to fetch each bank's real logo at render
// time via Clearbit's public logo API — see logoUrlForDomain below — so
// no logo artwork is stored or redistributed here, only web domains.
type BankNameEntry = [name: string, initials: string, domain: string];

export const BANK_NAMES: Record<string, BankNameEntry[]> = {
  US: [["JPMorgan Chase", "JPM", "jpmorganchase.com"], ["Bank of America", "BoA", "bankofamerica.com"], ["Citibank", "CITI", "citigroup.com"], ["Wells Fargo", "WF", "wellsfargo.com"], ["Goldman Sachs", "GS", "goldmansachs.com"], ["Morgan Stanley", "MS", "morganstanley.com"], ["U.S. Bank", "USB", "usbank.com"], ["PNC Bank", "PNC", "pnc.com"], ["Truist Bank", "TR", "truist.com"], ["Capital One", "C1", "capitalone.com"]],
  CN: [["Industrial and Commercial Bank of China", "ICBC", "icbc.com.cn"], ["China Construction Bank", "CCB", "ccb.com"], ["Agricultural Bank of China", "ABC", "abchina.com"], ["Bank of China", "BOC", "boc.cn"], ["Bank of Communications", "BCM", "bankcomm.com"], ["China Merchants Bank", "CMB", "cmbchina.com"], ["Postal Savings Bank of China", "PSBC", "psbc.com"], ["Industrial Bank", "CIB", "cib.com.cn"], ["Shanghai Pudong Dev. Bank", "SPDB", "spdb.com.cn"], ["China CITIC Bank", "CITIC", "citicbank.com"]],
  JP: [["MUFG Bank", "MUFG", "bk.mufg.jp"], ["Mizuho Bank", "MIZ", "mizuhobank.co.jp"], ["Sumitomo Mitsui Banking Corp", "SMBC", "smbc.co.jp"], ["Japan Post Bank", "JPB", "jp-bank.japanpost.jp"], ["Resona Bank", "RESO", "resonabank.co.jp"], ["Norinchukin Bank", "NORIN", "nochubank.or.jp"], ["Aozora Bank", "AOZO", "aozorabank.co.jp"], ["Shinsei Bank", "SHIN", "shinseibank.com"], ["Sumitomo Mitsui Trust Bank", "SMTB", "smtb.jp"], ["Mitsubishi UFJ Trust Bank", "MUTB", "tr.mufg.jp"]],
  DE: [["Deutsche Bank", "DB", "db.com"], ["Commerzbank", "CBK", "commerzbank.de"], ["DZ Bank", "DZ", "dzbank.de"], ["KfW", "KFW", "kfw.de"], ["HypoVereinsbank", "HVB", "hypovereinsbank.de"], ["Landesbank Baden-Württemberg", "LBBW", "lbbw.de"], ["Bayerische Landesbank", "BAYL", "bayernlb.de"], ["DekaBank", "DEKA", "deka.de"], ["Deutsche Pfandbriefbank", "PBB", "pfandbriefbank.com"], ["Volkswagen Bank", "VWB", "vwfs.de"]],
  IN: [["State Bank of India", "SBI", "sbi.co.in"], ["HDFC Bank", "HDFC", "hdfcbank.com"], ["ICICI Bank", "ICICI", "icicibank.com"], ["Axis Bank", "AXIS", "axisbank.com"], ["Kotak Mahindra Bank", "KMB", "kotak.com"], ["Punjab National Bank", "PNB", "pnbindia.in"], ["Bank of Baroda", "BOB", "bankofbaroda.in"], ["Canara Bank", "CNRB", "canarabank.com"], ["Union Bank of India", "UBI", "unionbankofindia.co.in"], ["IndusInd Bank", "IIB", "indusind.com"]],
  GB: [["HSBC Bank", "HSBC", "hsbc.co.uk"], ["Barclays", "BARC", "barclays.co.uk"], ["Lloyds Bank", "LLOY", "lloydsbank.com"], ["NatWest", "NW", "natwest.com"], ["Standard Chartered", "SC", "sc.com"], ["Santander UK", "SAN", "santander.co.uk"], ["TSB Bank", "TSB", "tsb.co.uk"], ["Nationwide Building Society", "NBS", "nationwide.co.uk"], ["Metro Bank", "MET", "metrobankonline.co.uk"], ["Monzo Bank", "MONZ", "monzo.com"]],
  FR: [["BNP Paribas", "BNP", "bnpparibas.com"], ["Crédit Agricole", "CA", "credit-agricole.com"], ["Société Générale", "SG", "societegenerale.com"], ["BPCE", "BPCE", "groupebpce.com"], ["Crédit Mutuel", "CM", "creditmutuel.fr"], ["La Banque Postale", "LBP", "labanquepostale.fr"], ["HSBC France", "HSBC", "hsbc.fr"], ["LCL", "LCL", "lcl.fr"], ["CIC", "CIC", "cic.fr"], ["AXA Banque", "AXA", "axabanque.fr"]],
  IT: [["Intesa Sanpaolo", "ISP", "intesasanpaolo.com"], ["UniCredit", "UCG", "unicredit.eu"], ["Banco BPM", "BPM", "bancobpm.it"], ["BPER Banca", "BPER", "bper.it"], ["Monte dei Paschi di Siena", "MPS", "mps.it"], ["Mediobanca", "MB", "mediobanca.com"], ["Crédit Agricole Italia", "CAI", "credit-agricole.it"], ["Banca Pop. di Sondrio", "BPS", "popso.it"], ["Cassa Depositi e Prestiti", "CDP", "cdp.it"], ["Iccrea Banca", "ICCR", "iccrea.bcc.it"]],
  BR: [["Itaú Unibanco", "ITAU", "itau.com.br"], ["Banco do Brasil", "BB", "bb.com.br"], ["Bradesco", "BRAD", "bradesco.com.br"], ["Caixa Econômica Federal", "CEF", "caixa.gov.br"], ["Santander Brasil", "SAN", "santander.com.br"], ["BTG Pactual", "BTG", "btgpactual.com"], ["Banco Safra", "SAFRA", "safra.com.br"], ["Banco Votorantim", "BV", "bv.com.br"], ["Banco Inter", "INTER", "bancointer.com.br"], ["Nubank", "NU", "nubank.com.br"]],
  CA: [["Royal Bank of Canada", "RBC", "rbc.com"], ["TD Bank", "TD", "td.com"], ["Scotiabank", "BNS", "scotiabank.com"], ["Bank of Montreal", "BMO", "bmo.com"], ["CIBC", "CIBC", "cibc.com"], ["National Bank of Canada", "NBC", "nbc.ca"], ["Desjardins", "DESJ", "desjardins.com"], ["HSBC Canada", "HSBC", "hsbc.ca"], ["Laurentian Bank", "LB", "laurentianbank.ca"], ["ATB Financial", "ATB", "atb.com"]],
  RU: [["Sberbank", "SBER", "sberbank.ru"], ["VTB Bank", "VTB", "vtb.ru"], ["Gazprombank", "GPB", "gazprombank.ru"], ["Alfa-Bank", "ALFA", "alfabank.ru"], ["Rosselkhozbank", "RSHB", "rshb.ru"], ["Otkritie Bank", "OTKR", "open.ru"], ["Sovcombank", "SOVC", "sovcombank.ru"], ["Raiffeisenbank Russia", "RAIF", "raiffeisen.ru"], ["Tinkoff Bank", "TCS", "tinkoff.ru"], ["Promsvyazbank", "PSB", "psbank.ru"]],
  KR: [["KB Kookmin Bank", "KB", "kbstar.com"], ["Shinhan Bank", "SHIN", "shinhan.com"], ["Woori Bank", "WOORI", "wooribank.com"], ["Hana Bank", "HANA", "hanabank.com"], ["NongHyup Bank", "NH", "nonghyup.com"], ["Industrial Bank of Korea", "IBK", "ibk.co.kr"], ["Standard Chartered Korea", "SC", "sc.com"], ["Citibank Korea", "CITI", "citibank.co.kr"], ["Suhyup Bank", "SUHY", "suhyup-bank.com"], ["Kakao Bank", "KAKA", "kakaobank.com"]],
  AU: [["Commonwealth Bank", "CBA", "commbank.com.au"], ["Westpac", "WBC", "westpac.com.au"], ["ANZ Bank", "ANZ", "anz.com.au"], ["National Australia Bank", "NAB", "nab.com.au"], ["Macquarie Bank", "MQG", "macquarie.com"], ["Bendigo Bank", "BEN", "bendigobank.com.au"], ["Bank of Queensland", "BOQ", "boq.com.au"], ["Suncorp Bank", "SUN", "suncorp.com.au"], ["ING Australia", "ING", "ing.com.au"], ["HSBC Australia", "HSBC", "hsbc.com.au"]],
  ES: [["Banco Santander", "SAN", "santander.com"], ["BBVA", "BBVA", "bbva.com"], ["CaixaBank", "CAIX", "caixabank.com"], ["Banco Sabadell", "SAB", "bancsabadell.com"], ["Bankinter", "BKT", "bankinter.com"], ["Unicaja Banco", "UNI", "unicaja.es"], ["Ibercaja", "IBER", "ibercaja.es"], ["Kutxabank", "KUTX", "kutxabank.es"], ["Abanca", "ABAN", "abanca.com"], ["Banca March", "MRCH", "bancamarch.es"]],
  MX: [["BBVA México", "BBVA", "bbva.mx"], ["Banorte", "GFNO", "banorte.com"], ["Citibanamex", "BNMX", "banamex.com"], ["Santander México", "SAN", "santander.com.mx"], ["HSBC México", "HSBC", "hsbc.com.mx"], ["Scotiabank México", "BNS", "scotiabank.com.mx"], ["Banco Azteca", "AZTC", "bancoazteca.com.mx"], ["Inbursa", "INB", "inbursa.com"], ["Banregio", "BREG", "banregio.com"], ["Banco del Bajío", "BAJIO", "bancodelbajio.com.mx"]],
  ID: [["Bank Central Asia", "BCA", "bca.co.id"], ["Bank Mandiri", "MNDR", "bankmandiri.co.id"], ["Bank Rakyat Indonesia", "BRI", "bri.co.id"], ["Bank Negara Indonesia", "BNI", "bni.co.id"], ["CIMB Niaga", "CIMB", "cimbniaga.co.id"], ["Bank Danamon", "DNMN", "danamon.co.id"], ["Bank Permata", "PRMT", "permatabank.com"], ["Bank OCBC NISP", "OCBC", "ocbcnisp.com"], ["Bank Tabungan Negara", "BTN", "btn.co.id"], ["Bank Panin", "PNIN", "panin.co.id"]],
  NL: [["ING Bank", "ING", "ing.com"], ["Rabobank", "RABO", "rabobank.com"], ["ABN AMRO", "ABN", "abnamro.com"], ["de Volksbank", "SNS", "devolksbank.nl"], ["Triodos Bank", "TRIO", "triodos.com"], ["Van Lanschot Kempen", "VLK", "vanlanschotkempen.com"], ["NIBC Bank", "NIBC", "nibc.com"], ["Bunq", "BUNQ", "bunq.com"], ["Knab", "KNAB", "knab.nl"], ["Achmea Bank", "ACHM", "achmeabank.nl"]],
  SA: [["Saudi National Bank", "SNB", "alahli.com"], ["Al Rajhi Bank", "RAJHI", "alrajhibank.com.sa"], ["Riyad Bank", "RIYAD", "riyadbank.com"], ["Banque Saudi Fransi", "BSF", "alfransi.com.sa"], ["Arab National Bank", "ANB", "anb.com.sa"], ["Saudi British Bank", "SABB", "sabb.com"], ["Alinma Bank", "ALNMA", "alinma.com"], ["Bank AlJazira", "BJAZ", "bankaljazira.com"], ["Bank Albilad", "ALBLD", "bankalbilad.com"], ["Gulf International Bank", "GIB", "gib.com"]],
  CH: [["UBS", "UBS", "ubs.com"], ["Credit Suisse", "CS", "credit-suisse.com"], ["Zürcher Kantonalbank", "ZKB", "zkb.ch"], ["Raiffeisen Switzerland", "RAIF", "raiffeisen.ch"], ["PostFinance", "POST", "postfinance.ch"], ["Julius Baer", "BAER", "juliusbaer.com"], ["Pictet", "PCTE", "pictet.com"], ["Banque Cantonale Vaudoise", "BCV", "bcv.ch"], ["Basler Kantonalbank", "BKB", "bkb.ch"], ["EFG International", "EFG", "efginternational.com"]],
  TR: [["Ziraat Bankası", "ZIRT", "ziraatbank.com.tr"], ["Türkiye İş Bankası", "ISBK", "isbank.com.tr"], ["Garanti BBVA", "GRNT", "garantibbva.com.tr"], ["Akbank", "AKBK", "akbank.com"], ["Yapı Kredi", "YAPI", "yapikredi.com.tr"], ["VakıfBank", "VKFB", "vakifbank.com.tr"], ["Halkbank", "HALK", "halkbank.com.tr"], ["QNB Finansbank", "QNB", "qnbfinansbank.com"], ["Denizbank", "DNZ", "denizbank.com"], ["Türk Ekonomi Bankası", "TEB", "teb.com.tr"]],
};

// Turns a bank's domain into a real logo URL via Clearbit's public logo
// API — this only ever stores/handles domains, never logo image files.
export function logoUrlForDomain(domain: string, size = 128): string | null {
  return domain ? `https://logo.clearbit.com/${domain}?size=${size}` : null;
}

// For a few countries the "most popular/trusted" ordering the product
// wants differs slightly from BANK_NAMES's default order below — this
// override lets us pin the exact top 5 without reshuffling the full list
// (which is also used as the fallback for every other country).
export const TOP5_ORDER_OVERRIDE: Record<string, string[]> = {
  IN: ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Punjab National Bank"],
  US: ["JPMorgan Chase", "Bank of America", "Wells Fargo", "Citibank", "U.S. Bank"],
  GB: ["HSBC Bank", "Barclays", "Lloyds Bank", "NatWest", "Santander UK"],
};

export function buildBanks(countryCode: string, dial: string): Bank[] {
  const all = BANK_NAMES[countryCode] || [];
  const order = TOP5_ORDER_OVERRIDE[countryCode];
  const top5 = order
    ? order.map((name) => all.find((entry) => entry[0] === name)).filter((e): e is BankNameEntry => Boolean(e))
    : all.slice(0, 5);
  return top5.map(([name, initials, domain], i) => ({
    id: `${countryCode}-${i}`,
    name,
    initials: initials.length > 5 ? initials.slice(0, 5) : initials,
    color: PALETTE[i % PALETTE.length],
    logo: logoUrlForDomain(domain),
    phone: `${dial} •••• •• ${10 + i}`,
  }));
}

// Countries with a demo bank list, sourced from the single ALL_COUNTRIES
// dataset (via COUNTRY_BY_ISO) instead of a second, duplicate country list.
export const BANKS_BY_COUNTRY: Record<string, Bank[]> = Object.fromEntries(
  Object.keys(BANK_NAMES).map((code) => [
    code,
    buildBanks(code, COUNTRY_BY_ISO[code]?.dialCode || ""),
  ])
);

// Add Bank is scoped to the user's registered country — the same country
// they picked during registration (dialCountry). There is no country
// selector here and no way to switch: banks are always looked up for that
// one country, using the single ALL_COUNTRIES/COUNTRY_BY_ISO dataset for
// its name/flag.
// The platform's own bank option — always pinned first, regardless of the
// person's country. Uses the same BankAvatar fallback path as every other
// bank (a colored initials tile), just with a brand gradient instead of a
// fetched logo, so no shared component needs to change for this to exist.
export function buildGloobalBank(country: Country): Bank {
  return {
    id: "gloobal-bank",
    name: "Gloobal Bank",
    initials: "GB",
    color: "linear-gradient(135deg,#3b6ef5,#7b5bf0)",
    logo: null,
    isGloobal: true,
    phone: `${country.dialCode} •••• •• 01`,
  };
}
