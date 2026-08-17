# Conflict checklist

Run this before writing the integration plan. Every item is a real collision class that has bitten this codebase. Record a verdict for each — "checked, none" is a valid answer, silence is not.

## 1. Component name collisions

```bash
cd "D:/Gloobal project/Frontend/src"
grep -rn "export default function\|export function\|export const" --include=*.jsx . | grep -i "<PrototypeComponentName>"
```

The prototype ships `DashboardScreen` and so do we (`components/dashboard/DashboardScreen.jsx`). Same name, completely different component. Decide explicitly: replace, rename, or merge. Never let two files claim the same conceptual screen.

## 2. Reimplemented primitives

Search the prototype for its own version of something we already have:

| Prototype likely has | We already have |
|---|---|
| dial pad / numeric keypad | `components/common/DialPads.jsx` |
| OTP or code boxes | `components/common/CodeEntry.jsx` |
| country / flag picker | `components/common/FlagComponents.jsx`, `components/auth/CountryPickerScreen.jsx` |
| PIN entry | `components/auth/PinScreen.jsx`, `PinScreenShell.jsx` |
| icon set | `components/common/Icons.jsx` |
| bottom sheet / modal | `components/common/ExplainSheet.jsx`, `GapPanels.jsx` |

Delete the reimplementation, import ours.

## 3. Stage / route collisions

```bash
grep -n 'stage === "' App.jsx | grep -o '"[a-zA-Z]*"' | sort -u
```

Current stages: `phone` `otp` `secureId` `referral` `pin` `deviceSetup` `dashboard` `loginAuth` `loginBiometric` `reauth`.

A prototype adding a stage named `pin` or `dashboard` will silently hijack an existing screen. Pick a non-colliding name.

If the prototype uses React Router / Next routing: extract the screens, discard the router.

## 4. Style system conflicts

```bash
grep -n "className=" <prototype-file>      # Tailwind — must all go
grep -n "#[0-9a-fA-F]\{6\}" <prototype-file>  # raw hex — map to T tokens
grep -rn "styled-components\|@emotion\|tailwind" <prototype-dir>
```

Any raw hex that isn't already a `T` value is a decision to make, not a value to copy. A new CSS-in-JS dependency is a hard no.

## 5. Currency symbol hardcoding

```bash
grep -n "₹\|\\$\|€\|£\|¥" <prototype-file>
```

Every hit must become `symbolFor()` / `symbolForCountry()`. A hardcoded `₹` is a bug the moment a non-INR account opens the screen.

## 6. Fake API and demo data

```bash
grep -n "setTimeout\|mockData\|dummy\|fake\|placeholder\|TODO\|localhost:3000\|localhost:5000" <prototype-file>
grep -n "const .* = \[" <prototype-file>    # hardcoded arrays
```

Classify each: real API call, derive from existing state, or delete. A `setTimeout` pretending to be a network call always maps to a real `authApi` function plus loading/empty/error states.

## 7. Auth flow collisions

```bash
grep -n "otp\|pin\|bcrypt\|passkey\|webauthn\|credential\|session\|token" -i <prototype-file>
```

**Hard stop.** If the prototype implements its own OTP check, PIN comparison, or credential storage, discard it entirely and wire to the real endpoints. Never edit OTP hashing, bcrypt rounds, PIN verify, or WebAuthn credential handling to accommodate a prototype.

Watch specifically for a prototype comparing against `CORRECT_PIN` from `constants/finance.js` — that constant is demo-only.

## 8. State management

```bash
grep -n "redux\|zustand\|jotai\|recoil\|mobx\|createContext\|useReducer" -i <prototype-file>
```

No new global state library. A prototype's `Context` is usually replaceable by lifting state into `App.jsx` alongside `stage`.

## 9. Dependency drift

Diff the prototype's `package.json` against `Frontend/package.json`. Every new dependency needs a justification and a bundle-size answer. Default verdict: reject and reimplement with what's installed.

Never copy the prototype's `node_modules`, lockfile, or `.env`.

## 10. Import paths that don't exist

```bash
grep -n "^import\|from ['\"]" <prototype-file>
```

Every import must resolve in the real tree. A prototype written in isolation routinely imports `@/components/ui/button` and similar paths that do not exist here.

## 11. Session persistence

If the prototype holds auth state only in React state, it will appear to "log out on refresh". Real session state goes through `services/session.js`. There is an existing regression suite for this (`e2e/session-persistence.spec.mjs`) — do not break it.

## Verdict table

Fill this in before Phase 2:

| # | Check | Verdict |
|---|---|---|
| 1 | Component names | |
| 2 | Reimplemented primitives | |
| 3 | Stage collisions | |
| 4 | Style system | |
| 5 | Currency symbols | |
| 6 | Fake API / demo data | |
| 7 | Auth flow | |
| 8 | State management | |
| 9 | Dependencies | |
| 10 | Import paths | |
| 11 | Session persistence | |
