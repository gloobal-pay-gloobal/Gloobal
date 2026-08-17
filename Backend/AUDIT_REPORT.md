# Gloobal backend audit — database consistency report

Scope: `Backend/` (Express + Mongoose). This audits, proves, tests, and fixes
the *current* implementation of Gloobal's economic model — the
currency-pool / local-currency / global-settlement architecture as it
already exists. Nothing in this report proposes a different economic
design, introduces GEU/Essentials, replaces the pool model with
conventional banking, or invents a new rule the code didn't already have
some version of. Where the intended behaviour was genuinely ambiguous, that
ambiguity is reported below rather than resolved by invention.

**This backend is a prototype. Nothing in this report should be read as a
claim of production readiness or real-money capability. No new economic
concepts were introduced.**

## How this audit was actually run — a limitation to read before the rest

This sandbox cannot reach a MongoDB instance: no `mongod` binary is
installable (`apt` has no package, `fastdl.mongodb.org` and
`downloads.mongodb.com` both return HTTP 403 through this environment's
network allowlist), and `mongodb-memory-server`'s in-memory replica set
fails to download for the same reason. There is also no `Backend/.env`
here, so `MONGO_URI` is unset.

Practically, that means: every finding below about how the code *behaves*
comes from reading the code and manually tracing its logic against worked
numeric examples (see `AUDIT_TRACE.md`), not from running it against a real
database and watching it happen. Every test file in `Backend/tests/`
(existing and newly added) is written in the project's own established
self-contained style — `node tests/<name>.test.mjs`, boots the real
`server.js` against a throwaway database on whatever cluster `MONGO_URI`
points to, drops it on completion — and is ready for the user to run
against their own `Backend/.env`. **None of them, including the pre-existing
ones, have been executed in this session.** Every syntax claim below (`node
--check`) has been verified directly; every behavioural/numeric claim has
been verified by hand-tracing the actual code, cross-checking multiple
independent code paths against each other where possible (see the
"amount is destination-currency" finding below, confirmed by cross-reading
three separate call sites and two independently-written test files against
each other), and in a few cases by running small standalone Node snippets
that exercise pure functions (`toMinorUnit`) with no DB dependency.

## Files changed

