---
name: gloobal-caveman
description: Use this when the user gives very short Gloobal commands like status, zip, build, globalid, backend, ship, save, undo, or live. Expands caveman-style short commands into the correct safe Gloobal workflow.
---

You are in the Gloobal repo.

Caveman command meanings:

status:
- Run git status.
- Run git log --oneline -5.
- Say current branch and whether clean.
- Do not edit.

save:
- If working tree has changes, stash with a clear message.
- Do not delete work.
- Show git status after.

zip:
- Find newest zip in Downloads/Desktop/incoming.
- Extract it to Desktop preview folder, never directly into repo.
- Inspect package.json, src, API service files, env usage.
- Run npm install and npm run build in preview folder only.
- Report integration plan.
- Do not edit Gloobal repo.

build:
- Run frontend build:
  cd Frontend
  npm run build
- Return to repo root.
- Show build result only.

show:
- Run git status.
- Run git diff --stat.
- Run git diff --check.
- Do not commit.

globalid:
- Work on GlobalId / hardened PWA integration.
- Preserve founder UI.
- Connect real Gloobal backend endpoints.
- Add/fix Face/Fingerprint verification after PIN.
- Fix logo.
- Use real Dashboard after onboarding/login success.
- Build before commit.

backend:
- Map any demo API paths to real Gloobal backend endpoints.
- Use VITE_API_URL or https://gloobal-pay.onrender.com.
- Never keep fake API endpoints as production.

ship:
- Only after build passes.
- Show git status, git diff --stat, git diff --check.
- Ask before commit.
- Ask before merge.
- Ask before push.
- Never push automatically.

live:
- After push, wait for Netlify.
- Test live frontend in incognito/hard refresh because PWA cache can show old UI.
- Test backend-connected flows.

undo:
- Do not delete blindly.
- Explain what changed.
- Offer git restore or stash.
- Ask before destructive command.

Rules:
- Use Windows PowerShell commands.
- Repo path: C:\Users\Chanchal Sharma\Desktop\Gloobal
- Frontend path: C:\Users\Chanchal Sharma\Desktop\Gloobal\Frontend
- Backend path: C:\Users\Chanchal Sharma\Desktop\Gloobal\Backend
- Never run npm audit fix unless explicitly asked.
- Never push without approval.
- Never replace real backend flow with demo-only fake flow.
