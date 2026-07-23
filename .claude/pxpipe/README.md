# pxpipe on this laptop — how it actually works

This folder has the scripts. Read this once before relying on any token
savings number.

## The one thing to understand first

**Installing the pxpipe skill does nothing by itself.** pxpipe is a local
HTTP proxy. It only touches your traffic if the Claude Code process was
*started* with `ANTHROPIC_BASE_URL` pointed at it. If you just open a
normal `claude` session, no proxy is involved, no compression happens, no
tokens are saved — the skill existing in `.claude/skills/` doesn't change
that.

Every prior "check pxpipe" session on this machine found
`ANTHROPIC_BASE_URL` empty — meaning none of those sessions were actually
routed, regardless of whether `~/.pxpipe/events.jsonl` had old data in it
from some earlier routed session.

## Correct two-window startup

**Window 1 — start the proxy, leave it open:**
```powershell
cd "C:\Users\Chanchal Sharma\Desktop\Gloobal"
.\.claude\pxpipe\start-proxy.ps1
```
(equivalent to `npx --yes pxpipe-proxy@latest` directly)

**Window 2 — start Claude Code routed through it:**
```powershell
cd "C:\Users\Chanchal Sharma\Desktop\Gloobal"
.\.claude\pxpipe\start-claude-through-pxpipe.ps1
```
(equivalent to setting `$env:ANTHROPIC_BASE_URL="http://127.0.0.1:47821"` then running `claude`)

Window 1 must stay open the entire time. Closing it kills the proxy and
every subsequent request from window 2's Claude session goes straight to
Anthropic unrouted (Claude Code doesn't re-check `ANTHROPIC_BASE_URL`
mid-session if the endpoint disappears — the request just fails or the
env var was already baked in at process start).

## How to verify it's actually working — don't trust the skill, check these

1. **Inside the routed session (window 2):**
   ```powershell
   echo $env:ANTHROPIC_BASE_URL
   ```
   Must print `http://127.0.0.1:47821`. Empty = not routed.

2. **Tail the event log:**
   ```powershell
   Get-Content "$env:USERPROFILE\.pxpipe\events.jsonl" -Tail 30
   ```
   Look at the `"ts"` field — must be from *today*, not a stale run from a
   previous day. Old timestamps mean you're looking at leftover data, not
   proof the current session is routed.

3. **Dashboard:** open `http://127.0.0.1:47821/` in a browser while window
   2 is active and doing something. It should show live request activity.

## What `unsupported_model` means (read this before assuming it's broken)

Verified directly from the installed `pxpipe-proxy` package source
(`dist/core/applicability.js`), not guessed:

```js
const DEFAULT_MODEL_BASES = ['claude-fable-5', 'gpt-5.6'];
```

When `PXPIPE_MODELS` is unset, **only Claude Fable 5 and GPT-5.6 get
compressed by default.** Every other model — including Claude Sonnet 5,
Claude Opus 4.8, and Claude Haiku 4.5 — is out of scope on purpose, and a
request from any of them will log:
```json
"compressed": false, "reason": "unsupported_model"
```
This is not a bug, not a routing failure, and not something a package
patch should silently override. The package's own comment explains why
Opus 4.8 is excluded even though it's a fine model generally:

> Opus 4.8 measurably worse at reading imaged content (FINDINGS.md
> 2026-06-16: Opus 4.8 ~2pp arithmetic, 6/15 dense-hex recall vs Fable's
> 100/100)

pxpipe's compression method renders context to images for the model to
read back — Fable 5 was specifically validated for that; other models
weren't, and testing showed real accuracy loss. That's a legitimate
default, not a limitation to work around blindly.

**If Sonnet 5 (or whatever model you're on) shows `unsupported_model`,
Opus 4.8 will show it too — Opus is explicitly excluded from the default
list, same as Sonnet.** There's no current Claude Code model besides
Fable 5 that gets default compression here.

### Opting a model in anyway

This is a supported, documented extension point — not a patch. Set it
**before starting the proxy window**:
```powershell
$env:PXPIPE_MODELS = "claude-sonnet-5,claude-fable-5,gpt-5.6"
.\.claude\pxpipe\start-proxy.ps1
```
or flip the toggle live from the dashboard at `http://127.0.0.1:47821/`
(no restart needed — the dashboard override is read live). Know the
tradeoff above before doing this for a model other than Fable 5: you're
trading some accuracy in what the model "sees" from compressed history
for token savings.

`start-claude-through-pxpipe.ps1` (window 2) now prompts for this choice
each run — options are Fable 5 only (default), +Sonnet 5, +Opus 4.8,
+Haiku 4.5, or all of them + gpt-5.6. Since window 2 can't change window
1's proxy process, the script just prints the exact `$env:PXPIPE_MODELS`
line to copy into window 1 (or use the dashboard toggle) — it doesn't set
anything automatically.

**Do not** edit `node_modules/pxpipe-proxy` directly. `npx` re-fetches a
fresh copy from the npm cache and any edit disappears on the next run,
plus it diverges from what `pxpipe-token-saver` documents. If
`PXPIPE_MODELS` genuinely isn't enough for something you need, that's a
real fork/wrapper decision, not a quick edit — ask before going there.

## pxpipe is lossy — for Gloobal work specifically

Compression is lossy by design (that's the whole savings mechanism). When
working on the Gloobal repo through a pxpipe-routed session, never trust a
compressed response for:
- exact commit hashes
- file paths
- API routes (`/api/transactions/send` vs. something similar-looking)
- env values or secrets
- Secure IDs, symbolIds, or other identifiers
- PIN / auth logic details
- exact code being edited

**Always re-read the real file from disk (Read/Grep/git) before editing
it**, exactly as this session already does — pxpipe changes token usage,
never the need to check ground truth against the actual files in
`Frontend/` and `Backend/`.

## Files in this folder

| File | Run in | Purpose |
|---|---|---|
| `start-proxy.ps1` | Window 1 | Starts the proxy, prints the dashboard URL, stays in foreground |
| `start-claude-through-pxpipe.ps1` | Window 2 | Checks the proxy is up, prints the model-support note above, sets `ANTHROPIC_BASE_URL`, runs `claude` |
| `README.md` | — | This file |

`.claude\start-claude-with-pxpipe.ps1` (repo root, outside this folder) is
a thin convenience wrapper that just calls
`pxpipe\start-claude-through-pxpipe.ps1` — kept for anyone used to the
older path.
