# Gloobal — Setup & Run Guide

UPI-style fintech prototype. React + Vite PWA frontend, Express + MongoDB backend.
node_modules stripped from this zip — install fresh with npm.

## Requirements
- Node.js 18+ and npm
- MongoDB Atlas connection string (or local MongoDB)

## Folder layout
```
Gloobal/
  Frontend/   React 19 + Vite PWA
  Backend/    Express 5 + Mongoose API
  docs/       architecture notes
```

## 1. Backend setup

```powershell
cd Backend
copy .env.example .env
notepad .env
```

Edit `.env` and fill in your real `MONGO_URI` (from MongoDB Atlas). Save and close.

```powershell
npm install
node server.js
```

Backend runs on `http://localhost:5000` by default.

## 2. Frontend setup

Open a **new** PowerShell window:

```powershell
cd Frontend
npm install
npm run dev
```

Frontend dev server runs on `http://localhost:5173`.

To point the frontend at a different backend (e.g. the live Render backend), set before running:

```powershell
$env:VITE_API_URL = "https://gloobal-pay.onrender.com"
npm run dev
```

## 3. Production build (frontend)

```powershell
cd Frontend
npm run build
npm run preview
```

Build output goes to `Frontend/dist/`.

## 4. Lint (frontend)

```powershell
cd Frontend
npm run lint
```

## Environment variables reference (Backend/.env)

| Var | Purpose | Default |
|---|---|---|
| `MONGO_URI` | MongoDB Atlas connection string | — (required) |
| `PORT` | Backend server port | 5000 |
| `PROTOTYPE_OTP` | Fixed OTP for testing | 0000 |
| `DEFAULT_LOGIN_PIN` | Fallback PIN if none set | 1234 |
| `PROTOTYPE_TRANSACTION_MAX_AMOUNT` | Max send amount | 5000 |

## Live deployments
- Frontend: https://gloobal.netlify.app
- Backend: https://gloobal-pay.onrender.com

## Notes
- No auth middleware — frontend stores `{ symbolId, fullName }` in localStorage, every API call passes `symbolId` directly.
- OTP is fixed at `0000` for prototype testing — no real SMS sent.
- `.env` was intentionally excluded from this zip (contains real DB credentials). Use `.env.example` as template.