| File | What changed |
|---|---|
| `lib/currencyDecimals.js` | **New.** Small cache module exposing `Currency.decimals` (per-currency decimal places) synchronously to `toMinorUnit`. |
| `server.js` | `toMinorUnit` made currency-aware; boot-time cache load; `/api/transactions/send` split computation passes currency through; `POST /api/assets/plant-seed` fully rewritten; idempotency-race duplicate-key handling added; `AuditLog` wiring added (helper + 5 call sites). |
| `models/AssetSeed.js` | Added `transactionId` field + partial unique index. |
| `models/Transaction.js` | Added partial unique index on `(fromUserId, metadata.idempotencyKey)`. |
| `tests/cross-border-settlement.test.mjs` | Fixed two independent bugs in the test itself (see Bugs Found #6) — stale pool-seed-balance assertions, and an inverted `ExchangeRate` seed direction plus wrong-currency-denomination assertions. |
| `tests/asset-seed-integrity.test.mjs` | **New.** Regression suite for the plant-seed fix. |
| `tests/currency-decimals-rounding.test.mjs` | **New.** Regression test for the decimals fix, using a genuine 0-decimal rounding boundary (see Bugs Found #6). |
| `tests/concurrency-scale.test.mjs` | **New.** 100-concurrent-sends-against-one-sender and 40-concurrent-sends-against-one-pool checks (brief section 13). |
| `AUDIT_TRACE.md` | **New.** Full end-to-end trace of one cross-border payment, code line references, plus the six cashback-rate cases from brief section 7. |
| `AUDIT_REPORT.md` | **New.** This file. |

Nothing else in the repository was touched. In particular: no economic
formula, rate, cap, or rule was changed — every fix below either corrects an
implementation bug against the model's own stated intent, closes a
concurrency gap, or adds coverage/observability.

## Bugs found and fixed

Each entry: OLD / NEW / WHY / WHICH INVARIANT.

### 1. `toMinorUnit` ignored `Currency.decimals` — sitewide, dormant precision bug

**OLD:** `toMinorUnit(value)` always rounded to a hardcoded 2 decimal
places, regardless of what currency the value was in. `models/Currency.js`
already had a `decimals` field, correctly seeded (e.g. JPY = 0), but nothing
in the codebase ever read it — confirmed by grepping the whole `Backend/`
tree for `decimals` outside the model file.

**NEW:** `lib/currencyDecimals.js` caches `Currency.code -> decimals` at
boot (and on demand via `loadCurrencyDecimals()`), and `toMinorUnit(value,
currencyCode)` now rounds to that currency's own decimal count, falling
back to 2 if the currency isn't in the cache (never throws, never blocks a
payment on a cache miss). Wired into the one path that currently handles
more than one currency per request: `/api/transactions/send`'s cross-border
split (`cashback`/`payeeReceives` in the destination currency,
`debitAmount`/`cashbackCredit` in the sender's).

**WHY:** A payment settling into a zero-decimal currency (JPY, and this
codebase's `Country` list includes others) would store fractional minor
units — e.g. 965.5 yen credited to a balance — which is not a valid amount
in that currency. Dormant today because no live traffic has yet exercised a
0-decimal corridor, but not hypothetical: `Country`/`Currency` already
support it.

**WHICH INVARIANT:** (A) ledger integrity — every stored figure must be a
valid amount in its own currency, not just "a number that adds up."

**Scoping decision, stated plainly:** `toMinorUnit` calls elsewhere in
`server.js` (coin mint/redeem/send, interest accrual) were deliberately
**not** touched. Gloobal Coin (`GC`) and interest figures aren't in the
`Currency` collection at all — `decimalsFor` would fall back to 2 for them
either way, so passing a currency code through those call sites would
currently be a no-op. Threading it through anyway, speculatively, for
routes this audit didn't verify need it, would have been exactly the kind
of scope creep the brief asks against. This is listed under Remaining
Risks below, not silently left unmentioned.

### 2. `POST /api/assets/plant-seed` — unauthenticated money fabrication

**OLD:** The route accepted `symbolId, business, category, amountPaid,
cashbackRate, currency` straight from the client with no bound on
`cashbackRate` and no link to any real `Transaction`. `AssetSeed.computeSeed`
compounds interest on `cashback` at 1%/month, payable to real balance via
`POST /api/assets/claim-interest`. A single request like `{ amountPaid: 1,
cashbackRate: 1000000 }` planted a seed whose "cashback" was fabricated out
of nothing, and that fabricated figure was payable into real balance.

**NEW:** The route now requires a `transactionId`, loads the real
`Transaction`, enforces `transaction.fromUserId === caller` (403 otherwise)
and `status === 'success'` with `type` in `['send', 'qr_payment']` (400
otherwise), and derives `amountPaid`/`cashbackRate`/`cashback`/`currency`
from that transaction's own `LedgerEntry` rows — never from anything the
client sent. Replanting the same transaction returns the existing seed
(`duplicate: true`) rather than a second one; a partial unique index on
`AssetSeed.transactionId` makes that guarantee hold even under a concurrent
double-submit, and an `E11000` collision is caught and turned into the same
"here's the existing seed" response rather than a 500.

**WHY:** This is the clearest real money-fabrication path found in the
audit. It was safe to lock down without breaking any real user flow —
`Frontend/src/services/api/assetsApi.js` exports `plantSeed()`, but it is
never imported or called anywhere in the frontend (confirmed by grep); a
seed is only ever planted server-side, automatically, inside
`performTransfer`.

**WHICH INVARIANT:** (H, AssetSeed-specific, brief section 8) — AssetSeed
cannot create unexplained money; every seed has a real parent transaction.

### 3. Idempotency-key check was a read-then-write race (TOCTOU)

**OLD:** `/api/transactions/send`'s idempotency-key pre-check was a plain
`Transaction.findOne({ fromUserId, 'metadata.idempotencyKey' })` followed,
much later, by `Transaction.create(...)`. Two requests carrying the same
client-generated idempotency key (the retry-after-timeout case an
idempotency key exists to protect against) could both read "nothing exists
yet" and both proceed to create a real transaction. The sender's balance was
never at risk — `performTransfer`'s debit is its own separate atomic
conditional `$inc`, unaffected by this gap — but the *idempotency guarantee
itself* was only usually true, not actually enforced.

**NEW:** `models/Transaction.js` gained a partial unique index on
`(fromUserId, metadata.idempotencyKey)` (partial: only where the key is
actually a string, so the many rows with no key, or a non-`'send'` type
that never sets this field, never collide with each other via `null`).
The loser of a race now gets an `E11000` from `Transaction.create` inside
the same atomic block that already reverts everything else on failure (or
is undone by the Mongo transaction abort, on a deployment that supports
real transactions). The route's catch handler recognizes this specific
collision and returns the winner's transaction the same way the pre-check
already does for the non-racing case, instead of surfacing a 500.

**WHY:** Closes the gap between "idempotency is checked" and "idempotency
is enforced," without changing what a successful, non-racing request does
at all.

**WHICH INVARIANT:** (F) idempotency under retries/duplicates.

**What this does NOT close** — documented, not fixed, see Remaining Risks:
the separate 15-second same-(sender,receiver,amount,note) duplicate-window
check is still a plain, non-atomic `findOne`. It has no natural unique key
to enforce atomically (unlike the idempotency key, which is client-supplied
and stable) — closing it properly would mean either requiring an
idempotency key on every request or introducing a synthetic
dedup key, either of which is a product decision, not a bug fix.

### 4. `AuditLog` was fully defined and never written to

**OLD:** `models/AuditLog.js` has a complete schema (`userId`, `action`,
`status`, `message`, `ipAddress`, `userAgent`, `metadata`, three indexes) —
but grepping the entire `Backend/` tree found zero call sites. Nothing
security- or money-relevant was ever recorded there.

**NEW:** A `recordAudit()` helper in `server.js` — fire-and-forget,
swallow-on-failure by construction, so an audit write can never fail, slow
down, or change the outcome of the request it describes — wired into five
points in `/api/transactions/send`: PIN lockout, PIN invalid, insufficient
balance, insufficient pool liquidity, and success.

**WHY:** Brief section 12 explicitly asks for this to be inspected and
wired without touching the economic model — it's a pure observability
addition, not a money-movement change.

**WHICH INVARIANT:** Not one of the numbered money invariants — this
supports auditability generally (brief section 2's "document every ...
audit event").

**Scoping decision:** Only `/api/transactions/send` was wired. Other
security-relevant routes (`/api/login`, `/api/pin/reset`, coin routes,
passkey routes) were left alone — wiring every route AuditLog could
plausibly cover is a larger, separate piece of work, and this audit's brief
is about payment consistency specifically. Listed under Remaining Risks.

### 5. `PROTOTYPE_TRANSACTION_MAX_AMOUNT` refusal message assumes INR

**Found, not fixed (cosmetic).** The cap check (`server.js`, the block
guarding `numericAmount > maxPrototypeAmount`) compares `numericAmount`
(destination-currency-denominated — see the next finding) against a single
env-configured ceiling and returns `` `Prototype transaction limit is Rs.
${maxPrototypeAmount}.` `` regardless of what currency `numericAmount`
is actually in. For a same-currency INR payment this is accurate; for any
cross-border payment the message names the wrong currency (and the cap
itself is currency-blind — 5000 JPY and 5000 USD are refused at the same
threshold even though they're wildly different amounts of value). This is a
string/UX correctness issue, not a money-safety one — no real value is
gained, lost, or misrouted by it — so per the brief's own "fix only real
bugs, not cosmetic ones" instruction, it was left as a finding rather than
changed. Noted under Remaining Risks.

### 6. Two of the audit's own cross-border test files modeled `amount` in the wrong currency

This is the single most important finding in this audit, and it is a
**test-authoring** bug, not a production code bug — but it is significant
enough, and easy enough to get wrong again, that it gets its own numbered
entry rather than being folded into "tests fixed."

**The actual, current, intentional behaviour** (confirmed by `server.js`'s
own comment at the top of its currency-conversion block, and independently
confirmed by matching comments and logic in
`Frontend/src/components/sendMoney/SendMoneyScreen.jsx`): the `amount`
field in a `POST /api/transactions/send` request is **always denominated in
the RECEIVER's own currency**, never the sender's. `cashback`/`payeeReceives`
are computed directly from it, no conversion. The sender's own debit
(`debitAmount`) is the *derived* figure — `amount * fxRate`, converted into
the sender's currency. This is the opposite of a "type how much leaves your
account" (UPI-style) mental model, and it is also the opposite of how the
audit brief's own worked example describes its input (see `AUDIT_TRACE.md`'s
opening section for the full reasoning and why this is filed as a design
question below, not a bug).

**What was actually wrong in the tests:**

- `cross-border-settlement.test.mjs` seeded `ExchangeRate` as `{
  fromCurrency: 'INR', toCurrency: 'USD' }`, but `server.js` calls
  `getRate(destinationCurrency, senderCurrency)` — `getRate('USD', 'INR')`
  for an India→USA payment — which queries `{ fromCurrency: 'USD',
  toCurrency: 'INR' }`. The seed never matched the query. Had this test
  actually been run somewhere with live network access, the cache lookup
  would have missed and silently fallen through to a **real network call**
  to `open.er-api.com` instead of testing the deterministic rate its own
  header comment claims to use — and the test's `destinationAmount === 50`
  /`sourceAmount === 1000` assertions were built on the sender-denominated
  mental model, not what the code (correctly, per the point above) actually
  does. **Fixed:** seed direction corrected to match the query; `amount`
  reinterpreted as the receiver's own currency; `sourceAmount`/
  `destinationAmount`/pool-balance assertions recomputed to match (now:
  $100 USD sent, 1 USD = 85 INR, `destinationAmount = 100`, `sourceAmount =
  8500`).
- `currency-decimals-rounding.test.mjs` (written earlier in this same
  audit session) got the `ExchangeRate` seed direction right, but chose a
  3% cashback rate that — combined with the destination-denominated
  `amount` — never actually produced a fractional yen figure before
  rounding (1000 × 0.03 = 30 JPY exactly). The test's whole-number checks
  would have passed identically whether or not the currency-decimals fix
  (finding #1) actually worked, because there was never a fraction for it
  to round away. **Fixed:** cashback rate changed to 3.45% (1000 × 0.0345 =
  34.5 JPY, a genuine 0-decimal rounding boundary), and the assertions
  pinned to the exact expected post-rounding figures (cashback = 35,
  `payeeReceives` = 965) rather than only "is a whole number."

A third file, `cross-currency-transfer.test.mjs` (pre-existing, not touched
by this audit), has this exactly right — correct seed direction, correct
amount-denomination model, and was the file used to cross-check and confirm
the fix above. It is worth reading as the reference example of what a
correct cross-border test in this codebase looks like.

**WHY this matters beyond "two tests were buggy":** it means this audit's
own trust in the *previous* segment's "cross-border-settlement.test.mjs
stale pool-balance fix" (an earlier fix in this same session, before this
compaction point) was itself only partially correct — that fix corrected
the pool-seed-balance numbers but did not catch the deeper
amount-denomination and rate-direction issues sitting in the same file. It
is now fixed properly, on this pass, informed by cross-referencing against
`cross-currency-transfer.test.mjs`.

**WHICH INVARIANT:** (D) cross-border conservation using the exact captured
FX rate — this finding is about correctly *testing* that invariant, not
about the invariant being violated in production code. Production behaviour
was already correct throughout; only two test files' understanding of it
was wrong.

## Tests

### Added
- `tests/asset-seed-integrity.test.mjs` — 9 sections covering the plant-seed
  rewrite (fabrication attack refused, real payment auto-plants, ownership
  enforced, replant idempotent under 6-way concurrency, figures match real
  ledger, no-cashback/nonexistent-transaction refused, interest claim still
  works on a legitimate seed).
- `tests/currency-decimals-rounding.test.mjs` — India→Japan payment
  exercising a genuine 0-decimal rounding boundary (see Bugs Found #6),
  plus a same-currency INR regression check that the fix didn't change
  2-decimal behaviour.
- `tests/concurrency-scale.test.mjs` — brief section 13's own "100
  concurrent payments against the same sender and against the same pool":
  100 concurrent sends draining one sender's balance to exactly 0, and 40
  concurrent cross-border sends (from 2 funded accounts, for reasons
  documented in the file itself — this server's own `/api/register-symbol`
  and `/api/otp/*` routes are rate-limited per client IP at 8 and 12 calls
  per 5 minutes respectively, and this test has no business working around
  its own anti-abuse controls) against one destination pool sized to allow
  exactly half through, checking the pool never goes negative and each
  sender's own final balance reflects exactly their own accepted sends.
- `tests/cross-border-settlement.test.mjs` — fixed in place (see Bugs Found
  #6), not new, but substantially corrected.

### Passed / Failed

**None of the tests in `Backend/tests/` — pre-existing or new — were
executed in this session.** See "How this audit was actually run" above for
why (no reachable MongoDB in this sandbox). Every test file is
self-contained and ready to run: `cd Backend && node
tests/<name>.test.mjs` against a `Backend/.env` with a real `MONGO_URI`.
Running the full suite the project already has a script for
(`npm test` chains three of the eight-plus files currently in `tests/` —
note `package.json`'s test scripts have not been updated to include the
newer files; see Remaining Risks) plus each file added or touched by this
audit is the natural next step, and this report does not claim any test
passed — that claim can only honestly be made after someone actually runs
them.

## Mathematical invariants — reasoning, not execution-verified

Each is stated, then checked against the actual code (with line references
in `AUDIT_TRACE.md`) or an executable-but-DB-free calculation where
possible. None of these are claims of a passing test run.

**(A) Ledger integrity** — every `LedgerEntry.balanceAfter` equals
`balanceBefore` plus/minus `amount`, and reflects a real, atomic balance
write. Verified by code reading: every ledger row in `performTransfer` is
constructed from the *actual* `findOneAndUpdate` results (`debitedSender`,
`creditedReceiver`, `creditedSender`), never a value computed independently
in Node and hoped to match.

**(B) Account conservation** — a sender's balance can never go negative.
Verified: the debit is `findOneAndUpdate({ balance: { $gte: debitAmount }
}, { $inc: { balance: -debitAmount } })` — a single indivisible conditional
document write. `tests/transfer-atomicity.test.mjs` (pre-existing) and
`tests/concurrency-scale.test.mjs` (new, this audit) both assert this at
increasing concurrency (10, then 100).

**(C) Pool conservation** — a destination pool's `availableBalance` can
never go negative. Verified: `settleCrossBorderPayment`'s release write
uses the identical conditional-`$inc` pattern as (B), gated on the full
gross release amount. `tests/concurrency-scale.test.mjs` section 2 (new)
exercises this at n=40 against a pool sized to allow exactly half through.

**(D) Cross-border conservation, exact captured rate** — the FX rate used
for a settlement is captured once (`fxRate`, read from `getRate()` before
any money moves) and reused for every leg of that same payment; it is never
independently recomputed downstream. Verified by code reading: `fxRate` is
computed once at request-handling time and threaded as a plain value into
`performTransfer`, `settleCrossBorderPayment`, and the `Settlement` row —
there is no second `getRate()` call anywhere in the money-moving path for a
single request. `Settlement.rate`/`rateSource` persist the exact value
used, satisfying the brief's "never recalculated" requirement.

**(E) Cashback conservation, no double-cashback, 0–7% bound** — computed
directly with the live `toMinorUnit` implementation (no DB needed) for the
brief's own six rates on ₹1,000: 0%, 0.01%, 1%, 3%, 5%, 7% all produce
`cashback + payeeReceives === amount` exactly, with no rounding leakage
(see `AUDIT_TRACE.md`'s table). The 7% ceiling is enforced twice — schema
level (`User.cashbackRate` has `max: 0.07`) and route level
(`PATCH /api/creator/cashback-rate` explicitly checks `0 <= rate <= 0.07`
before saving) — so a client cannot bypass the cap by skipping schema
validators. No double-cashback: the share leg
(`lib/merchantShareFlow.js`) explicitly moves no balance
(`metadata.noBalanceMovement: true`) — it exists only to give the
already-applied cashback its own Transaction ID and receipt pair, never to
credit it a second time.

**(F) Idempotency under retries/duplicates** — closed for the
idempotency-key case by Bugs Found #3 (new unique partial index +
collision handling); the 15-second duplicate-window heuristic remains a
non-atomic best-effort check, documented under Remaining Risks rather than
claimed fixed.

**(G) Atomicity with rollback** — verified by code reading of both paths
`withMongoTransaction` supports: on a deployment with replica-set
transaction support, every write inside `performTransfer` (debit, `Transaction`
creation, settlement's four pool writes, receiver credit, cashback credit,
ledger rows) is one Mongo session/transaction — any thrown error aborts all
of it, including the newly-added idempotency-key collision case (#3). On a
deployment without transaction support, the code's own non-transactional
fallback branch manually reverts each already-applied step in reverse,
tracked via `cashbackAppliedToSender`/`poolSettlementApplied`/
`createdTransactionId` flags that record exactly how far the operation got
— not a fixed "always undo everything" assumption that would over- or
under-revert depending on which step actually failed.

**Failure injection, per step (static analysis, not executed):**

| Failure point | What throws | Recoverable end state |
|---|---|---|
| Wrong/locked PIN | Returns before any money touched | No state change; `AuditLog` records it |
| FX rate unavailable | `getRate` throws, 502 returned | No state change — fails closed, never invents a rate |
| Insufficient sender balance (real, not courtesy-check) | `InsufficientBalanceError` from the conditional `$inc` | No state change; nothing was written |
| Destination pool insufficient liquidity | `InsufficientPoolLiquidityError` from settlement's conditional `$inc` | Session: whole transaction aborts, sender debit + `Transaction` row roll back too. Non-transactional: `!session` revert branch manually restores the sender's balance and marks the `Transaction` `'reversed'` |
| Idempotency-key collision (race) | `E11000` on the new unique index | Loser's writes roll back (session) or are individually reverted (non-transactional); loser receives the winner's transaction as a `duplicate: true` response, not an error |
| Receiver account disappears mid-transfer | Explicit `throw new Error(...)` | Same revert path as above — treated identically to any other mid-transfer failure |
| Asset seed / share-leg / receipt failure | Caught locally, logged, returns `null`/empty | Payment itself is already committed and unaffected — by design, these are best-effort and run after the atomic block |

## Remaining risks (not fixed, deliberately)

- **15-second duplicate-window check remains non-atomic.** A plain
  `findOne` read-then-write gap, distinct from the now-closed
  idempotency-key race. No natural atomic key exists for it without a
  product decision (require an idempotency key on every request, or define
  a synthetic dedup key) that this audit's brief doesn't authorize making
  unilaterally.
- **Coin routes (`/api/coin/mint`, `/redeem`, `/send`) have no idempotency
  protection at all.** They share the same atomic-conditional-`$inc` debit
  pattern that protects account balances (verified correct for that), but
  nothing analogous to the Transaction-level idempotency-key index applies
  to them — a retried mint/redeem/send request is not guaranteed to be
  deduplicated the way a payment now is.
- **`toMinorUnit`'s currency-aware rounding is scoped to
  `/api/transactions/send`'s cross-currency split only** (Bugs Found #1).
  Coin and interest call sites still round to a hardcoded 2 decimals;
  currently harmless (neither currency is in the `Currency` collection, so
  `decimalsFor` would return the same 2-decimal fallback either way) but
  worth knowing if either is ever registered with a different decimal
  count.
- **`AuditLog` wiring is scoped to `/api/transactions/send`** (Bugs Found
  #4). Login, PIN reset, passkey, and coin routes have no audit trail yet.
- **`PROTOTYPE_TRANSACTION_MAX_AMOUNT`'s refusal message and the cap itself
  are currency-blind** (Bugs Found #5) — cosmetic, not fixed.
- **`package.json`'s `test`/`test:*` scripts don't include every file in
  `tests/`.** Several pre-existing files (`cross-currency-transfer`,
  `merchant-share-flow`, `cashback-interest-claim`) plus every file this
  audit added are not wired into `npm test`'s script list — they have to be
  run individually today.
- **No test in this repository has actually been executed** — see "How this
  audit was actually run." Every pass/fail claim in this report is a
  code-reading or pure-function-calculation claim, not a test-run result.
  This is the single biggest gap between "audited" and "proven" that this
  report cannot close from inside this sandbox.

## Unresolved Gloobal design questions

Per the brief's own instruction: these are reported, not resolved by
invention.

1. **What currency should a person actually type an amount in?** Confirmed
   (Bugs Found #6, `AUDIT_TRACE.md`'s opening section) that the current,
   consistent, intentional behaviour across both frontend and backend is
   "the receiver's own currency" — but the audit brief's own worked example
   describes the input as the sender's currency ("Payment: ₹85,000"), and a
   UPI-style mental model (which Gloobal's own `CLAUDE.md` describes the
   product as) would suggest the same. This is not flagged as a bug — the
   implementation is internally consistent and deliberate, evidenced by
   matching comments on both sides of the stack — but it is worth an
   explicit confirmation that "type how much the recipient gets" (not "type
   how much leaves your account") is the intended product experience for a
   cross-border send, since it is easy for a future contributor (or test
   author — see Bugs Found #6) to get backwards.
2. **Reversals and refunds.** `Transaction.status` supports `'refunded'`
   and `'reversed'`, and `Transaction.type` supports `'refund'` and
   `'reversal'` — full schema support exists. No route anywhere creates one
   (confirmed by grepping the whole `Backend/` tree for these values
   outside the schema definition itself). Per the brief's own instruction
   not to invent a system if none exists, no reversal/refund route was
   added. Whether/how one should work — compensating transaction only,
   original-transaction-linked, who can initiate one, whether cashback and
   pool settlement need their own compensating logic — is a real design
   question this audit did not have authority to answer.
3. **Same-currency `amount` typed value: still ambiguous whether a plain
   domestic payment "means" the same thing as a cross-border one to a
   person using the app**, given finding #1 above — for a domestic payment
   `fxRate` is always 1, so sender-denominated and receiver-denominated
   amounts are numerically identical and the ambiguity is invisible. It
   only becomes observable the moment a payment crosses currencies, which
   may be why it was never caught.

## Recommended next stage

1. Get this actually run. The single highest-value next step is provisioning
   a real `Backend/.env` (`MONGO_URI` pointed at a throwaway database on the
   same cluster the app already uses) and running every file in `tests/`,
   including the four this audit added/touched. Every claim in this report
   above the "Remaining risks" section is a reasoned-through claim, not a
   proven one, until that happens.
2. Resolve unresolved design question #1 (amount currency direction) with
   whoever owns the product decision — it doesn't require a code change
   either way, but it determines whether `AUDIT_TRACE.md`'s trace or the
   audit brief's own worked example is the one a future contributor should
   trust.
3. Decide on reversals/refunds (unresolved question #2) as its own
   scoped piece of design + implementation work, not folded into a future
   audit pass.
4. Extend idempotency protection to the coin routes and the 15-second
   duplicate window, once a decision is made on what key to enforce
   uniqueness against for the latter.
5. Wire `package.json`'s test scripts to include every file currently in
   `tests/`, so "run the test suite" means all of it, not a subset three
   files chose in 2024/2025-era commits.
