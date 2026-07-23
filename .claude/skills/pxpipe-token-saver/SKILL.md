---
name: pxpipe-token-saver
description: Explains pxpipe (a local token-saving proxy for Claude Code) and how to run Claude Code through it while working on Gloobal. Use when the user asks about pxpipe, saving tokens, or the pxpipe dashboard/proxy.
---

# pxpipe token saver (Gloobal)

Local-only helper setup. Nothing here touches Gloobal's app source, backend, or git history — it only changes how Claude Code's own API traffic is routed on this machine.

## Read this first: installing this skill saves zero tokens by itself

pxpipe is an HTTP proxy. It only affects anything if the Claude Code
*process* was started with `ANTHROPIC_BASE_URL` pointed at it. This skill
existing in `.claude/skills/` does not route traffic — routing happens at
`claude` process startup, not afterward, and not because the skill is
installed. A session that was started normally (no `ANTHROPIC_BASE_URL`
set) is NOT routed through pxpipe no matter how long it runs or how much
old data sits in `~/.pxpipe/events.jsonl` from some earlier session.

**Correct startup is always two PowerShell windows** — see below. There is
no one-window way to do this.

## What pxpipe does

pxpipe (https://github.com/teamchong/pxpipe) is a local proxy that sits between Claude Code and Anthropic's API. It compresses eligible tool schemas, system reminders, tool results, and conversation history before they're sent, and reports the real percentage of tokens saved (measured via `/v1/messages/count_tokens`). It runs entirely on `127.0.0.1` (loopback only, unauthenticated) unless explicitly reconfigured.

## When to use it for Gloobal

Turn it on for long, exploratory Claude Code sessions on this repo — reading through `GlobalId.jsx`, backend `server.js`, digging through screenshots/zips, or any session likely to accumulate a lot of tool output. It's a cost/token optimization, not a correctness tool.

## How to run it — two windows, in order

**Window 1 — start the proxy, leave it open the whole session:**
```powershell
cd "C:\Users\Chanchal Sharma\Desktop\Gloobal"
.\.claude\pxpipe\start-proxy.ps1
```
(same as running `npx --yes pxpipe-proxy@latest` directly)

**Window 2 — start Claude Code routed through it:**
```powershell
cd "C:\Users\Chanchal Sharma\Desktop\Gloobal"
.\.claude\pxpipe\start-claude-through-pxpipe.ps1
```
(same as `$env:ANTHROPIC_BASE_URL="http://127.0.0.1:47821"` then `claude`)

If window 1 is closed, window 2's session stops being routed — the env
var was only read once at `claude` startup, closing the proxy after that
doesn't un-set it, it just means requests fail or fall through unrouted.

## How to verify it's actually working — don't assume, check

1. Inside the routed session:
   ```powershell
   echo $env:ANTHROPIC_BASE_URL
   ```
   Must print `http://127.0.0.1:47821`. Empty means this session is not routed, full stop.

2. Tail the log and check the **timestamp**, not just that the file exists:
   ```powershell
   Get-Content "$env:USERPROFILE\.pxpipe\events.jsonl" -Tail 30
   ```
   `events.jsonl` existing proves some past session was routed at some
   point — it does not prove the current one is. Check `"ts"` is from
   today.

3. Dashboard — open while the routed session is active and working:
   ```
   http://127.0.0.1:47821/
   ```
   Should show live activity, not a stale/empty view.

## `unsupported_model` — what it actually means

Verified straight from the installed `pxpipe-proxy` package source
(`dist/core/applicability.js`), not assumed:

```js
const DEFAULT_MODEL_BASES = ['claude-fable-5', 'gpt-5.6'];
```

By default, **only Claude Fable 5 and GPT-5.6 get compressed.** Every
other Claude model — Sonnet 5, Opus 4.8, Haiku 4.5, all of them — logs
`"compressed": false, "reason": "unsupported_model"` by design, not by
malfunction. The package's own source comment: Opus 4.8 is intentionally
excluded because it measurably reads pxpipe's imaged context worse than
Fable 5 (its own FINDINGS.md: ~2pp arithmetic, 6/15 dense-hex recall vs.
Fable's 100/100).

**If Fable 5 / Sonnet 5 is unsupported and you're tempted to try Opus
4.8 next: don't expect a different result — Opus 4.8 is excluded from the
default list for the same reason Sonnet 5 is, verified directly against
the source above.** Test empirically (dashboard or logs) before assuming
either way; don't guess from memory of an older version of pxpipe.

To opt a model in anyway (accuracy tradeoff noted above applies), set
`PXPIPE_MODELS` **before starting the proxy window**:
```powershell
$env:PXPIPE_MODELS = "claude-sonnet-5,claude-fable-5,gpt-5.6"
```
or toggle live from the dashboard. This is a documented, sanctioned
extension point — never patch `node_modules/pxpipe-proxy` directly (npx
re-fetches a clean copy every run anyway, so a patch wouldn't survive).

## Risks / limits — read before trusting compressed output

pxpipe's compression is **lossy**. Never trust a compressed response for exact:
- commit hashes
- file paths
- API routes (e.g. `/api/transactions/send` vs a similar-looking one)
- env values or secrets
- Secure IDs, symbolIds, or other identifiers
- PIN logic / auth logic details
- exact code being edited

Always verify these against the real files (Read/Grep/git) before acting on them, exactly as you would with any AI output — pxpipe changes token usage, not the need to check ground truth. **For every Gloobal coding task, re-read the exact source file from disk before editing it**, whether or not this session happens to be pxpipe-routed.

## Files

- `.claude/pxpipe/start-proxy.ps1` — window 1
- `.claude/pxpipe/start-claude-through-pxpipe.ps1` — window 2
- `.claude/pxpipe/README.md` — full write-up (this file's longer sibling)
- `.claude/start-claude-with-pxpipe.ps1` — repo-root convenience wrapper for window 2

## Stopping

Close the PowerShell window running the proxy (Ctrl+C), or just close the terminal. Nothing persists beyond that window and the log file at `~/.pxpipe/events.jsonl`.
