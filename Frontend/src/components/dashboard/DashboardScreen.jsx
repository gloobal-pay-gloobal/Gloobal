import React, { useEffect, useMemo, useRef, useState } from "react";
import globalIdLogo from "../../assets/globalid-logo.png";
import {
  Search,
  User,
  Copy,
  X,
  ChevronRight,
  ArrowLeft,
  Home,
  Users2,
  Share2,
  Gift,
  Store,
  Info,
} from "lucide-react";
import { CardAmbientField, DashboardAmbientBg, SendMoneyAmbientBg } from "../backgrounds/FinancialAmbient";
import { POSITION_COLORS } from "../common/CodeEntry";
import { FlagEmoji } from "../common/FlagComponents";
import { ChevronRightIcon, EyeIcon, HomeTabIcon, LogoutIcon, ProfileTabIcon, RotatingGlobeIcon, ServiceLock } from "../common/Icons";
import { BILL_ACTIONS, DASHBOARD_ACTIONS, PROFILE_ROWS } from "../../constants/dashboardData";
import { getHistory, getReferrals } from "../../services/api/authApi";
import { T } from "../../styles/theme";
import { Plane, Building2, TrainFront, Bus, Car, Ship, RefreshCw, Coins, CreditCard, Landmark, Smartphone, Zap, ChevronUp, ChevronDown, History, ArrowUp, ArrowDown, ArrowDownLeft, ArrowUpRight, RotateCw, Check } from "lucide-react";
import { COUNTRY_CURRENCY, CURRENCIES } from "../../constants/finance";
import { nextIdentityMode, IDENTITY_DISPLAY_LABEL, identityDisplayValue } from "../../constants/identity";

