# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Paths

| | Path |
|---|---|
| Repo root | `C:\Users\Chanchal Sharma\Desktop\Gloobal` |
| Frontend | `C:\Users\Chanchal Sharma\Desktop\Gloobal\Frontend` |
| Backend | `C:\Users\Chanchal Sharma\Desktop\Gloobal\Backend` |
| Live frontend | https://gloobal.netlify.app |
| Live backend | https://gloobal-pay.onrender.com |

## Workflow Rules

- **Always use Windows PowerShell commands** (not bash/sh syntax).
- **Always check `git status` before editing any file.**
- **Always work on a branch** — never commit directly to `main`.
- **Always run `npm run build` in `Frontend/` before committing.**
- **Always run `git status`, `git diff --stat`, and `git diff --check` before committing.**
- **Never push without explicit user approval.**
- **Never run `npm audit fix` unless explicitly asked.**

## Current Priority

Integrate `globalid-pwa-hardened-v2.zip`, connect it to real Gloobal backend APIs, fix the logo, add Face/Fingerprint (WebAuthn passkey) verification after PIN, and wire up the real Dashboard after successful login/onboarding.

## Real Backend Endpoints (`https://gloobal-pay.onrender.com`)

```
POST /api/otp/send
POST /api/otp/verify
POST /api/register-symbol
POST /api/login
POST /api/pin/set
POST /api/pin/verify
GET  /api/profile/:symbolId
GET  /api/users/resolve?identifier=...
POST /api/transactions/send
GET  /api/transactions/history/:symbolId

POST /api/passkey/status
POST /api/passkey/register/options
POST /api/passkey/register/verify
POST /api/passkey/auth/options
POST /api/passkey/auth/verify
```

## Commands

### Frontend (React + Vite PWA)
```bash
cd Frontend
npm install          # install deps
npm run dev          # dev server at localhost:5173
npm run build        # production build to dist/
npm run lint         # ESLint
npm run preview      # preview production build
```

### Backend (Node.js + Express + MongoDB)
```bash
cd Backend
npm install          # install deps
node server.js       # start server on PORT (default 5000)
```

### Environment
Backend reads from `Backend/.env`:
- `MONGO_URI` — MongoDB Atlas connection string
- `PORT` — server port (default 5000)
- `PROTOTYPE_OTP` — fixed OTP for testing (default `123456`; must be 6 digits to match the frontend's OTP dial pad, which is locked to `OTP_LENGTH = 6`)
- `DEFAULT_LOGIN_PIN` — fallback PIN when none set (default `1234`)
- `PROTOTYPE_TRANSACTION_MAX_AMOUNT` — max send amount (default 5000)

Frontend reads from env:
- `VITE_API_URL` — backend URL (defaults to `https://gloobal-pay.onrender.com`)

## Architecture

**Gloobal** is a UPI-style fintech prototype: mobile-first React PWA frontend + Express REST API backend backed by MongoDB Atlas. No real money moves — all transactions are prototype records.

### Monorepo layout
```
Frontend/   — React 19 + Vite PWA, deployed to Netlify
Backend/    — Express 5 + Mongoose, deployed to Render
docs/       — architecture and schema references
```

### Frontend structure
All UI lives in `Frontend/src/`. No routing library — `App.jsx` manually manages page state via `currentPage` string + `localStorage` session (`gloobal.session.v1`).

Key screens:
- **`GlobalId.jsx`** — the entire registration/onboarding + dashboard mega-component (~5200 lines). Contains: country picker, phone OTP flow, 12-symbol Secure ID dial pad, PIN setup, send money, transaction history, global bank, global coverage, profile, settings. This is the active component — `App.jsx` currently renders only `<GlobalId />`.
- **`Dashboard.jsx`** — earlier UPI dashboard (may be superseded by GlobalId's built-in dashboard)
- **`GloobalAccess.jsx`**, **`GloobalAuth.jsx`**, **`GloobalRegistration.jsx`**, **`DeviceAuth.jsx`** — earlier individual auth screens (superseded by GlobalId flow)

The design token system lives at the top of `GlobalId.jsx` as `const T = { ... }` — a single object with all colors, gradients, radius, shadow, and font values. Every component in that file references `T.*` instead of raw values.

### Backend structure
All backend logic is in a single `Backend/server.js` file (~1540 lines). No router splitting yet.

API groups:
| Prefix | Purpose |
|--------|---------|
| `/api/otp/send`, `/api/otp/verify` | Prototype OTP (fixed `0000`) |
| `/api/register-symbol` | Registration — OTP-gated, 12-symbol Secure ID |
| `/api/login` | PIN login |
| `/api/pin/set`, `/api/pin/verify`, `/api/pin/reset` | PIN management |
| `/api/profile/:symbolId` (GET/PUT) | Profile read/update |
| `/api/passkey/*` | WebAuthn device auth via `@simplewebauthn/server` |
| `/api/users/resolve` | Lookup user by symbolId or mobile |
| `/api/transactions/send` | Prototype money send (PIN-verified, idempotency key) |
| `/api/transactions/history/:symbolId` | Transaction history |

### MongoDB models (`Backend/models/`)
- **`User`** — `symbolId` (12-char, unique), `mobileNumber` (+91 normalized), `fullName`, `email`, `passkeys[]`, `referredBy`, `referralChain`, `referralCount`, `currentChallenge`
- **`Otp`** — `mobileNumber`, `otpHash` (bcrypt), `purpose` (registration/login/pin_reset/mobile_change), `attempts`, `maxAttempts`, `expiresAt`, `verifiedAt`, `consumedAt`
- **`Pin`** — `userId`, `pinHash` (bcrypt), `failedAttempts`, `lockedUntil` (10 min after 5 bad attempts), `lastVerifiedAt`, `changedAt`
- **`Transaction`** — `fromUserId`, `toUserId`, `amount`, `currency`, `type`, `status` (pending→success/failed), `referenceId` (`GLOOBAL-TXN-…`), `metadata.idempotencyKey`
- **`LedgerEntry`** — paired debit/credit per transaction (balanceBefore/After always 0 in prototype)
- **`Notification`**, **`AuditLog`** — defined but not yet wired to API routes

### Key design decisions
- **Secure ID** is a user-chosen 12-character string using symbols: `− + × = ○ ● □ ■`. One mobile can own exactly one Secure ID.
- **OTP is prototype-fixed** at `0000`. Real SMS integration is a future item.
- **No JWT/sessions** — the frontend stores `{ symbolId, fullName }` in localStorage; every API call passes `symbolId` directly. There is no auth middleware or token verification.
- **WebAuthn rpID** is derived from the incoming request's `Origin` header, so passkeys are origin-bound (works on Netlify; breaks on localhost unless configured).
- **Duplicate transaction guard**: 15-second window blocks identical (sender, receiver, amount, note) resends; optional `idempotencyKey` field provides client-side dedup.
- **Mobile normalization**: 10-digit numbers are stored as `+91XXXXXXXXXX`; the `normalizeMobileNumber` helper handles 10/11/12-digit variants.
