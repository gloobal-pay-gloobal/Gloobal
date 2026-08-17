---
name: prototype-integrator
description: Absorb an external AI-generated code file, zip, JSX component, or folder into the real Gloobal codebase. Use whenever code arrives from ChatGPT, Claude.ai, Cursor, v0, Bolt, Lovable, or any tool outside this repo — triggers include "integrate this", "merge this into our project", "the founder shared this file", "add this feature from this file", "port this component", "use this as reference", "take the design from this". Treats external files as design prototypes, never as production-ready code to drop in. Extracts intent, maps to the real codebase, implements safely, verifies with Playwright.
---

# Prototype Integrator

Safely absorb external AI-generated code into a real production codebase.

## The core mental model

External AI-generated files (ChatGPT, Claude.ai, Cursor, Bolt, v0, Lovable) are **design prototypes, not production code**. They are:

- Written in isolation with no knowledge of the real codebase
- Missing real API endpoints, auth, routing, state management
- Using hardcoded data, mock functions, placeholder logic
- Potentially conflicting with existing features, variable names, styles, patterns

Act as a senior full-stack developer reviewing a junior's prototype: understand what they were trying to build, extract the good ideas, implement them properly — without breaking anything that already works.

## Where to work

| Folder | Role |
|---|---|
| `D:\Gloobal project` | Sandbox. Branch `experimental`, push URLs set to `no_push`. **All integration happens here.** |
| `D:\Desktop\Gloobal` | Main repo. Do not edit during integration. |

Print the current folder before writing anything. If it is the main repo, stop and ask.
The sandbox path contains a space — quote it: `cd "D:\Gloobal project"`.

---

## Phase 1 — Intake and triage

### 1a. Read the project codebase first

Before opening the external file, re-orient in the real project:

```bash
git log --oneline -5                          # what was last shipped
git status                                    # any uncommitted work
find Frontend/src -name "*.jsx" | head -20    # key components
```

Read the files most likely to be affected by whatever the external file is trying to do.

### 1b. Read the external file — extract intent, not code

Open the external file(s). Read them completely. Answer these six questions **in writing, before touching the real codebase**:

1. What feature or screen is this trying to build? (one sentence)
2. What UI elements / interactions does it introduce?
3. What data does it need? (fields, shapes, API calls it assumes exist)
4. What does it call that doesn't exist in our real backend?
5. What styles/tokens does it use? Are they compatible with our `T` system?
6. Does anything conflict with existing features by name, route, or component?

### 1c. Classify what to take vs. discard

Mark every section of the external file as one of:

- **TAKE** — good logic or UI that can be cleanly ported
- **ADAPT** — right idea, wrong implementation (hardcoded data → real API call)
- **DISCARD** — mock/demo/placeholder with no equivalent in our real system
- **CONFLICT** — directly collides with existing code by name or function

Read `references/conflict-checklist.md` now for a systematic conflict scan.

---

## Phase 2 — Implementation plan

Before writing a single line of code, produce a written plan:

```
INTEGRATION PLAN
================
Feature being integrated: [name]
Source file: [filename]
Target files to modify: [list]
New files to create: [list if any]

TAKE:
  - [each thing being taken, and where it goes in the real codebase]

ADAPT:
  - [each adaptation: what the external file does vs. what the real version does]

DISCARD:
  - [everything being discarded and why]

CONFLICT RISKS:
  - [naming, routing, or state conflicts found, and how they're resolved]

WILL NOT TOUCH:
  - [existing features that must remain completely unchanged]
```

Show this plan and **wait for confirmation** only if it involves:

- Replacing an entire existing component (not just adding to it)
- Changing a backend route that other features depend on
- Modifying auth, session, or PIN/OTP logic

For additive changes (new screen, new feature, new section), proceed directly.

---

## Phase 3 — Implementation rules

Full detail in `references/gloobal-conventions.md`. The rules that matter most:

### Style and tokens
- The real codebase uses **inline styles with `T` design tokens** from `styles/theme.js` — NOT Tailwind
- Replace any Tailwind classes (`className="flex items-center..."`) with inline style equivalents
- Replace any local colour constants (`const PURPLE = '#6d28d9'`) with `T.accent`, `T.ink`, etc.
- Use `symbolFor()` from `constants/finance.js` for all currency symbols — never hardcode ₹ / $ / ¥

### API and data
- Replace every mock/hardcoded data array with a real API call, or derive from existing state
- Replace every `fetch('http://localhost:3000/...')` with a call through `services/api/authApi.js`
- If a required backend endpoint does not exist: create it in `server.js` following existing patterns
- Never import from a path that doesn't exist in the real project

### State and navigation
- Do NOT introduce a new global state manager (no Redux, Zustand, Jotai) — use existing React state patterns
- Navigation goes through the existing `stage` state machine in `App.jsx` — do not add a router
- If the external file has its own routing (React Router, etc.): extract the screens and wire them as stages

### Component integration
- Do NOT copy-paste an entire external file as a new component if it duplicates existing functionality
- If the external file reimplements something that already exists (a dial pad, a flag picker): delete the reimplementation and import the real component
- Gate new behaviour behind a prop (`mode="new-feature"`) so shared components are not globally changed

### Authentication
- Never change OTP hashing, bcrypt, PIN verify logic, or WebAuthn credentials
- If the external file has its own auth flow: discard it and wire to the real auth endpoints

### No demo data in production
- Remove all hardcoded arrays (fake transactions, fake users, fake seeds, fake scores)
- Replace with real API calls plus proper loading / empty / error states

---

## Phase 4 — Verification

1. **Build check** — `npm run build` in `Frontend/` must exit clean (no new errors beyond the pre-existing lint baseline)
2. **Write targeted tests** — Playwright specs that verify the integrated feature end-to-end with mocked API responses
3. **Regression check** — run the existing Playwright suites; none may go from green to red
4. **Self-correction loop** — any test fails → diagnose → fix → rebuild → rerun (up to 5 cycles before escalating)

Read `references/playwright-patterns.md` for the standard mock and test patterns used in this project.

---

## Phase 5 — Handoff

After all tests pass:

1. Commit **on the `experimental` branch, in the sandbox only**: `feat: integrate [feature name] from prototype`
2. **Never push.** Push URLs are `no_push` on purpose — a failed push is the guard working, not a bug to fix. See `gloobal-safe-git`.
3. Output a summary:

```
INTEGRATION COMPLETE
====================
Feature: [name]
Source: [external filename]
Files changed: [list]
Lines added / removed: [from git diff --stat]
Tests: [N new / N total passing]
Discarded from prototype: [brief list]
Existing features verified unchanged: [list]
```

Promoting the work to `D:\Desktop\Gloobal`, or pushing to GitHub, is a separate step requiring explicit approval. This skill never does it.

---

## Hard rules

- Never run the sandbox backend against the live database. `Backend\.env` and `report-mailer\.env` still hold production credentials for `https://gloobal-pay.onrender.com`.
- Never delete an existing real screen to make a prototype screen fit. Report the collision and let the user choose.
- Do not copy the prototype's `node_modules`, lockfile, or `.env`.

## Reference files

- `references/conflict-checklist.md` — systematic scan for naming and logic conflicts
- `references/playwright-patterns.md` — standard test patterns for this project
- `references/gloobal-conventions.md` — tokens, API patterns, stage machine
