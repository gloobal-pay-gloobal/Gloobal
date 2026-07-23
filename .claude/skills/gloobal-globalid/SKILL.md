---
name: gloobal-globalid
description: Integrate founder GlobalId or hardened PWA UI into Gloobal and connect it to real backend.
---

Goal:
Use founder GlobalId/PWA UI, keep design, connect real backend.

Real backend base:
const RAW_API_BASE = import.meta.env.VITE_API_URL || "https://gloobal-pay.onrender.com";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "").replace(/\/api$/i, "");
const apiUrl = (path) => `${API_BASE}${path}`;

Real endpoints:
- POST /api/otp/send
- POST /api/otp/verify
- POST /api/register-symbol
- POST /api/login
- POST /api/pin/set
- POST /api/pin/verify
- GET /api/profile/:symbolId
- GET /api/users/resolve?identifier=...
- POST /api/transactions/send
- GET /api/transactions/history/:symbolId

Passkey/device endpoints:
- /api/passkey/status
- /api/passkey/register/options
- /api/passkey/register/verify
- /api/passkey/auth/options
- /api/passkey/auth/verify

Map demo APIs:
- /auth/register -> /api/register-symbol
- /auth/login -> /api/login
- /auth/verify-pin -> /api/pin/verify
- /auth/verify-otp -> /api/otp/verify

Required flow:
phone -> OTP -> secureId -> referral -> PIN -> Face/Fingerprint -> real Dashboard

Rules:
- Do not keep demo DashboardScreen as final if real Dashboard.jsx exists.
- Prefer GlobalId accepting onComplete(userData).
- App.jsx should save session and then render real Dashboard.jsx.
- Keep founder UI design as much as possible.
- Fix logo if it appears broken.
- Build before commit.