// "22 Jul 2026" — the join date on a referral row. Built from explicit
// parts rather than toLocaleDateString so the order and month spelling are
// the same on every device, whatever locale it is set to. An unparseable
// or missing date renders as an em dash instead of "Invalid Date".
const JOINED_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatJoinedDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return `${String(date.getUTCDate()).padStart(2, "0")} ${JOINED_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

// A lightweight, dependency-free "QR code" look for the receiving side of
// a transfer (Accept Rent, and anywhere else a scannable ID is shown). The
// pattern is deterministic — the same Gloobal ID always draws the same
// dots — and includes the three corner "finder" squares every real QR
// code has, so it reads unmistakably as a scannable code at a glance.
// This is a prototype visual standing in for a live scannable encoding,
// the same way the rest of the app's identifiers are demo data.
function MockQRCode({ value, size = 176 }) {
  const GRID = 21; // classic QR "Version 1" module count
  const FINDER = 7; // finder squares are 7x7 modules
  const cell = size / GRID;

  const seed = useMemo(() => {
    let h = 0;
    const s = value || "gloobal";
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }, [value]);

  const finderCorners = [
    [0, 0],
    [GRID - FINDER, 0],
    [0, GRID - FINDER],
  ];

  const finderCell = (x, y, cx, cy) => {
    const lx = x - cx;
    const ly = y - cy;
    const onOuter = lx === 0 || lx === FINDER - 1 || ly === 0 || ly === FINDER - 1;
    const onInner = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
    return onOuter || onInner;
  };

  const cells = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const finderCorner = finderCorners.find(([cx, cy]) => x >= cx && x < cx + FINDER && y >= cy && y < cy + FINDER);
      const dark = finderCorner
        ? finderCell(x, y, finderCorner[0], finderCorner[1])
        : ((x * 92821 + y * 68917 + seed) >>> 0) % 5 < 2; // ~40% fill reads like a real QR
      if (dark) {
        cells.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#14122B" />);
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", borderRadius: 12 }} role="img" aria-label="Scan to send">
      <rect x={0} y={0} width={size} height={size} fill="#fff" rx={12} />
      {cells}
    </svg>
  );
}

// Travel — its own icon group inside the More sheet, since it covers
// enough sub-categories (flights, hotels, ground transport...) to need a
// small grid of its own rather than a single row.
const TRAVEL_ACTIONS = [
  { key: "flights", label: "Flights", Icon: Plane },
  { key: "hotels", label: "Hotels", Icon: Building2 },
  { key: "trains", label: "Trains", Icon: TrainFront },
  { key: "buses", label: "Buses", Icon: Bus },
  { key: "carRental", label: "Car Rental", Icon: Car },
  { key: "cruises", label: "Cruises", Icon: Ship },
];

// Top businesses shown in the More sheet, below the pinned Recharge /
// Electricity / Rent / Travel shortcuts. Tapping any of these — or a
// Travel option above — opens the same lightweight, functional "Pay"
// sheet the Send flow uses at its core: amount in, Pay button, done.
const TOP_BUSINESSES = [
  { key: "amazon", label: "Amazon", chip: "AZ" },
  { key: "walmart", label: "Walmart", chip: "WM" },
  { key: "uber", label: "Uber", chip: "UB" },
  { key: "uberEats", label: "Uber Eats", chip: "UE" },
  { key: "starbucks", label: "Starbucks", chip: "SB" },
  { key: "mcdonalds", label: "McDonald's", chip: "MC" },
  { key: "target", label: "Target", chip: "TG" },
  { key: "ikea", label: "IKEA", chip: "IK" },
  { key: "zara", label: "Zara", chip: "ZA" },
  { key: "appleStore", label: "Apple Store", chip: "AP" },
];

// Global auto-pay subscription catalogue for Profile → Subscriptions.
// Every brand here is real, spanning streaming, music, gaming, cloud/
// productivity, news, wellness, delivery, and security — the kind of
// worldwide spread (US/EU alongside India, China, Japan, Korea, ...) that
// makes the search list actually useful. Demo prices only (prototype
// stage); every row renders locked (red ServiceLock) until live billing
// APIs are connected, so there's no "active" state to track yet.
const SUBSCRIPTION_TOOLS = [
  // Streaming & entertainment
  { key: "netflix", label: "Netflix", price: 15.49, chip: "NF", category: "Streaming" },
  { key: "primeVideo", label: "Amazon Prime", price: 14.99, chip: "AP", category: "Streaming" },
  { key: "disneyPlus", label: "Disney+", price: 9.99, chip: "D+", category: "Streaming" },
  { key: "disneyHotstar", label: "Disney+ Hotstar", price: 3.99, chip: "DH", category: "Streaming" },
  { key: "appleTvPlus", label: "Apple TV+", price: 9.99, chip: "TV", category: "Streaming" },
  { key: "hboMax", label: "Max (HBO)", price: 15.99, chip: "MX", category: "Streaming" },
  { key: "hulu", label: "Hulu", price: 9.99, chip: "HU", category: "Streaming" },
  { key: "paramountPlus", label: "Paramount+", price: 7.99, chip: "P+", category: "Streaming" },
  { key: "peacock", label: "Peacock", price: 7.99, chip: "PK", category: "Streaming" },
  { key: "zee5", label: "ZEE5", price: 3.49, chip: "Z5", category: "Streaming" },
  { key: "sonyliv", label: "SonyLIV", price: 2.99, chip: "SL", category: "Streaming" },
  { key: "jiocinema", label: "JioCinema", price: 1.99, chip: "JC", category: "Streaming" },
  { key: "iqiyi", label: "iQIYI", price: 5.99, chip: "IQ", category: "Streaming" },
  { key: "tencentVideo", label: "Tencent Video", price: 5.49, chip: "TX", category: "Streaming" },
  { key: "youku", label: "Youku VIP", price: 4.99, chip: "YK", category: "Streaming" },
  { key: "bilibili", label: "Bilibili VIP", price: 2.49, chip: "BL", category: "Streaming" },
  { key: "viu", label: "Viu", price: 2.99, chip: "VU", category: "Streaming" },
  { key: "coupangPlay", label: "Coupang Play", price: 3.99, chip: "CP", category: "Streaming" },
  { key: "mubi", label: "MUBI", price: 12.99, chip: "MB", category: "Streaming" },
  { key: "britbox", label: "BritBox", price: 8.99, chip: "BB", category: "Streaming" },
  { key: "crunchyroll", label: "Crunchyroll", price: 7.99, chip: "CR", category: "Streaming" },
  { key: "dazn", label: "DAZN", price: 19.99, chip: "DZ", category: "Sports" },
  { key: "espnPlus", label: "ESPN+", price: 11.99, chip: "ES", category: "Sports" },
  { key: "f1tv", label: "F1 TV", price: 9.99, chip: "F1", category: "Sports" },
  { key: "nbaLeaguePass", label: "NBA League Pass", price: 14.99, chip: "NB", category: "Sports" },

  // Music & audio
  { key: "spotify", label: "Spotify", price: 11.99, chip: "SP", category: "Music" },
  { key: "appleMusic", label: "Apple Music", price: 10.99, chip: "AM", category: "Music" },
  { key: "youtubeMusic", label: "YouTube Music", price: 10.99, chip: "YM", category: "Music" },
  { key: "youtubePremium", label: "YouTube Premium", price: 13.99, chip: "YT", category: "Music" },
  { key: "amazonMusic", label: "Amazon Music Unlimited", price: 9.99, chip: "AZ", category: "Music" },
  { key: "tidal", label: "Tidal", price: 10.99, chip: "TD", category: "Music" },
  { key: "deezer", label: "Deezer", price: 10.99, chip: "DZR", category: "Music" },
  { key: "audible", label: "Audible", price: 14.95, chip: "AU", category: "Music" },

  // Gaming
  { key: "xboxGamePass", label: "Xbox Game Pass", price: 16.99, chip: "XB", category: "Gaming" },
  { key: "playstationPlus", label: "PlayStation Plus", price: 17.99, chip: "PS", category: "Gaming" },
  { key: "nintendoOnline", label: "Nintendo Switch Online", price: 3.99, chip: "NS", category: "Gaming" },
  { key: "eaPlay", label: "EA Play", price: 4.99, chip: "EA", category: "Gaming" },
  { key: "ubisoftPlus", label: "Ubisoft+", price: 17.99, chip: "UB", category: "Gaming" },

  // Cloud & productivity
  { key: "icloudPlus", label: "iCloud+", price: 2.99, chip: "IC", category: "Productivity" },
  { key: "googleOne", label: "Google One", price: 2.99, chip: "GO", category: "Productivity" },
  { key: "dropboxPlus", label: "Dropbox Plus", price: 11.99, chip: "DB", category: "Productivity" },
  { key: "microsoft365", label: "Microsoft 365", price: 9.99, chip: "M3", category: "Productivity" },
  { key: "adobeCC", label: "Adobe Creative Cloud", price: 59.99, chip: "AD", category: "Productivity" },
  { key: "canvaPro", label: "Canva Pro", price: 12.99, chip: "CV", category: "Productivity" },
  { key: "notionPlus", label: "Notion Plus", price: 10.0, chip: "NT", category: "Productivity" },
  { key: "chatgptPlus", label: "ChatGPT Plus", price: 20.0, chip: "GP", category: "Productivity" },
  { key: "grammarly", label: "Grammarly Premium", price: 12.0, chip: "GR", category: "Productivity" },
  { key: "zoomPro", label: "Zoom Pro", price: 15.99, chip: "ZM", category: "Productivity" },
  { key: "slackPro", label: "Slack Pro", price: 8.75, chip: "SK", category: "Productivity" },

  // News & learning
  { key: "nytimes", label: "The New York Times", price: 6.0, chip: "NY", category: "News" },
  { key: "wsj", label: "The Wall Street Journal", price: 8.0, chip: "WJ", category: "News" },
  { key: "economist", label: "The Economist", price: 14.0, chip: "EC", category: "News" },
  { key: "duolingo", label: "Duolingo Super", price: 12.99, chip: "DL", category: "Learning" },
  { key: "linkedinPremium", label: "LinkedIn Premium", price: 39.99, chip: "LI", category: "Learning" },

  // Wellness & fitness
  { key: "headspace", label: "Headspace", price: 12.99, chip: "HD", category: "Wellness" },
  { key: "calm", label: "Calm", price: 14.99, chip: "CL", category: "Wellness" },
  { key: "strava", label: "Strava", price: 11.99, chip: "ST", category: "Wellness" },
  { key: "peloton", label: "Peloton App", price: 12.99, chip: "PL", category: "Wellness" },

  // Delivery & membership
  { key: "uberOne", label: "Uber One", price: 9.99, chip: "UO", category: "Delivery" },
  { key: "dashpass", label: "DoorDash DashPass", price: 9.99, chip: "DP", category: "Delivery" },
  { key: "instacartPlus", label: "Instacart+", price: 9.99, chip: "IN", category: "Delivery" },
  { key: "costco", label: "Costco Membership", price: 5.42, chip: "CO", category: "Membership" },

  // Security
  { key: "nordvpn", label: "NordVPN", price: 5.99, chip: "NV", category: "Security" },
  { key: "expressvpn", label: "ExpressVPN", price: 8.32, chip: "EV", category: "Security" },
];

// Mobile operators per country, keyed by ISO-2 the same way the banks
// data is. Only the person's own country's list is ever shown. Every row
// is locked (right-side lock) until live recharge APIs are connected —
// the list itself is real so the UI is ready the day the APIs are.
const TELECOMS_BY_COUNTRY = {
  IN: ["Jio", "Airtel", "Vi (Vodafone Idea)", "BSNL", "MTNL"],
  US: ["Verizon", "AT&T", "T-Mobile", "Mint Mobile", "Cricket Wireless", "Boost Mobile"],
  GB: ["EE", "O2", "Vodafone UK", "Three", "giffgaff", "Sky Mobile"],
  PK: ["Jazz", "Zong", "Telenor Pakistan", "Ufone", "SCOM"],
  CA: ["Rogers", "Bell", "Telus", "Freedom Mobile", "Fido"],
  DE: ["Deutsche Telekom", "Vodafone Germany", "O2 Germany", "1&1"],
  FR: ["Orange", "SFR", "Bouygues Telecom", "Free Mobile"],
  IT: ["TIM", "Vodafone Italy", "WindTre", "Iliad"],
  ES: ["Movistar", "Vodafone Spain", "Orange Spain", "Yoigo", "Digi"],
  BR: ["Vivo", "Claro", "TIM Brasil", "Oi"],
  MX: ["Telcel", "Movistar México", "AT&T México"],
  AE: ["e& (Etisalat)", "du", "Virgin Mobile UAE"],
  SA: ["STC", "Mobily", "Zain"],
  CN: ["China Mobile", "China Unicom", "China Telecom"],
  JP: ["NTT Docomo", "au (KDDI)", "SoftBank", "Rakuten Mobile"],
  KR: ["SK Telecom", "KT", "LG U+"],
  RU: ["MTS", "Beeline", "MegaFon", "Tele2"],
  AU: ["Telstra", "Optus", "Vodafone Australia", "TPG"],
  ID: ["Telkomsel", "Indosat Ooredoo", "XL Axiata", "Smartfren"],
  PH: ["Globe", "Smart", "DITO"],
  BD: ["Grameenphone", "Robi", "Banglalink", "Teletalk"],
  NG: ["MTN Nigeria", "Airtel Nigeria", "Glo", "9mobile"],
  ZA: ["Vodacom", "MTN South Africa", "Cell C", "Telkom"],
  EG: ["Vodafone Egypt", "Orange Egypt", "Etisalat Misr", "WE"],
  VN: ["Viettel", "Vinaphone", "MobiFone"],
  TH: ["AIS", "TrueMove H", "dtac"],
  MY: ["Maxis", "CelcomDigi", "U Mobile", "unifi Mobile"],
  SG: ["Singtel", "StarHub", "M1", "SIMBA"],
  TR: ["Turkcell", "Vodafone Türkiye", "Türk Telekom"],
  NL: ["KPN", "VodafoneZiggo", "Odido"],
  CH: ["Swisscom", "Sunrise", "Salt"],
};

// Electricity operators per country, same pattern and same ISO-2 keys as
// TELECOMS_BY_COUNTRY. Only the person's own country's list is shown, and
// every row is locked (right-side lock) until live utility-payment APIs
// are connected.
const ELECTRICITY_BY_COUNTRY = {
  IN: ["Tata Power", "Adani Electricity", "BSES Rajdhani", "BSES Yamuna", "Torrent Power"],
  US: ["Con Edison", "PG&E", "Duke Energy", "Southern Company", "Exelon", "Dominion Energy"],
  GB: ["British Gas", "EDF Energy", "E.ON Next", "Octopus Energy", "Scottish Power", "OVO Energy"],
  PK: ["K-Electric", "LESCO", "IESCO", "FESCO", "GEPCO"],
  CA: ["Hydro One", "BC Hydro", "Hydro-Québec", "Toronto Hydro"],
  DE: ["E.ON", "RWE", "EnBW", "Vattenfall"],
  FR: ["EDF", "Engie", "TotalEnergies"],
  IT: ["Enel", "Eni Plenitude", "A2A"],
  ES: ["Iberdrola", "Endesa", "Naturgy"],
  BR: ["Enel Brasil", "CPFL Energia", "Light", "Cemig"],
  MX: ["CFE"],
  AE: ["DEWA", "ADDC (EtihadWE)", "SEWA"],
  SA: ["Saudi Electricity Company"],
  CN: ["State Grid Corporation", "China Southern Power Grid"],
  JP: ["TEPCO", "Kansai Electric Power", "Chubu Electric Power"],
  KR: ["KEPCO"],
  RU: ["Rosseti", "Inter RAO"],
  AU: ["AGL Energy", "Origin Energy", "EnergyAustralia"],
  ID: ["PLN"],
  PH: ["Meralco"],
  BD: ["DESCO", "DPDC", "BPDB"],
  NG: ["Ikeja Electric", "Eko Electricity", "AEDC"],
  ZA: ["Eskom", "City Power Johannesburg"],
  EG: ["Egyptian Electricity Holding Company"],
  VN: ["EVN (Vietnam Electricity)"],
  TH: ["MEA", "PEA"],
  MY: ["Tenaga Nasional (TNB)"],
  SG: ["SP Group"],
  TR: ["TEDAŞ", "Enerjisa"],
  NL: ["Essent", "Vattenfall NL", "Eneco"],
  CH: ["Swissgrid", "BKW", "EWZ"],
};

function AccountsTabIcon({ active }) {
  const c = active ? "#7c3aed" : "#9a94ad";
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke={c} strokeWidth="2">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10.5h18" strokeLinecap="round" />
      <path d="M7 15h4" strokeLinecap="round" />
    </svg>
  );
}

// Basic time filters offered on the Profile's Paid / Received panels.
// Demo data only spans Jun–Jul, so this is a simple month match rather
// than real date-range math — enough to make the filter feel functional.
const MONEY_FILTERS = ["All", "This Month", "Last Month"];

// Rows carry the real transaction timestamp in `at`, so the period filter is
// resolved against the actual current month rather than hard-coded month
// names — which only worked while the rows were fixed demo data.
function filterMoneyRows(rows, filter) {
  if (filter === "All") return rows;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - (filter === "Last Month" ? 1 : 0), 1);
  return rows.filter((r) => {
    if (!r.at) return false;
    const d = new Date(r.at);
    return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
  });
}

// Maps one GET /api/transactions/history entry onto the shape the Profile
// money panels and history sheets render. The backend already computes
// `direction` and `counterparty` relative to whoever asked, so no
// sender/receiver comparison is needed here. It has no country for the
// counterparty, hence the neutral globe rather than a guessed flag.
function toMoneyRow(txn) {
  const when = txn.createdAt ? new Date(txn.createdAt) : null;
  return {
    name: txn.counterparty?.fullName || txn.counterparty?.symbolId || "Gloobal User",
    date: when ? when.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "",
    at: txn.createdAt || null,
    amount: Number(txn.amount) || 0,
    flag: "🌐",
    status: txn.direction === "sent" ? txn.status || "completed" : "received",
  };
}

// Send Money / Receive Money task histories — module-level (not tied to
// any one screen's state) since they're read from four places: the
// History icon on the Send Money screen, the History icon on the Receive
// sheet, and the Profile's separate Paid and Received panels. Demo data
// only (prototype stage); same shape either direction so both lists render
// identically.
// Empty until GET /api/transactions/history answers — a brand-new account
// genuinely has no history, and the money panels already render a
// "Nothing here yet" state for that.
const NO_MONEY_ROWS = [];

// Languages and currencies offered in the profile's basic settings. Purely
// client-side selections for now (prototype stage) — picking one updates
// the selected state so the UI behaves like the real thing, without any
// backend or i18n plumbing behind it yet.
const PROFILE_LANGUAGES = ["English", "Español", "Français", "العربية", "हिन्दी", "中文"];

const PROFILE_CURRENCIES = ["USD", "EUR", "GBP", "INR", "PKR", "PHP", "MXN", "NGN", "BRL", "JPY"];

// Tiny inline bar chart for the Profile's Paid / Received panels — no
// charting dependency, just SVG rects sized against the row amounts, so
// it renders instantly inside this single-file component. Tapping a bar
// pins that transaction's name/date/amount above the chart (tap again to
// clear it) — the same tap-to-inspect pattern as the dashboard's mini
// chart, plus a dashed average line so each bar reads against a baseline
// rather than only against its neighbors.
function ProfileMoneyChart({ rows, color }) {
  const [selected, setSelected] = useState(null); // tapped bar index, or null
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const avg = rows.length ? rows.reduce((s, r) => s + r.amount, 0) / rows.length : 0;
  const barW = 26;
  const gap = 14;
  const chartH = 84;
  const width = rows.length > 0 ? rows.length * (barW + gap) : 100;
  const chartWidth = Math.max(width, 100);
  const avgY = chartH - (avg / max) * chartH;

  return (
    <div>
      <div style={{ minHeight: 16, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {selected !== null && rows[selected] ? (
          <>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {rows[selected].name}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color, flexShrink: 0, marginLeft: 8 }}>
              {rows[selected].date} · {rows[selected].amount.toFixed(2)}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: T.inkFaint }}>Tap a bar for details</span>
        )}
      </div>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <svg width={chartWidth} height={chartH + 22} style={{ display: "block" }}>
          {rows.length > 1 && (
            <line x1={0} y1={avgY} x2={chartWidth} y2={avgY} stroke={T.inkFaint} strokeWidth={1} strokeDasharray="3,4" opacity={0.5} />
          )}
          {rows.map((r, i) => {
            const h = Math.max(4, (r.amount / max) * chartH);
            const x = i * (barW + gap) + gap / 2;
            const isSelected = selected === i;
            return (
              <g
                key={`${r.name}-${r.date}`}
                onClick={() => setSelected((s) => (s === i ? null : i))}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={x}
                  y={chartH - h}
                  width={barW}
                  height={h}
                  rx={7}
                  fill={color}
                  opacity={selected === null ? 0.85 : isSelected ? 1 : 0.35}
                />
                {isSelected && (
                  <rect x={x - 2} y={chartH - h - 2} width={barW + 4} height={h + 4} rx={8} fill="none" stroke={color} strokeWidth={1.5} />
                )}
                <text
                  x={x + barW / 2}
                  y={chartH + 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill={isSelected ? T.ink : T.inkFaint}
                >
                  {r.date.split(" ")[1] || r.date}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// Shared layout for the Profile's Paid and Received panels — filter
// chips, a mini bar chart, the transaction list, and a CTA button that
// simply reuses the existing Send / Receive flows (no new flows needed).
function ProfileMoneySection({ rows, filter, onFilterChange, color, chip, sign, ccy, ctaLabel, onCta }) {
  // Summary tiles above the chart — a proper glance at the filtered
  // period instead of just the raw bars, which is what a bigger dedicated
  // screen has the room for that the dashboard's mini chart doesn't.
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const avg = rows.length ? total / rows.length : 0;
  const highest = rows.length ? Math.max(...rows.map((r) => r.amount)) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 999, background: T.surfaceAlt }}>
        {MONEY_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className="v2-tap"
            style={{
              flex: 1,
              border: "none",
              borderRadius: 999,
              padding: "8px 0",
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
              color: filter === f ? "#fff" : T.inkSoft,
              background: filter === f ? T.gradButton : "transparent",
              transition: "background 0.18s ease, color 0.18s ease",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {rows.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["Total", total],
            ["Average", avg],
            ["Highest", highest],
          ].map(([label, val]) => (
            <div
              key={label}
              style={{ flex: 1, borderRadius: T.radiusMd, background: T.surface, boxShadow: T.shadowCard, padding: "10px 8px", textAlign: "center" }}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginTop: 2 }}>{ccy}{val.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "16px 14px 8px" }}>
        {rows.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12, color: T.inkFaint }}>Nothing here yet</div>
        ) : (
          <ProfileMoneyChart rows={rows} color={color} />
        )}
      </div>

      <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: T.inkFaint }}>Nothing yet</div>
        ) : (
          rows.map((t, i) => (
            <div
              key={`${t.name}-${t.date}`}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i === 0 ? "none" : `1px solid ${T.line}` }}
            >
              <span
                style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: chip, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
                }}
              >
                {t.flag}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                <span style={{ display: "block", fontSize: 11, color: T.inkFaint, marginTop: 1 }}>{t.date}</span>
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 800, color, flexShrink: 0 }}>
                {sign}{ccy}{t.amount.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>

      <button
        onClick={onCta}
        className="v2-tap"
        style={{ border: "none", borderRadius: T.radiusMd, padding: "14px 0", color: "#fff", fontSize: 13.5, fontWeight: 800, background: T.gradButton, boxShadow: "0 8px 20px rgba(124,58,237,0.32)", cursor: "pointer" }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

// A minimal on/off switch for the profile's Security / Notifications
// sheets — same violet accent as the rest of the app.
function ProfileToggle({ on, onToggle, label }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      aria-label={label}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        border: "none",
        flexShrink: 0,
        background: on ? T.accent : "#DDD9EA",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.18s ease",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 4px rgba(20,18,43,0.25)",
          transition: "left 0.18s ease",
        }}
      />
    </button>
  );
}

// Mock spending history for the wallet card's mini chart, grouped Sunday
// through Saturday. Capped at exactly two weeks (this week + last week) —
// there is no data beyond that, which is what makes the swipeable chart's
// two-week limit real rather than just a UI restriction.
const SPENDING_DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function generateDailySpending() {
  // Each day now carries both sides of the ledger — paid (money out) and
  // received (money in) — so the chart can show a single day split in two
  // rather than one bar per day.
  const weeks = [0, 1].map(() =>
    Array.from({ length: 7 }, () => ({
      paid: Math.round((Math.random() * 110 + 15) * 100) / 100,
      received: Math.round((Math.random() * 90 + 10) * 100) / 100,
    }))
  );
  const totals = weeks.map((week) => ({
    paid: Math.round(week.reduce((sum, d) => sum + d.paid, 0) * 100) / 100,
    received: Math.round(week.reduce((sum, d) => sum + d.received, 0) * 100) / 100,
  }));
  return { weeks, totals }; // weeks[0] = this week (Sun..Sat), weeks[1] = last week
}

// A mini 7-bar chart of the wallet card's daily spending, Sunday through
// Saturday. The two interactions are kept separate on purpose: drag left/
// right on the chart to switch between this week and last week (week-wise),
// and tap a single bar to see that one day's amount (day-wise) — tapping it
// again goes back to showing the week total. Hard-capped at two weeks total
// — dragging past either end just resists/holds instead of paging into data
// that isn't there.
function DailySpendingChart({ weeks, totals, symbol = "$" }) {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = last week
  const [selectedDay, setSelectedDay] = useState(null); // index into the current week, or null
  const maxOffset = weeks.length - 1;
  const dragRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const clamp = (n) => Math.max(0, Math.min(maxOffset, n));

  const handlePointerDown = (e) => {
    dragRef.current = { startX: e.clientX, moved: 0 };
    setDragging(true);
  };
  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    let delta = e.clientX - dragRef.current.startX;
    dragRef.current.moved = Math.abs(delta);
    // Resist dragging past either end instead of allowing free travel.
    if ((weekOffset === 0 && delta < 0) || (weekOffset === maxOffset && delta > 0)) {
      delta *= 0.3;
    }
    setDragX(delta);
  };
  const handlePointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    const dragThreshold = 36;
    if (d && d.moved < 6) {
      // Barely moved — a tap on one specific day, not a week swipe.
      const dayEl = e.target.closest && e.target.closest("[data-day-index]");
      if (dayEl) {
        const i = Number(dayEl.getAttribute("data-day-index"));
        setSelectedDay((prev) => (prev === i ? null : i));
      }
    } else if (dragX < -dragThreshold) {
      setWeekOffset((w) => clamp(w + 1)); // dragged left -> older week
      setSelectedDay(null);
    } else if (dragX > dragThreshold) {
      setWeekOffset((w) => clamp(w - 1)); // dragged right -> newer week
      setSelectedDay(null);
    }
    setDragX(0);
  };

  const days = weeks[weekOffset]; // [{ paid, received }, ...] for the week
  const total = totals[weekOffset]; // { paid, received }
  const max = Math.max(...days.map((d) => Math.max(d.paid, d.received)), 1);
  const display = selectedDay !== null ? days[selectedDay] : total;

  return (
    <div style={{ position: "relative" }}>
      {/* Paid sits top-left in red, Received sits top-right in green — the
          same red/green split carries down into each day's bar below. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#FCA5A5", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Paid
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{symbol}{display.paid.toFixed(2)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#86EFAC", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Received
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{symbol}{display.received.toFixed(2)}</div>
        </div>
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 7,
          height: 46,
          marginTop: 12,
          touchAction: "pan-y",
          cursor: dragging ? "grabbing" : "grab",
          transform: `translateX(${dragX * 0.4}px)`,
          transition: dragging ? "none" : "transform 0.25s ease",
        }}
      >
        {days.map((d, i) => {
          const isToday = weekOffset === 0 && i === days.length - 1;
          const isSelected = selectedDay === i;
          const highlighted = selectedDay !== null ? isSelected : isToday;
          const paidH = Math.max(4, (d.paid / max) * 34);
          const receivedH = Math.max(4, (d.received / max) * 34);
          return (
            <div key={i} data-day-index={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              {/* Each day's bar is split in half: red (paid) on the left,
                  green (received) on the right, sharing one baseline. */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, width: "100%", maxWidth: 22, justifyContent: "center" }}>
                <div
                  role="img"
                  aria-label={`${SPENDING_DAY_LABELS[i]} paid: ${symbol}${d.paid.toFixed(2)}`}
                  style={{
                    flex: 1,
                    height: paidH,
                    borderRadius: "4px 2px 2px 4px",
                    background: highlighted ? "#EF4444" : "rgba(239,68,68,0.5)",
                    boxShadow: isSelected ? "0 0 0 1.5px rgba(255,255,255,0.9)" : "none",
                    transition: "height 0.3s ease, background 0.15s ease",
                  }}
                />
                <div
                  role="img"
                  aria-label={`${SPENDING_DAY_LABELS[i]} received: ${symbol}${d.received.toFixed(2)}`}
                  style={{
                    flex: 1,
                    height: receivedH,
                    borderRadius: "2px 4px 4px 2px",
                    background: highlighted ? "#22C55E" : "rgba(34,197,94,0.5)",
                    boxShadow: isSelected ? "0 0 0 1.5px rgba(255,255,255,0.9)" : "none",
                    transition: "height 0.3s ease, background 0.15s ease",
                  }}
                />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 700, opacity: highlighted ? 0.95 : 0.6 }}>
                {SPENDING_DAY_LABELS[i]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Two dots mark the hard two-week limit — just a quiet sense of
          "there's one more week back, and that's it". */}
      <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 10 }}>
        {weeks.map((_, i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: i === weekOffset ? "#ffffff" : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Display symbol for every supported currency — used anywhere an amount
// is shown, so an Indian user sees ₹, a British user £, and so on,
// following COUNTRY_CURRENCY from the registration country.
const CURRENCY_SYMBOL = {
  USD: "$", EUR: "\u20ac", GBP: "\u00a3", CAD: "C$", AUD: "A$", CHF: "CHF ",
  SEK: "kr ", NOK: "kr ", DKK: "kr ", PLN: "z\u0142 ", RUB: "\u20bd", TRY: "\u20ba",
  UAH: "\u20b4", INR: "\u20b9", CNY: "\u00a5", JPY: "\u00a5", KRW: "\u20a9", IDR: "Rp ",
  PHP: "\u20b1", VND: "\u20ab", THB: "\u0e3f", MYR: "RM ", SGD: "S$", PKR: "\u20a8 ",
  BDT: "\u09f3", SAR: "SR ", AED: "AED ", ILS: "\u20aa", EGP: "E\u00a3", ZAR: "R ",
  NGN: "\u20a6", KES: "KSh ", BRL: "R$", MXN: "Mex$", ARS: "AR$", CLP: "CL$",
  COP: "CO$", PEN: "S/ ", NZD: "NZ$", ISK: "kr ",
};

function DashboardScreenBase({
  dialCountry,
  onLogout,
  onOpenSend,
  onOpenBank,
  onOpenCoverage,
  myGloobalId,
  phoneNumber,
  fullName,
  referralCount,
}) {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [activeTab, setActiveTab] = useState("home"); // home | accounts | profile
  // Real transaction history for this account, split by direction. A
  // failure leaves the panels on their empty state rather than showing
  // invented rows.
  const [moneyRows, setMoneyRows] = useState(NO_MONEY_ROWS);

  // Send Money renders as an overlay above this screen, so the dashboard
  // never unmounts and a fetch on mount alone would leave the Profile
  // panels showing pre-transfer data. Re-reading on every tab switch is
  // what makes a payment appear as soon as you go look for it.
  useEffect(() => {
    if (!myGloobalId) return;
    let cancelled = false;
    (async () => {
      try {
        const txns = await getHistory(myGloobalId);
        if (cancelled) return;
        setMoneyRows(txns.map(toMoneyRow));
      } catch {
        // offline or backend still waking up — keep the empty state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myGloobalId, activeTab]);

  const sentRows = useMemo(() => moneyRows.filter((r) => r.status !== "received"), [moneyRows]);
  const receivedRows = useMemo(() => moneyRows.filter((r) => r.status === "received"), [moneyRows]);
  // The PayLater screen (opened from the Accounts tab). Demo ledger for
  // the prototype: dues are derived from the pending history entries so
  // the balance, dues, and history can never disagree with each other.
  const [showPayLater, setShowPayLater] = useState(false);
  const PAYLATER_LIMIT = 500;
  // Demo ledger, split by direction: "out" = sending (purchases charged
  // to PayLater), "in" = receiving (repayments/refunds credited back).
  // Dues derive only from pending outgoing entries, so balance, dues,
  // and history can never disagree.
  const paylaterHistory = [
    { name: "Metro Recharge", date: "Jul 14", amount: 15.0, status: "pending", direction: "out" },
    { name: "Grocery Mart", date: "Jul 8", amount: 42.5, status: "pending", direction: "out" },
    { name: "Repayment — June dues", date: "Jul 1", amount: 68.75, status: "received", direction: "in" },
    { name: "City Electricity", date: "Jun 28", amount: 60.0, status: "paid", direction: "out" },
    { name: "Coffee Corner", date: "Jun 21", amount: 8.75, status: "paid", direction: "out" },
    { name: "Refund — BookHouse", date: "Jun 15", amount: 31.25, status: "received", direction: "in" },
  ];
  const paylaterSending = paylaterHistory.filter((t) => t.direction === "out");
  const paylaterReceiving = paylaterHistory.filter((t) => t.direction === "in");
  const paylaterDue = paylaterSending.filter((t) => t.status === "pending").reduce((s, t) => s + t.amount, 0);
  const paylaterAvailable = PAYLATER_LIMIT - paylaterDue;

  const [showReceiveHistory, setShowReceiveHistory] = useState(false);
  const [showIdTag, setShowIdTag] = useState(false);
  const [toast, setToast] = useState(null);
  const [showReceive, setShowReceive] = useState(false);
  // Rent (from the Bills row) now opens a choice instead of a single
  // action: showRentChoice is the "Send Rent / Accept Rent" picker sheet,
  // and showRentReceive is the QR + Gloobal ID sheet shown after picking
  // Accept Rent. Send Rent doesn't need its own state — it just reuses
  // onOpenSend, the exact same flow the main Send action opens.
  const [showRentChoice, setShowRentChoice] = useState(false);
  const [showRentReceive, setShowRentReceive] = useState(false);
  // The per-country telecom recharge sheet (opened from the Bills row).
  const [showRecharge, setShowRecharge] = useState(false);
  // The per-country electricity operator sheet — same locked pattern as
  // showRecharge (opened from the Bills row).
  const [showElectricity, setShowElectricity] = useState(false);
  // "More" — opened from the Bills row's 4th button. A search bar over a
  // single scrollable list: Recharge/Electricity/Rent pinned first (same
  // handlers as their own Bills buttons), then Travel as its own icon
  // group, then the top 10 businesses. Tapping a business or travel
  // option opens payTarget below — a minimal functional pay sheet (same
  // amount-in/confirm core as Send Money), not another locked catalogue.
  const [showMore, setShowMore] = useState(false);
  const [moreQuery, setMoreQuery] = useState("");
  const [travelExpanded, setTravelExpanded] = useState(false);
  const [payTarget, setPayTarget] = useState(null); // { label, chip } | null
  const [payAmount, setPayAmount] = useState("25.00");
  // The same four-option "Pay with" funding-source chooser Send Money
  // uses (Gloobal Bank / Gloobal PayLater / Gloobal Coin / Local Banks) —
  // every place with a Pay action leads with the same four options
  // before it confirms, so this sheet isn't a different, shorter path.
  const [payTargetMethodOpen, setPayTargetMethodOpen] = useState(false);
  const [payTargetMethod, setPayTargetMethod] = useState(null);
  // null | "share" | "referral" — full-screen overlays opened from the
  // Profile tab, layered above the tab bar the same way Send/Bank/Coverage
  // sit above the dashboard itself.
  const [profileOverlay, setProfileOverlay] = useState(null);
  // My Referral Network, straight from GET /api/referrals/:symbolId — the
  // real edges the backend recorded at registration, not a generated
  // sample. Fetched when the overlay opens (and on retry), so a referral
  // made since the app launched shows up without a reload.
  const [referrals, setReferrals] = useState([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsError, setReferralsError] = useState(null);
  const [referralsAttempt, setReferralsAttempt] = useState(0);
  // Whether the "How your network works" explanation card is open —
  // opened from the option that replaced the old "Invite a friend" CTA.
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  // Which profile settings sheet is open (one of PROFILE_ROWS), or null.
  // Each sheet has minimal-but-real behavior for the prototype: toggles
  // actually toggle, language/currency selections actually select.
  const [profileDetail, setProfileDetail] = useState(null);
  // Basic time filters for the Profile's separate Paid and Received
  // panels — each panel keeps its own filter, reset to "All" whenever
  // that panel is opened fresh.
  const [paidFilter, setPaidFilter] = useState("All");
  const [receivedFilter, setReceivedFilter] = useState("All");
  useEffect(() => {
    if (profileDetail === "Paid") setPaidFilter("All");
    if (profileDetail === "Received") setReceivedFilter("All");
  }, [profileDetail]);
  // Personal Details' Name row cycles through the same shared identity
  // faces used elsewhere (name → Gloobal ID → mobile number → country
  // name) via one tap, resetting to "name" each time the sheet opens.
  const [personalDisplayMode, setPersonalDisplayMode] = useState("name");
  useEffect(() => {
    if (profileDetail === "Personal Details") setPersonalDisplayMode("name");
  }, [profileDetail]);
  const [profileToggles, setProfileToggles] = useState({
    biometric: true,
    appLock: false,
    txAlerts: true,
    referralAlerts: true,
    promos: false,
    autopay: true,
  });
  const [profileLanguage, setProfileLanguage] = useState("English");
  const [profileCurrency, setProfileCurrency] = useState(COUNTRY_CURRENCY[dialCountry.iso] || "USD");
  const flipToggle = (key) => setProfileToggles((t) => ({ ...t, [key]: !t[key] }));
  // The Subscriptions catalogue is fully locked for now (no live billing
  // APIs yet), so there's nothing to toggle per row — just a search query
  // to filter the worldwide brand list.
  const [subscriptionQuery, setSubscriptionQuery] = useState("");
  const balance = "12,480.50";
  // The person's own currency symbol, from their registration country —
  // every amount on this screen renders in it (₹ for India, £ for the
  // UK, and so on), instead of hardcoded dollars.
  const ccy = CURRENCY_SYMBOL[COUNTRY_CURRENCY[dialCountry.iso] || "USD"] || "$";

  // The one canonical Gloobal ID: the 12-symbol Secure ID set at
  // registration. This exact same value is what shows on the dashboard's
  // flag-tap tag, the Receive sheet, the Share screen, and inside the
  // referral link — receiving, sharing, and referring are all the same
  // identity, never three different-looking codes. Falls back to a run of
  // "+" the same length if it isn't available yet, rather than showing
  // nothing.
  const shareableGloobalId = myGloobalId && myGloobalId.length === 12 ? myGloobalId : "++++++++++++";
  const gloobalIdTag = shareableGloobalId;

  // The Gloobal ID doubles as the referral code, so every share/invite path
  // resolves to one direct link — no separate referral code to manage.
  // Swap this base URL for the real deep-link domain when it exists.
  //
  // The ID is made of Unicode symbols (■ □ ● ○ + − × =), none of which are
  // safe raw in a URL path: messaging apps either refuse to linkify them or
  // encode them inconsistently, and a bare "+" is read back as a space, so
  // the link resolves to the wrong ID. encodeURIComponent percent-encodes
  // every one of them — encodeURI would not, since it leaves + and = alone.
  const referralLink = `https://gloobal.id/r/${encodeURIComponent(shareableGloobalId)}`;

  // A random placeholder profile photo, picked once per session rather than
  // re-randomizing on every render.
  const [avatarSeed] = useState(() => Math.floor(Math.random() * 70) + 1);

  useEffect(() => {
    if (profileOverlay !== "referral") return;
    const symbolId = myGloobalId;
    if (!symbolId) {
      setReferrals([]);
      setReferralsError(null);
      return;
    }
    let cancelled = false;
    setReferralsLoading(true);
    setReferralsError(null);
    getReferrals(symbolId)
      .then((list) => {
        if (!cancelled) setReferrals(list);
      })
      .catch(() => {
        if (!cancelled) setReferralsError("Could not load referrals. Try again.");
      })
      .finally(() => {
        if (!cancelled) setReferralsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileOverlay, myGloobalId, referralsAttempt]);

  // Two weeks of spending (this week + last week) shown as a swipeable mini
  // bar chart at the bottom of the wallet card — generated once per
  // session, same pattern as the referral network mock above.
  const [dailySpending] = useState(() => generateDailySpending());

  // Which profile this Gloobal ID is acting as when it's shared — "user"
  // for personal spending (bills, transfers to friends/family) or
  // "merchant" for business takings (shop sales, invoices). Flipping this
  // is the same quick rotateY flip used for the Secure ID / Referral card
  // during registration. Whichever side is showing is the profile a
  // payment coming in through this ID should be recorded against — the
  // actual ledger split lives outside this screen; this state is the
  // switch it would read.
  const [shareRole, setShareRole] = useState("user"); // "user" | "merchant"
  const [roleFlipping, setRoleFlipping] = useState(false);

  const toggleShareRole = () => {
    setRoleFlipping(true);
    setTimeout(() => {
      setShareRole((r) => (r === "user" ? "merchant" : "user"));
      setRoleFlipping(false);
    }, 180);
  };

  const revealGloobalId = () => {
    setShowIdTag(true);
    setTimeout(() => setShowIdTag(false), 2500);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  // Single shared handler for every "Share" action in the app (Profile tab,
  // search bar icon, Referral Network invite) — always shares the direct
  // referral link, never just the bare ID.
  // The message body carries the ID twice on purpose: once as the raw
  // symbols, so the person reading it can see and retype the Gloobal ID
  // by hand, and once inside the percent-encoded link, which is the only
  // form that survives being turned into a tappable URL.
  const handleShareReferralLink = async () => {
    const text = `Join me on Gloobal Access — send and receive money globally.\nMy Gloobal ID: ${shareableGloobalId}\nTap to join: ${referralLink}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join Gloobal Access", text, url: referralLink });
      } else {
        await navigator.clipboard.writeText(referralLink);
        showToast(shareRole === "merchant" ? "Link copied · Creators" : "Link copied · Personal");
      }
    } catch {
      // share/clipboard denied or dismissed — nothing to recover from
    }
  };

  const handleCopyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
    } catch {
      // share/clipboard denied or dismissed — nothing to recover from
    }
    showToast(shareRole === "merchant" ? "Link copied · Creators" : "Link copied · Personal");
  };

  // Shares the bare Gloobal ID itself (not the referral link) — used by
  // the Accept Rent sheet so a landlord can send just their ID/QR to a
  // tenant, the same navigator.share-with-clipboard-fallback pattern the
  // referral link share uses.
  const handleShareGloobalId = async () => {
    const text = `Send my rent to my Gloobal ID: ${gloobalIdTag}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Gloobal ID", text });
      } else {
        await navigator.clipboard.writeText(gloobalIdTag);
        showToast("Copied");
      }
    } catch {
      // share/clipboard denied or dismissed — nothing to recover from
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: T.fontBody,
        overflow: "hidden",
      }}
    >
      <DashboardAmbientBg />

      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 12px", background: "transparent" }}>
        <button
          onClick={onOpenCoverage}
          aria-label="Gloobal coverage"
          className="v2-tap"
          style={{
            border: "none",
            background: T.surface,
            width: 40,
            height: 40,
            borderRadius: "50%",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: T.shadowCard,
            flexShrink: 0,
          }}
        >
          <RotatingGlobeIcon />
        </button>
        <button
          onClick={onOpenCoverage}
          aria-label="Gloobal coverage"
          className="v2-tap"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "none",
            background: T.surface,
            borderRadius: T.radiusMd,
            padding: "11px 15px",
            boxShadow: T.shadowCard,
            cursor: "pointer",
          }}
        >
          <Search size={15} color={T.inkFaint} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: T.inkFaint, fontWeight: 500, textAlign: "center" }}>Gloobal Coverage</span>
          <span style={{ width: 15, flexShrink: 0 }} aria-hidden="true" />
        </button>

        {/* Profile flip — switches the same account between its two
            sides: user/consumer and merchant/producer. Every flow stays
            identical; only which side the data is read as changes (and
            share links already carry the active side via shareRole). */}
        <button
          onClick={() => {
            setShareRole((r) => {
              const next = r === "user" ? "merchant" : "user";
              showToast(next === "merchant" ? "Switched to Creators profile" : "Switched to Personal profile");
              return next;
            });
          }}
          aria-label={shareRole === "merchant" ? "Switch to personal profile" : "Switch to Creators profile"}
          className="v2-tap"
          style={{
            border: "none",
            background: shareRole === "merchant" ? T.gradButton : T.surface,
            width: 40,
            height: 40,
            borderRadius: "50%",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: shareRole === "merchant" ? "0 6px 16px rgba(124,58,237,0.3)" : T.shadowCard,
            flexShrink: 0,
          }}
        >
          <RefreshCw size={17} color={shareRole === "merchant" ? "#fff" : T.accent} />
        </button>
      </div>

      <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {activeTab === "home" && (
          <div style={{ padding: "8px 18px 30px", display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                position: "relative",
                borderRadius: T.radiusXl,
                padding: "24px 22px",
                background: T.gradWallet,
                boxShadow: T.shadowRaised,
                color: "#fff",
                overflow: "hidden",
              }}
            >
              {/* Soft decorative glow — purely visual, no logic */}
              <div
                style={{
                  position: "absolute",
                  top: -60,
                  right: -60,
                  width: 180,
                  height: 180,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, paddingRight: 44 }}>
                <button
                  onClick={revealGloobalId}
                  aria-label="Show my Gloobal ID"
                  className="v2-tap"
                  style={{
                    border: "1.5px solid rgba(255,255,255,0.35)",
                    background: "rgba(255,255,255,0.12)",
                    padding: 3,
                    borderRadius: 13,
                    cursor: "pointer",
                    display: "flex",
                    lineHeight: 0,
                    flexShrink: 0,
                  }}
                >
                  <FlagEmoji flag={dialCountry.flag} width={58} height={43} radius={9} />
                </button>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    opacity: 0.8,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {shareRole === "merchant" ? "Gloobal Creators" : `Gloobal ${dialCountry.name}`}
                </span>
              </div>

              {/* Pinned to the card's true top-right corner (not just the
                  header row) — sits outside the row's own padding so it
                  reads as a corner control for the whole card. */}
              <button
                onClick={() => setBalanceVisible((v) => !v)}
                aria-label={balanceVisible ? "Hide balance" : "Show balance"}
                className="v2-tap"
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  zIndex: 2,
                  border: "none",
                  background: "rgba(255,255,255,0.16)",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <EyeIcon open={balanceVisible} />
              </button>
              <div style={{ position: "relative", marginTop: 20, fontSize: shareRole === "merchant" ? 24 : 32, fontWeight: 800, letterSpacing: 0.2, fontFamily: T.fontDisplay }}>
                {balanceVisible ? `${ccy}${balance}` : "•••••••"}
              </div>
              {/* Spending mini chart — sits below its own divider so it
                  reads as a distinct footer section of the wallet card
                  rather than competing with the balance above it. */}
              <div style={{ position: "relative", marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.18)" }}>
                <DailySpendingChart weeks={dailySpending.weeks} totals={dailySpending.totals} symbol={ccy} />
              </div>

              {showIdTag && (
                <div
                  style={{
                    position: "absolute",
                    top: 66,
                    left: 22,
                    zIndex: 5,
                    background: "rgba(15,12,35,0.94)",
                    backdropFilter: "blur(6px)",
                    color: "#fff",
                    borderRadius: 14,
                    padding: "9px 14px",
                    boxShadow: T.shadowFloat,
                    whiteSpace: "nowrap",
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, opacity: 0.7, textTransform: "uppercase" }}>
                    Gloobal ID
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, marginTop: 1, fontFamily: T.fontDisplay }}>
                    {gloobalIdTag}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {DASHBOARD_ACTIONS.map(({ key, label, Icon }) => {
                const onClick =
                  key === "send" ? onOpenSend
                  : key === "bank" ? onOpenBank
                  : key === "receive" ? () => setShowReceive(true)
                  : key === "scan" ? () => showToast("Scanner opening…")
                  : undefined;
                return (
                <button
                  key={key}
                  onClick={onClick}
                  aria-label={label}
                  className="v2-tap"
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    aspectRatio: "1",
                    border: `1px solid ${T.line}`,
                    background: T.surface,
                    borderRadius: T.radiusLg,
                    cursor: onClick ? "pointer" : "default",
                    padding: "15px 14px",
                    boxShadow: T.shadowCard,
                  }}
                >
                  <CardAmbientField />
                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      width: 58,
                      height: 58,
                      flexShrink: 0,
                      borderRadius: 18,
                      background: T.accentSoft,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={27} />
                  </span>
                </button>
                );
              })}
            </div>

            {/* Bills — a single compact row, kept small and quiet so the
                screen still reads clean; "More" is the door to everything
                else the business/network offers, without listing it all
                here. Consumer bill-pay actions only — hidden on the
                merchant side, since a merchant profile isn't paying its
                own recharge/electricity/rent from here. */}
            {shareRole !== "merchant" && (
            <div style={{ display: "flex", gap: 10 }}>
              {BILL_ACTIONS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() =>
                    key === "recharge" ? setShowRecharge(true)
                    : key === "electricity" ? setShowElectricity(true)
                    : key === "rent" ? setShowRentChoice(true)
                    : key === "more" ? setShowMore(true)
                    : showToast(`${label} — coming soon`)
                  }
                  aria-label={label}
                  className="v2-tap"
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "12px 4px",
                    border: `1px solid ${T.line}`,
                    background: T.surface,
                    borderRadius: 16,
                    cursor: "pointer",
                    boxShadow: T.shadowCard,
                  }}
                >
                  <span
                    style={{
                      width: 32, height: 32, borderRadius: 10,
                      background: T.accentSoft, display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Icon size={15} color={T.accent} />
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: T.inkSoft }}>{label}</span>
                </button>
              ))}
            </div>
            )}
          </div>
        )}

        {activeTab === "accounts" && (
          <div style={{ padding: "12px 18px 30px", display: "flex", flexDirection: "column", gap: 22 }}>
            {/* Four account tiles — same square, ambient-field tile shape
                as the dashboard's Send / Add Bank / Scanner / Receive
                grid. Locks follow the red/green service system: Coin is
                still red-locked; Bank, PayLater, and Linked Banks are
                live. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {[
                { key: "gbank", label: "Gloobal Bank", locked: false, onClick: () => showToast("Gloobal Bank — your primary account") },
                { key: "gcoin", label: "Gloobal Coin", locked: true, onClick: () => showToast("Locked until live APIs connect") },
                { key: "gpaylater", label: "PayLater", locked: false, onClick: () => setShowPayLater(true) },
                { key: "linked", label: "Linked Banks", locked: false, onClick: onOpenBank },
              ].map(({ key, label, locked, onClick }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={onClick}
                    aria-label={locked ? `${label} — locked` : label}
                    className="v2-tap"
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      aspectRatio: "1",
                      border: `1px solid ${T.line}`,
                      background: T.surface,
                      borderRadius: T.radiusLg,
                      cursor: "pointer",
                      padding: "15px 14px",
                      boxShadow: T.shadowCard,
                    }}
                  >
                    <CardAmbientField />
                    <span style={{ position: "absolute", top: 12, right: 12, zIndex: 1 }}>
                      <ServiceLock locked={locked} size={13} />
                    </span>
                    <span
                      style={{
                        position: "relative",
                        zIndex: 1,
                        width: 58,
                        height: 58,
                        flexShrink: 0,
                        borderRadius: 18,
                        background: key === "gbank" ? T.gradButton : T.accentSoft,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: key === "gbank" ? "0 4px 12px rgba(124,58,237,0.28)" : "none",
                        overflow: "hidden",
                      }}
                    >
                      {key === "gbank" ? (
                        <img src={globalIdLogo} alt="" style={{ width: 40, height: 40, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                      ) : key === "gcoin" ? (
                        <Coins size={26} color={T.accent} />
                      ) : key === "gpaylater" ? (
                        <CreditCard size={26} color={T.accent} />
                      ) : (
                        <Landmark size={26} color={T.accent} />
                      )}
                    </span>
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, textAlign: "center" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div style={{ padding: "12px 18px 30px", display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "18px",
                borderRadius: T.radiusLg,
                background: T.surface,
                boxShadow: T.shadowCard,
              }}
            >
              <FlagEmoji
                flag={dialCountry.flag}
                width={54}
                height={54}
                radius={16}
                dropShadow="drop-shadow(0 4px 10px rgba(76,29,149,0.20))"
              />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Gloobal ID Member</div>
                <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>
                  {dialCountry.flag} {dialCountry.dialCode} · {dialCountry.name}
                </div>
              </div>
            </div>

            <div style={{ borderRadius: T.radiusLg, background: T.surface, overflow: "hidden", boxShadow: T.shadowCard }}>
              <button
                onClick={() => setProfileOverlay("referral")}
                className="v2-row"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 18px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: T.positiveSoft, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Gift size={18} color={T.positive} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>My Referral Network</div>
                  <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>See who you&apos;ve invited and what you&apos;ve earned</div>
                </span>
                <ChevronRightIcon />
              </button>
            </div>

            <div style={{ borderRadius: T.radiusLg, background: T.surface, overflow: "hidden", boxShadow: T.shadowCard }}>
              {PROFILE_ROWS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setProfileDetail(label)}
                  className="v2-row"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "15px 18px",
                    border: "none",
                    borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
                    background: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{label}</span>
                  <ChevronRightIcon />
                </button>
              ))}
            </div>

            <button
              onClick={onLogout}
              aria-label="Exit"
              className="v2-tap"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                border: "1px solid rgba(226,63,69,0.22)",
                background: T.negativeSoft,
                borderRadius: T.radiusMd,
                padding: "14px 0",
                color: T.negative,
                fontSize: 13.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              <LogoutIcon />
              Exit
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          background: T.surface,
          borderTop: `1px solid ${T.line}`,
          padding: "10px 0 calc(10px + env(safe-area-inset-bottom, 0px))",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setActiveTab("home")}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            border: "none",
            background: "none",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          <HomeTabIcon active={activeTab === "home"} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: activeTab === "home" ? T.accent : T.inkFaint }}>
            Home
          </span>
        </button>
        <button
          onClick={() => setActiveTab("accounts")}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            border: "none",
            background: "none",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          <AccountsTabIcon active={activeTab === "accounts"} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: activeTab === "accounts" ? T.accent : T.inkFaint }}>
            Accounts
          </span>
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            border: "none",
            background: "none",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          <ProfileTabIcon active={activeTab === "profile"} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: activeTab === "profile" ? T.accent : T.inkFaint }}>
            Profile
          </span>
        </button>
      </div>

      {toast && (
        <div
          style={{
            position: "absolute",
            bottom: 90,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            background: T.ink,
            color: "#fff",
            padding: "11px 18px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: T.shadowFloat,
          }}
        >
          {toast}
        </div>
      )}

      {/* Recharge sheet — mobile operators for the person's own country
          only. Every operator is listed but locked (right-side lock)
          until live recharge APIs are wired in, so the catalogue is real
          and ready without pretending it works yet. */}
      {showRecharge && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,12,35,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowRecharge(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 430, maxHeight: "72vh", display: "flex", flexDirection: "column", background: T.surface, borderRadius: "26px 26px 0 0", padding: "26px 22px 34px", boxShadow: T.shadowFloat }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexShrink: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FlagEmoji flag={dialCountry.flag} width={28} height={21} radius={6} />
                <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Recharge</span>
              </span>
              <button
                onClick={() => setShowRecharge(false)}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={15} color={T.inkSoft} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 14px", flexShrink: 0 }}>
              Operators in {dialCountry.name} — unlocking soon
            </p>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", borderRadius: T.radiusMd, border: `1px solid ${T.line}` }}>
              {(TELECOMS_BY_COUNTRY[dialCountry.iso] || []).length === 0 ? (
                <div style={{ padding: "22px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Coming soon</div>
                  <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 3 }}>
                    Operators for {dialCountry.name} aren&apos;t listed yet.
                  </div>
                </div>
              ) : (
                TELECOMS_BY_COUNTRY[dialCountry.iso].map((name, i) => (
                  <button
                    key={name}
                    onClick={() => showToast("Locked until live APIs connect")}
                    aria-label={`${name} — locked`}
                    className="v2-row"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 15px",
                      border: "none",
                      borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                        background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 800, color: T.accent,
                      }}
                    >
                      {name.replace(/\(.*\)/, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </span>
                    <ServiceLock />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Electricity sheet — same locked-catalogue pattern as Recharge:
          the person's own country's electricity operators are listed and
          real, but every row is locked (red) until live utility-payment
          APIs are connected. */}
      {showElectricity && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,12,35,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowElectricity(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 430, maxHeight: "72vh", display: "flex", flexDirection: "column", background: T.surface, borderRadius: "26px 26px 0 0", padding: "26px 22px 34px", boxShadow: T.shadowFloat }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexShrink: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FlagEmoji flag={dialCountry.flag} width={28} height={21} radius={6} />
                <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Electricity</span>
              </span>
              <button
                onClick={() => setShowElectricity(false)}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={15} color={T.inkSoft} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 14px", flexShrink: 0 }}>
              Operators in {dialCountry.name} — unlocking soon
            </p>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", borderRadius: T.radiusMd, border: `1px solid ${T.line}` }}>
              {(ELECTRICITY_BY_COUNTRY[dialCountry.iso] || []).length === 0 ? (
                <div style={{ padding: "22px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Coming soon</div>
                  <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 3 }}>
                    Operators for {dialCountry.name} aren&apos;t listed yet.
                  </div>
                </div>
              ) : (
                ELECTRICITY_BY_COUNTRY[dialCountry.iso].map((name, i) => (
                  <button
                    key={name}
                    onClick={() => showToast("Locked until live APIs connect")}
                    aria-label={`${name} — locked`}
                    className="v2-row"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 15px",
                      border: "none",
                      borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                        background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 800, color: T.accent,
                      }}
                    >
                      {name.replace(/\(.*\)/, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </span>
                    <ServiceLock />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* More — search bar up top, one scrollable list below: Recharge /
          Electricity / Rent pinned first (reusing their own Bills
          buttons' handlers), then Travel as an icon group, then the top
          10 businesses. Full-screen like Add Bank / Coverage rather than
          a bottom sheet, since the list can run long once search is in
          play. */}
      {showMore && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
            <button
              onClick={() => { setShowMore(false); setMoreQuery(""); setTravelExpanded(false); }}
              aria-label="Back"
              className="v2-tap"
              style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <ArrowLeft size={18} color={T.ink} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Pay & Services</span>
          </div>

          <div style={{ padding: "0 18px 10px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radiusMd, padding: "12px 14px", boxShadow: T.shadowCard }}>
              <Search size={16} color={T.inkFaint} />
              <input
                value={moreQuery}
                onChange={(e) => setMoreQuery(e.target.value)}
                placeholder="Search businesses & services"
                style={{ flex: 1, border: "none", outline: "none", background: "none", fontSize: 13.5, color: T.ink, fontFamily: "inherit" }}
              />
              {moreQuery && (
                <button onClick={() => setMoreQuery("")} aria-label="Clear search" style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex" }}>
                  <X size={14} color={T.inkFaint} />
                </button>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 18px 30px", display: "flex", flexDirection: "column", gap: 18 }}>
            {(() => {
              const q = moreQuery.trim().toLowerCase();
              const pinned = [
                { key: "recharge", label: "Recharge", Icon: Smartphone, onClick: () => { setShowMore(false); setShowRecharge(true); } },
                { key: "electricity", label: "Electricity", Icon: Zap, onClick: () => { setShowMore(false); setShowElectricity(true); } },
                { key: "rent", label: "Rent", Icon: Home, onClick: () => { setShowMore(false); setShowRentChoice(true); } },
              ].filter((a) => !q || a.label.toLowerCase().includes(q));
              const businesses = TOP_BUSINESSES.filter((b) => !q || b.label.toLowerCase().includes(q));
              const travelMatches = TRAVEL_ACTIONS.filter((t) => t.label.toLowerCase().includes(q));
              const showTravelSection = !q || travelMatches.length > 0;

              return (
                <>
                  {pinned.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "2px 2px 8px" }}>
                        Quick pay
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        {pinned.map(({ key, label, Icon, onClick }) => (
                          <button
                            key={key}
                            onClick={onClick}
                            aria-label={label}
                            className="v2-tap"
                            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 4px", border: `1px solid ${T.line}`, background: T.surface, borderRadius: 16, cursor: "pointer", boxShadow: T.shadowCard }}
                          >
                            <span style={{ width: 38, height: 38, borderRadius: 12, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Icon size={18} color={T.accent} />
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: T.ink }}>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showTravelSection && (
                    <div>
                      <button
                        onClick={() => setTravelExpanded((v) => !v)}
                        className="v2-tap"
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", background: "none", padding: "2px 2px 8px", cursor: "pointer" }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 }}>Travel</span>
                        {travelExpanded || q ? <ChevronUp size={15} color={T.inkFaint} /> : <ChevronDown size={15} color={T.inkFaint} />}
                      </button>
                      {(travelExpanded || q) && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                          {(q ? travelMatches : TRAVEL_ACTIONS).map(({ key, label, Icon }) => (
                            <button
                              key={key}
                              onClick={() => { setShowMore(false); setPayTarget({ label, chip: null, Icon }); setPayAmount("25.00"); setPayTargetMethod(null); }}
                              aria-label={label}
                              className="v2-tap"
                              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 4px", border: `1px solid ${T.line}`, background: T.surface, borderRadius: 16, cursor: "pointer", boxShadow: T.shadowCard }}
                            >
                              <span style={{ width: 38, height: 38, borderRadius: 12, background: T.positiveSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Icon size={18} color={T.positive} />
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: T.ink, textAlign: "center" }}>{label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "2px 2px 8px" }}>
                      Top businesses
                    </div>
                    <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
                      {businesses.length === 0 ? (
                        <div style={{ padding: "22px 18px", textAlign: "center" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>No matches</div>
                          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 3 }}>Try a different search.</div>
                        </div>
                      ) : (
                        businesses.map((b, i) => (
                          <button
                            key={b.key}
                            onClick={() => { setShowMore(false); setPayTarget({ label: b.label, chip: b.chip, Icon: null }); setPayAmount("25.00"); setPayTargetMethod(null); }}
                            aria-label={`Pay ${b.label}`}
                            className="v2-row"
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", border: "none", borderTop: i === 0 ? "none" : `1px solid ${T.line}`, background: "none", cursor: "pointer", textAlign: "left" }}
                          >
                            <span style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: T.accent }}>
                              {b.chip}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {b.label}
                            </span>
                            <ChevronRightIcon />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Generic Pay sheet — opened from a business or Travel option in
          More. Deliberately minimal: same functional core as Send Money
          (amount in, confirm, done) without the receiver search, since
          the "receiver" here is a fixed business rather than a person. */}
      {payTarget && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 320, background: "rgba(15,12,35,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setPayTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 430, background: T.surface, borderRadius: "26px 26px 0 0", padding: "26px 22px 34px", boxShadow: T.shadowFloat }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 11, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: T.accent }}>
                  {payTarget.Icon ? <payTarget.Icon size={17} color={T.accent} /> : payTarget.chip}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Pay {payTarget.label}</span>
              </span>
              <button
                onClick={() => setPayTarget(null)}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={15} color={T.inkSoft} />
              </button>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>Amount</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: T.radiusMd, padding: "12px 14px", marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{ccy}</span>
              <input
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                style={{ flex: 1, border: "none", outline: "none", background: "none", fontSize: 18, fontWeight: 800, color: T.ink, fontFamily: "inherit" }}
              />
            </div>

            <button
              onClick={() => { setPayTargetMethod(null); setPayTargetMethodOpen(true); }}
              className="v2-tap"
              style={{ width: "100%", border: "none", borderRadius: T.radiusMd, padding: "15px 0", color: "#fff", fontSize: 14, fontWeight: 800, background: T.gradButton, boxShadow: "0 8px 20px rgba(124,58,237,0.32)", cursor: "pointer" }}
            >
              Pay
            </button>
          </div>
        </div>
      )}

      {/* Funding source — the same four "Pay with" options Send Money
          uses (Gloobal Bank / Gloobal PayLater / Gloobal Coin / Local
          Banks), so every pay action in the app leads with the same
          choice instead of some paths skipping straight to confirm. */}
      {payTargetMethodOpen && payTarget && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 330, background: "rgba(15,12,35,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setPayTargetMethodOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 430, background: T.surface, borderRadius: "26px 26px 0 0", padding: "26px 22px 34px", boxShadow: T.shadowFloat }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Pay with</span>
              <button
                onClick={() => setPayTargetMethodOpen(false)}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={15} color={T.inkSoft} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 14px" }}>
              {ccy}{(parseFloat(payAmount) || 0).toFixed(2)} to {payTarget.label}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
              {[
                { key: "gbank", label: "Gloobal Bank" },
                { key: "gpaylater", label: "Gloobal PayLater" },
                { key: "gcoin", label: "Gloobal Coin" },
                { key: "local", label: "Local Banks" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    const amt = parseFloat(payAmount) || 0;
                    setPayTargetMethod(label);
                    setPayTargetMethodOpen(false);
                    setPayTarget(null);
                    showToast(`Paid ${ccy}${amt.toFixed(2)} to ${payTarget.label} · via ${label}`);
                  }}
                  className="v2-tap"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    border: "1px solid #ECECF3",
                    background: "#fff",
                    borderRadius: 16,
                    padding: "12px 14px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 13,
                      flexShrink: 0,
                      background: key === "gbank" ? "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)" : "#F1EDFB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {key === "gbank" ? (
                      <img src={globalIdLogo} alt="" style={{ width: 26, height: 26, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                    ) : key === "gpaylater" ? (
                      <CreditCard size={19} color="#7C3AED" />
                    ) : key === "gcoin" ? (
                      <Coins size={19} color="#7C3AED" />
                    ) : (
                      <Landmark size={19} color="#7C3AED" />
                    )}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: "#14122B" }}>{label}</span>
                  <ChevronRight size={17} color="#B9B3CC" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showReceive && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,12,35,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowReceive(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 430, background: T.surface, borderRadius: "26px 26px 0 0", padding: "26px 22px 34px", boxShadow: T.shadowFloat }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Receive</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => setShowReceiveHistory(true)}
                  aria-label="Receive money history"
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <History size={15} color={T.inkSoft} />
                </button>
                <button
                  onClick={() => setShowReceive(false)}
                  aria-label="Close"
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <X size={15} color={T.inkSoft} />
                </button>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 14px" }}>Share this Gloobal ID to receive money</p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                background: T.surfaceAlt,
                border: `1px solid ${T.line}`,
                borderRadius: T.radiusMd,
                padding: "14px 16px",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <FlagEmoji flag={dialCountry.flag} width={30} height={23} radius={6} />
                <span style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: T.fontDisplay, letterSpacing: 0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {gloobalIdTag}
                </span>
              </span>
              <button
                onClick={() => {
                  try {
                    navigator?.clipboard?.writeText(gloobalIdTag);
                  } catch {
        // best-effort only — ignore
      }
                  showToast("Copied");
                }}
                aria-label="Copy Gloobal ID"
                style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              >
                <Copy size={15} color={T.accent} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive money history — opened from the History icon on the
          Receive sheet above. Same bottom-sheet shell, its own scrollable
          list so it stacks over Receive without replacing it. */}
      {showReceiveHistory && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 61, background: "rgba(15,12,35,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowReceiveHistory(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 430, maxHeight: "72vh", display: "flex", flexDirection: "column", background: T.surface, borderRadius: "26px 26px 0 0", padding: "26px 22px 34px", boxShadow: T.shadowFloat }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Receive History</span>
              <button
                onClick={() => setShowReceiveHistory(false)}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={15} color={T.inkSoft} />
              </button>
            </div>
            <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", borderRadius: T.radiusLg, background: T.surfaceAlt, border: `1px solid ${T.line}` }}>
              {receivedRows.length === 0 && (
                <div style={{ padding: "22px 0", textAlign: "center", fontSize: 12, color: T.inkFaint }}>
                  Nothing received yet
                </div>
              )}
              {receivedRows.map((t, i) => (
                <div
                  key={`${t.name}-${t.date}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i === 0 ? "none" : `1px solid ${T.line}` }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{t.flag}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                    <span style={{ display: "block", fontSize: 11, color: T.inkFaint, marginTop: 1 }}>{t.date}</span>
                  </span>
                  <span style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: T.positive }}>+{ccy}{t.amount.toFixed(2)}</span>
                    <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: T.positive, marginTop: 1 }}>Received</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RENT — tapping the Bills row's Rent action opens this choice
          first: Send Rent reuses the exact same flow as the main Send
          action (onOpenSend → SendMoneyScreen); Accept Rent opens the QR
          + Gloobal ID sheet below instead, since collecting rent is a
          receiving action, not a sending one. */}
      {showRentChoice && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,12,35,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowRentChoice(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 430, background: T.surface, borderRadius: "26px 26px 0 0", padding: "26px 22px 34px", boxShadow: T.shadowFloat }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Rent</span>
              <button
                onClick={() => setShowRentChoice(false)}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={15} color={T.inkSoft} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 16px" }}>Paying rent, or collecting it?</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => {
                  setShowRentChoice(false);
                  onOpenSend();
                }}
                aria-label="Pay Rent"
                className="v2-tap"
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  padding: "20px 14px",
                  border: `1px solid ${T.line}`,
                  background: T.surfaceAlt,
                  borderRadius: T.radiusLg,
                  cursor: "pointer",
                }}
              >
                <span style={{ width: 42, height: 42, borderRadius: 14, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ArrowUp size={19} color={T.accent} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Pay Rent</span>
                <span style={{ fontSize: 10.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.4 }}>Pay your landlord</span>
              </button>
              <button
                onClick={() => {
                  setShowRentChoice(false);
                  setShowRentReceive(true);
                }}
                aria-label="Accept Rent"
                className="v2-tap"
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  padding: "20px 14px",
                  border: `1px solid ${T.line}`,
                  background: T.surfaceAlt,
                  borderRadius: T.radiusLg,
                  cursor: "pointer",
                }}
              >
                <span style={{ width: 42, height: 42, borderRadius: 14, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ArrowDown size={19} color={T.accent} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Accept Rent</span>
                <span style={{ fontSize: 10.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.4 }}>Collect from a tenant</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCEPT RENT — the receiving side: a scannable QR plus the same
          Gloobal ID as text, with its own copy and share icons so a
          landlord can hand either the code or the ID itself to a tenant. */}
      {showRentReceive && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,12,35,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowRentReceive(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 430, background: T.surface, borderRadius: "26px 26px 0 0", padding: "26px 22px 34px", boxShadow: T.shadowFloat }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Accept Rent</span>
              <button
                onClick={() => setShowRentReceive(false)}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={15} color={T.inkSoft} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 16px" }}>Have your tenant scan this, or share your Gloobal ID directly</p>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
              <div style={{ padding: 14, borderRadius: 16, background: T.surfaceAlt, border: `1px solid ${T.line}` }}>
                <MockQRCode value={gloobalIdTag} />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                background: T.surfaceAlt,
                border: `1px solid ${T.line}`,
                borderRadius: T.radiusMd,
                padding: "14px 16px",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <FlagEmoji flag={dialCountry.flag} width={30} height={23} radius={6} />
                <span style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: T.fontDisplay, letterSpacing: 0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {gloobalIdTag}
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => {
                    try {
                      navigator?.clipboard?.writeText(gloobalIdTag);
                    } catch {
        // best-effort only — ignore
      }
                    showToast("Copied");
                  }}
                  aria-label="Copy Gloobal ID"
                  style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <Copy size={15} color={T.accent} />
                </button>
                <button
                  onClick={handleShareGloobalId}
                  aria-label="Share Gloobal ID"
                  style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <Share2 size={15} color={T.accent} />
                </button>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Profile settings sheet — one overlay for all the basic options.
          Prototype-stage functionality: toggles toggle, selections select,
          Paid/Received reuse the real Send/Receive flows. */}
      {/* PayLater — balance, pending dues, and history. Prototype ledger:
          all figures derive from one history array so nothing can drift. */}
      {showPayLater && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
            <button
              onClick={() => setShowPayLater(false)}
              aria-label="Back"
              className="v2-tap"
              style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <ArrowLeft size={18} color={T.ink} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Gloobal Pay · PayLater</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 18px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Balance */}
            <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "20px 18px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>Available PayLater balance</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.accent, fontFamily: T.fontDisplay, marginTop: 4 }}>
                {ccy}{paylaterAvailable.toFixed(2)}
              </div>
              <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>of {ccy}{PAYLATER_LIMIT.toFixed(2)} limit</div>
              <div style={{ height: 6, borderRadius: 999, background: T.surfaceAlt, marginTop: 12, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(100, (paylaterAvailable / PAYLATER_LIMIT) * 100)}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: T.gradButton,
                  }}
                />
              </div>
            </div>

            {/* Pending dues */}
            <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>Pending dues</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: paylaterDue > 0 ? T.negative : T.positive, fontFamily: T.fontDisplay, marginTop: 3 }}>
                    {ccy}{paylaterDue.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>
                    {paylaterDue > 0 ? "Due Aug 1" : "Nothing due — all clear"}
                  </div>
                </span>
                {paylaterDue > 0 && (
                  <button
                    onClick={() => showToast("Payments unlock with live APIs")}
                    className="v2-tap"
                    style={{
                      border: "none",
                      borderRadius: 999,
                      padding: "10px 20px",
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: "#fff",
                      background: T.gradButton,
                      boxShadow: "0 6px 16px rgba(124,58,237,0.3)",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Pay now
                  </button>
                )}
              </div>
            </div>

            {/* History — split into the two directions of the ledger. */}
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "4px 2px 8px" }}>
                Received
              </div>
              <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
                {paylaterReceiving.map((t, i) => (
                  <div
                    key={`${t.name}-${t.date}`}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i === 0 ? "none" : `1px solid ${T.line}` }}
                  >
                    <span
                      style={{
                        width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                        background: T.positiveSoft, display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <ArrowDownLeft size={17} color={T.positive} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                      <span style={{ display: "block", fontSize: 11, color: T.inkFaint, marginTop: 1 }}>{t.date}</span>
                    </span>
                    <span style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: T.positive }}>+{ccy}{t.amount.toFixed(2)}</span>
                      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: T.positive, marginTop: 1 }}>Received</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "4px 2px 8px" }}>
                Paid
              </div>
              <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
                {paylaterSending.map((t, i) => (
                  <div
                    key={`${t.name}-${t.date}`}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i === 0 ? "none" : `1px solid ${T.line}` }}
                  >
                    <span
                      style={{
                        width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                        background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <ArrowUpRight size={17} color={T.accent} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                      <span style={{ display: "block", fontSize: 11, color: T.inkFaint, marginTop: 1 }}>{t.date}</span>
                    </span>
                    <span style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: T.ink }}>−{ccy}{t.amount.toFixed(2)}</span>
                      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: t.status === "paid" ? T.positive : T.negative, marginTop: 1 }}>
                        {t.status === "paid" ? "Paid" : "Pending"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Toast echo — this overlay (z 300) covers the dashboard's own
              toast (z 50). */}
          {toast && (
            <div
              style={{
                position: "fixed",
                bottom: 40,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 310,
                background: T.ink,
                color: "#fff",
                padding: "11px 18px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 700,
                boxShadow: "0 10px 24px rgba(20,18,43,0.3)",
                whiteSpace: "nowrap",
              }}
            >
              {toast}
            </div>
          )}
        </div>
      )}

      {profileDetail && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
            <button
              onClick={() => setProfileDetail(null)}
              aria-label="Back"
              className="v2-tap"
              style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <ArrowLeft size={18} color={T.ink} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>{profileDetail}</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "6px 18px 30px" }}>
            {profileDetail === "Personal Details" && (
              <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
                {/* Name row doubles as a flip control — tapping it cycles
                    the same four identity faces used elsewhere in the app
                    (name → Gloobal ID → mobile number → country name),
                    via the shared IDENTITY_DISPLAY_ORDER/identityDisplayValue
                    helpers, instead of listing every field as a flat row. */}
                <button
                  onClick={() => setPersonalDisplayMode((m) => nextIdentityMode(m))}
                  className="v2-row"
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 18px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.inkSoft }}>
                    {IDENTITY_DISPLAY_LABEL[personalDisplayMode][0].toUpperCase() + IDENTITY_DISPLAY_LABEL[personalDisplayMode].slice(1)}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {identityDisplayValue(
                        {
                          name: fullName || "Gloobal ID Member",
                          id: myGloobalId || "—",
                          phone: `${dialCountry.dialCode} ${phoneNumber || "•••• •• ••"}`,
                          country: dialCountry.name,
                        },
                        personalDisplayMode
                      )}
                    </span>
                    <RotateCw size={13} color={T.inkFaint} />
                  </span>
                </button>
                {[
                  ["Dial code", dialCountry.dialCode],
                  ["Member since", "2026"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 18px", borderTop: `1px solid ${T.line}` }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.inkSoft }}>{k}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {profileDetail === "Paid" && (
              <ProfileMoneySection
                rows={filterMoneyRows(sentRows, paidFilter)}
                filter={paidFilter}
                onFilterChange={setPaidFilter}
                color={T.accent}
                chip={T.accentSoft}
                sign="−"
                ccy={ccy}
                ctaLabel="Send Money"
                onCta={() => { setProfileDetail(null); onOpenSend(); }}
              />
            )}

            {profileDetail === "Received" && (
              <ProfileMoneySection
                rows={filterMoneyRows(receivedRows, receivedFilter)}
                filter={receivedFilter}
                onFilterChange={setReceivedFilter}
                color={T.positive}
                chip={T.positiveSoft}
                sign="+"
                ccy={ccy}
                ctaLabel="Receive Money"
                onCta={() => { setProfileDetail(null); setShowReceive(true); }}
              />
            )}

            {profileDetail === "Subscriptions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Autopay itself is locked too, same as every row below —
                    nothing on this screen is wired to live billing yet. */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "16px 18px" }}>
                  <span>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>Autopay</div>
                    <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>
                      Locked until live billing is connected
                    </div>
                  </span>
                  <button
                    onClick={() => showToast("Locked until live APIs connect")}
                    aria-label="Autopay — locked"
                    className="v2-tap"
                    style={{ border: "none", background: "none", padding: 4, cursor: "pointer", display: "flex" }}
                  >
                    <ServiceLock size={18} />
                  </button>
                </div>

                {/* Search over the full worldwide catalogue — streaming,
                    music, gaming, cloud, news, wellness, delivery, and
                    security brands from the US/EU through India, China,
                    Japan, and Korea. */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radiusMd, padding: "12px 14px", boxShadow: T.shadowCard }}>
                  <Search size={16} color={T.inkFaint} />
                  <input
                    value={subscriptionQuery}
                    onChange={(e) => setSubscriptionQuery(e.target.value)}
                    placeholder="Search subscriptions worldwide"
                    style={{ flex: 1, border: "none", outline: "none", background: "none", fontSize: 13.5, color: T.ink, fontFamily: "inherit" }}
                  />
                  {subscriptionQuery && (
                    <button onClick={() => setSubscriptionQuery("")} aria-label="Clear search" style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex" }}>
                      <X size={14} color={T.inkFaint} />
                    </button>
                  )}
                </div>

                <div>
                  {(() => {
                    const q = subscriptionQuery.trim().toLowerCase();
                    const filtered = q
                      ? SUBSCRIPTION_TOOLS.filter((s) => s.label.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
                      : SUBSCRIPTION_TOOLS;
                    return (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "2px 2px 8px" }}>
                          {q ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}` : `All subscriptions · ${filtered.length}`}
                        </div>
                        <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
                          {filtered.length === 0 ? (
                            <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: T.inkFaint }}>No matches</div>
                          ) : (
                            filtered.map((s, i) => (
                              <button
                                key={s.key}
                                onClick={() => showToast("Locked until live APIs connect")}
                                aria-label={`${s.label} — locked`}
                                className="v2-row"
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  padding: "13px 15px",
                                  border: "none",
                                  borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
                                  background: "none",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <span style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: T.inkFaint }}>
                                  {s.chip}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                                  <span style={{ display: "block", fontSize: 11, color: T.inkFaint, marginTop: 1 }}>
                                    {ccy}{s.price.toFixed(2)}/mo · {s.category}
                                  </span>
                                </span>
                                <ServiceLock />
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {profileDetail === "Language" && (
              <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
                {PROFILE_LANGUAGES.map((lang, i) => (
                  <button
                    key={lang}
                    onClick={() => setProfileLanguage(lang)}
                    className="v2-row"
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", border: "none", borderTop: i === 0 ? "none" : `1px solid ${T.line}`, background: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: profileLanguage === lang ? 800 : 600, color: profileLanguage === lang ? T.accent : T.ink }}>{lang}</span>
                    {profileLanguage === lang && <Check size={17} color={T.accent} />}
                  </button>
                ))}
              </div>
            )}

            {profileDetail === "Currency" && (
              <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
                {PROFILE_CURRENCIES.map((code, i) => (
                  <button
                    key={code}
                    onClick={() => setProfileCurrency(code)}
                    className="v2-row"
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", border: "none", borderTop: i === 0 ? "none" : `1px solid ${T.line}`, background: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13.5, fontWeight: profileCurrency === code ? 800 : 600, color: profileCurrency === code ? T.accent : T.ink }}>{code}</span>
                      {CURRENCIES[code] && <span style={{ fontSize: 13 }}>{CURRENCIES[code].flag}</span>}
                    </span>
                    {profileCurrency === code && <Check size={17} color={T.accent} />}
                  </button>
                ))}
              </div>
            )}

            {profileDetail === "Security" && (
              <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 18px" }}>
                  <span>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>Biometric login</div>
                    <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>Use Face ID or fingerprint to log in</div>
                  </span>
                  <ProfileToggle on={profileToggles.biometric} onToggle={() => flipToggle("biometric")} label="Biometric login" />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 18px", borderTop: `1px solid ${T.line}` }}>
                  <span>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>App lock</div>
                    <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>Ask for your PIN every time the app opens</div>
                  </span>
                  <ProfileToggle on={profileToggles.appLock} onToggle={() => flipToggle("appLock")} label="App lock" />
                </div>
                <button
                  onClick={() => showToast("PIN change will be available soon")}
                  className="v2-row"
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", border: "none", borderTop: `1px solid ${T.line}`, background: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>Change PIN</span>
                  <ChevronRightIcon />
                </button>
              </div>
            )}

            {profileDetail === "Notifications" && (
              <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
                {[
                  ["txAlerts", "Transaction alerts", "Money sent, received, and requests"],
                  ["referralAlerts", "Referral earnings", "When your network earns you a share"],
                  ["promos", "Offers & promotions", "Occasional deals from Gloobal ID"],
                ].map(([key, title, sub], i) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 18px", borderTop: i === 0 ? "none" : `1px solid ${T.line}` }}>
                    <span>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{title}</div>
                      <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>{sub}</div>
                    </span>
                    <ProfileToggle on={profileToggles[key]} onToggle={() => flipToggle(key)} label={title} />
                  </div>
                ))}
              </div>
            )}

            {profileDetail === "Help & Support" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
                  {["How do I send money?", "How do referrals work?", "Which countries are supported?"].map((q, i) => (
                    <button
                      key={q}
                      onClick={() => showToast("Full help center coming soon")}
                      className="v2-row"
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", border: "none", borderTop: i === 0 ? "none" : `1px solid ${T.line}`, background: "none", cursor: "pointer", textAlign: "left" }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{q}</span>
                      <ChevronRightIcon />
                    </button>
                  ))}
                </div>
                <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "16px 18px" }}>
                  <div style={{ fontSize: 12, color: T.inkFaint }}>Need more help?</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.accent, marginTop: 2 }}>support@gloobal.id</div>
                </div>
              </div>
            )}

            {profileDetail === "About" && (
              <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.inkSoft }}>Version</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>1.0.0 (prototype)</span>
                </div>
                {["Terms of Service", "Privacy Policy"].map((label) => (
                  <button
                    key={label}
                    onClick={() => showToast(`${label} coming soon`)}
                    className="v2-row"
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", border: "none", borderTop: `1px solid ${T.line}`, background: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{label}</span>
                    <ChevronRightIcon />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* The sheet sits above the dashboard's own toast (z 50 vs this
              sheet's 300), so the toast is echoed here for actions
              triggered from inside the sheet. */}
          {toast && (
            <div
              style={{
                position: "fixed",
                bottom: 40,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 310,
                background: T.ink,
                color: "#fff",
                padding: "11px 18px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 700,
                boxShadow: "0 10px 24px rgba(20,18,43,0.3)",
                whiteSpace: "nowrap",
              }}
            >
              {toast}
            </div>
          )}
        </div>
      )}

      {profileOverlay === "share" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <SendMoneyAmbientBg />
          </div>

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <button
                onClick={() => setProfileOverlay(null)}
                aria-label="Back"
                className="v2-tap"
                style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              >
                <ArrowLeft size={18} color={T.ink} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Share your Gloobal ID</span>
            </div>

            {/* User/Merchant flip — lives on the header row now, opposite
                the back button, instead of floating on the ID card's top
                edge: navigation on one side, the flip sign on the other. */}
            <button
              onClick={toggleShareRole}
              aria-label={shareRole === "user" ? "Switch to Creators profile" : "Switch to User profile"}
              className="v2-tap"
              style={{
                flexShrink: 0,
                transform: `rotateY(${roleFlipping ? 90 : 0}deg)`,
                transition: "transform 0.18s ease",
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 40, height: 40, borderRadius: "50%",
                border: "none",
                background: shareRole === "merchant" ? "#FEF3E2" : T.accentSoft,
                boxShadow: T.shadowCard,
                cursor: "pointer",
              }}
            >
              {shareRole === "merchant" ? <Store size={17} color="#F59E0B" /> : <User size={17} color={T.accent} />}
            </button>
          </div>

          <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "6px 18px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 360,
                minHeight: 220,
                background: T.surface,
                borderRadius: T.radiusLg,
                boxShadow: T.shadowCard,
                padding: 22,
              }}
            >
              <div style={{ position: "absolute", top: 22, left: 22 }}>
                <FlagEmoji flag={dialCountry.flag} width={60} height={44} radius={14} dropShadow="drop-shadow(0 4px 10px rgba(76,29,149,0.20))" />
              </div>

              <span
                style={{
                  position: "absolute", top: 22, right: 22,
                  width: 50, height: 50, borderRadius: "50%",
                  overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 10px rgba(76,29,149,0.16)", flexShrink: 0,
                }}
              >
                <img
                  src={`https://i.pravatar.cc/150?img=${avatarSeed}`}
                  alt="Profile"
                  width={50}
                  height={50}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </span>

              <div
                style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                  display: "flex", alignItems: "center", gap: 2, whiteSpace: "nowrap",
                }}
              >
                {shareableGloobalId.split("").map((ch, i) => (
                  <React.Fragment key={i}>
                    <span
                      style={{
                        fontSize: 20, fontWeight: 800, letterSpacing: 0.5, fontFamily: T.fontDisplay,
                        color: POSITION_COLORS[i % POSITION_COLORS.length],
                      }}
                    >
                      {ch}
                    </span>
                    {(i + 1) % 4 === 0 && i !== shareableGloobalId.length - 1 && <span style={{ width: 8 }} />}
                  </React.Fragment>
                ))}
              </div>

              <button
                onClick={handleCopyReferralLink}
                aria-label="Copy"
                className="v2-tap"
                style={{ position: "absolute", bottom: 22, left: 22, border: "none", background: "none", padding: 4, cursor: "pointer", display: "flex" }}
              >
                <Copy size={22} color={T.accent} />
              </button>

              <button
                onClick={handleShareReferralLink}
                aria-label="Share"
                className="v2-tap"
                style={{ position: "absolute", bottom: 22, right: 22, border: "none", background: "none", padding: 4, cursor: "pointer", display: "flex" }}
              >
                <Share2 size={22} color={T.accent} />
              </button>
            </div>
          </div>

          {toast && (
            <div
              style={{
                position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", zIndex: 50,
                background: T.ink, color: "#fff", padding: "11px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                whiteSpace: "nowrap", boxShadow: T.shadowFloat,
              }}
            >
              {toast}
            </div>
          )}
        </div>
      )}

      {profileOverlay === "referral" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <SendMoneyAmbientBg />
          </div>

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
            <button
              onClick={() => setProfileOverlay(null)}
              aria-label="Back"
              className="v2-tap"
              style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <ArrowLeft size={18} color={T.ink} />
            </button>
          </div>

          <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "6px 18px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Earnings summary */}
            <div style={{ position: "relative", background: T.gradWallet, borderRadius: T.radiusLg, padding: "22px 22px 52px", display: "flex", flexDirection: "column", gap: 4, boxShadow: T.shadowRaised }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: 0.3, textTransform: "uppercase" }}>
                People you&apos;ve referred
              </span>
              {/* Counts come from the referral rows the backend actually
                  holds. There is no earnings ledger behind referrals yet,
                  so no money figure is claimed here. */}
              <span style={{ fontSize: 30, fontWeight: 800, color: "#fff", fontFamily: T.fontDisplay }}>
                {referrals.length}
              </span>
              <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>
                    {referrals.length || (typeof referralCount === "number" ? referralCount : 0)}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>Invited</div>
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>
                    {referrals.filter((r) => r.status === "completed").length}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>Completed</div>
                </div>
              </div>

              <button
                onClick={() => setProfileOverlay("share")}
                aria-label="Share your referral link"
                className="v2-tap"
                style={{
                  position: "absolute", bottom: 16, right: 20,
                  width: 40, height: 40, borderRadius: "50%", border: "none",
                  background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <Share2 size={18} color="#fff" />
              </button>
            </div>

            {/* How the network works */}
            <button
              onClick={() => setShowHowItWorks(true)}
              className="v2-tap"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", background: T.gradButton, borderRadius: T.radiusMd, padding: "14px 0", color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 20px rgba(124,58,237,0.32)" }}
            >
              <Info size={16} color="#fff" />
              How your network works
            </button>

            {/* Network list — the real referral rows, newest first (the
                backend already sorts by createdAt descending). Loading,
                empty, and error each get their own state rather than an
                indistinguishable blank card. */}
            {referralsLoading && (
              <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "28px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span
                  aria-label="Loading referrals"
                  role="status"
                  style={{
                    width: 26, height: 26, borderRadius: "50%",
                    border: `3px solid ${T.line}`, borderTopColor: T.accent,
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <span style={{ fontSize: 12.5, color: T.inkFaint, fontWeight: 600 }}>Loading your referrals…</span>
              </div>
            )}

            {!referralsLoading && referralsError && (
              <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "24px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, textAlign: "center" }}>{referralsError}</span>
                <button
                  onClick={() => setReferralsAttempt((n) => n + 1)}
                  className="v2-tap"
                  style={{
                    border: "none", background: T.gradButton, color: "#fff", borderRadius: T.radiusMd,
                    padding: "10px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer",
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {!referralsLoading && !referralsError && referrals.length === 0 && (
              <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "28px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Users2 size={22} color={T.inkFaint} />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, textAlign: "center" }}>
                  No referrals yet. Share your Gloobal ID to invite friends.
                </span>
              </div>
            )}

            {!referralsLoading && !referralsError && referrals.length > 0 && (
              <div style={{ borderRadius: T.radiusLg, background: T.surface, overflow: "hidden", boxShadow: T.shadowCard }}>
                {referrals.map((r, i) => (
                  <div
                    key={`${r.referredSymbolId}-${r.createdAt}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
                      borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
                    }}
                  >
                    <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <User size={18} color={T.accent} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, letterSpacing: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.referredSymbolId}
                      </div>
                      <div style={{ fontSize: 11, color: T.inkFaint, fontWeight: 600, marginTop: 2 }}>
                        {formatJoinedDate(r.createdAt)}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: r.status === "completed" ? T.positive : T.inkFaint, textTransform: "capitalize" }}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {toast && (
            <div
              style={{
                position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", zIndex: 50,
                background: T.ink, color: "#fff", padding: "11px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                whiteSpace: "nowrap", boxShadow: T.shadowFloat,
              }}
            >
              {toast}
            </div>
          )}
        </div>
      )}

      {/* Explains how earning through the referral network works — opened
          from the option that replaced the old "Invite a friend" CTA. */}
      {showHowItWorks && (
        <div
          onClick={() => setShowHowItWorks(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 400, background: "rgba(20,12,36,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative", width: "100%", maxWidth: 340,
              background: T.surface, borderRadius: T.radiusLg, boxShadow: T.shadowFloat,
              padding: "28px 24px 24px", display: "flex", flexDirection: "column", gap: 18,
            }}
          >
            <button
              onClick={() => setShowHowItWorks(false)}
              aria-label="Close"
              className="v2-tap"
              style={{
                position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: "50%",
                border: "none", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <X size={16} color={T.inkFaint} />
            </button>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users2 size={24} color={T.accent} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>
                How your network works
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Share2 size={16} color={T.accent} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Share your link</div>
                  <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.4, marginTop: 2 }}>
                    Your Gloobal ID doubles as your invite link. Send it to friends and family.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Users2 size={16} color={T.accent} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>They join your network</div>
                  <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.4, marginTop: 2 }}>
                    Once they sign up and become active, they show up in your network list.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Gift size={16} color={T.accent} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>You earn together</div>
                  <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.4, marginTop: 2 }}>
                    Every time they send money, a share of the fee is added straight to your balance — tracked today and all-time for each person.
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHowItWorks(false)}
              className="v2-tap"
              style={{ border: "none", background: T.gradButton, borderRadius: T.radiusMd, padding: "13px 0", color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 20px rgba(124,58,237,0.32)" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Memoized: this screen is only ever (re)rendered while the "dashboard"
// stage is active, but its parent (App) re-renders periodically on its
// own (e.g. the background particle animation) — memoizing skips that
// work here whenever this screen's actual props haven't changed.
export const DashboardScreen = React.memo(DashboardScreenBase);
