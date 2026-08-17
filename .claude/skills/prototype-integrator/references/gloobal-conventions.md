# Gloobal conventions

What a prototype must be rewritten *into*. Verified against `Frontend/src` — if a detail here disagrees with the code, the code wins; fix this file.

## Design tokens

`Frontend/src/styles/theme.js` exports two objects. **Inline styles only — this project does not use Tailwind.**

`T` is the primary v2 token set:

| Group | Tokens |
|---|---|
| Surfaces | `bg` `surface` `surfaceAlt` `surfaceSunk` |
| Text | `ink` `inkSoft` `inkFaint` |
| Lines | `line` `lineSoft` |
| Accent | `accent` (`#7C3AED`) `accentDeep` `accent2` `accentSoft` |
| Gradients | `gradPrimary` `gradWallet` `gradButton` `gradButtonDisabled` |
| Status | `positive` `positiveSoft` `negative` `negativeSoft` |
| Radii | `radiusXl` 28, `radiusLg` 22, `radiusMd` 16, `radiusSm` 12 |
| Shadows | `shadowCard` `shadowRaised` `shadowFloat` |
| Type | `fontDisplay` (Space Grotesk) `fontBody` |

`C` is the older/map palette — includes `mapBg`, `mapLand`, `mapLandFaint` for the coverage map. Do not introduce new palettes; if a prototype needs a colour, map it to the nearest token.

Rewrite pattern:

```jsx
// prototype
<div className="flex items-center rounded-xl bg-purple-600 text-white p-4">

// real codebase
<div style={{ display: "flex", alignItems: "center", borderRadius: T.radiusLg,
              background: T.accent, color: "#fff", padding: 16 }}>
```

## Money

Never hardcode a currency symbol. `Frontend/src/constants/finance.js`:

- `symbolFor(currencyCode)` — `"INR"` → `"₹"`, falls back to `"$"`
- `symbolForCountry(iso)` — `"IN"` → `"₹"`; use when the screen knows the country, not the currency
- `convert(amount, from, to)` — fixed illustrative rates relative to EUR, **not live data**
- `fmt(n)` — 2dp `en-US` formatting
- `CURRENCIES` / `RATES` / `CURRENCY_SYMBOL` / `COUNTRY_CURRENCY`

Multi-letter symbols carry a deliberate trailing space (`"CHF "`, `"RM "`). Do not trim it.

`CORRECT_PIN = "1234"` in that file is demo-only. Never wire a prototype's PIN check to it — PIN verification is server-side via `/api/pin/verify`.

## API layer

Never call `fetch` directly. `Frontend/src/services/httpClient.js` exports `apiClient` (`.get/.post/.patch`) and `ApiError`; typed wrappers live in `services/api/`:

| File | Covers |
|---|---|
| `authApi.js` | OTP, register, PIN, login, profile, referrals, transactions, passkey |
| `assetsApi.js` | assets |
| `creatorApi.js` | creator |
| `faceApi.js` | face |

Base URL resolution:

```js
const RAW_API_BASE = import.meta.env.VITE_API_URL || "https://gloobal-pay.onrender.com";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "").replace(/\/api$/i, "");
```

Backend facts that shape client code:

- **No JWT, no session cookies, no auth middleware.** `symbolId` is passed explicitly in every call's body or query.
- Responses are read for their *actual* shape (`{ user }`, `{ verified }`, `{ transactions }`), never assumed.
- Render's free tier cold-starts for 20–50s. First-request calls (OTP send/verify, login, resolve) use `COLD_START_TIMEOUT_MS = 45_000` instead of the 15s default.
- `ApiError` with `status === 0` means *no response at all* (timeout/offline), not a rejected credential. Do not burn the client-side attempt counter on it — see `lib/rateLimiter.js` (`checkAndRecordAttempt` / `clearAttempts`).

Endpoints: `/api/otp/send` `/api/otp/verify` `/api/register-symbol` `/api/login` `/api/pin/set` `/api/pin/verify` `/api/profile/:symbolId` `/api/profile/change-symbol-id` `/api/users/resolve?identifier=` `/api/referrals/:symbolId` `/api/transactions/send` `/api/transactions/history/:symbolId` `/api/transactions/:symbolId` `/api/passkey/{status,register/options,register/verify,auth/options,auth/verify}`

## Navigation — the stage machine

`App.jsx` holds `const [stage, setStage] = useState(...)`. There is **no router**. Three paths:

```
registration:  phone → otp → secureId → referral → pin → deviceSetup → dashboard
login:         secureId → loginAuth (→ loginBiometric) → dashboard
restored:      reauth → dashboard
```

A restored session opens on `reauth` ("Verify it's you"), not straight to the dashboard — knowing *which* account is signed in is not proof it is still the same person holding the phone.

Wiring a prototype screen in: add a stage value, render it behind `{stage === "yourStage" && (...)}`, and reach it via `setStage`/`flipTo`. Do not add React Router.

## Components to reuse, not reimplement

`components/common/` — `DialPads` `CodeEntry` `FlagComponents` `Icons` `ExplainSheet` `GapPanels` `GlobeHero`
`components/auth/` — `PinScreen` `PinScreenShell` `FaceIdScreen` `LoginAuthScreen` `ReauthScreen` `CountryPickerScreen` `PhoneConnector` `CircularInButton`

If a prototype ships its own dial pad or flag picker, delete it and import the real one.

## Services

`services/session.js` (session persistence), `db.js`, `offlineQueue.js`, `faceEngine.js`, `registerServiceWorker.js`, `lib/lastLogin.js`, `lib/idSuggestions.js`, `lib/rateLimiter.js`.

Session state survives reload — a prototype that keeps auth state only in React state will "log out on refresh".

## Build

```
cd "D:\Gloobal project\Frontend"
npm install
npm run build
```

Must pass before anything is called done. There is a pre-existing lint baseline; the bar is *no new errors*, not zero errors.
