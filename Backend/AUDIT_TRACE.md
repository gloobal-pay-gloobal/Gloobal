# End-to-end trace: a cross-border payment through the current backend

This document traces one payment through the actual, current code — not a
description of intended behaviour, a line-by-line account of what
`server.js`'s `POST /api/transactions/send` and the modules it calls
actually do, file and line references included. It exists to satisfy the
audit brief's own requirement (section 2): "trace one payment end-to-end
... documenting every DB write/balance/ledger/pool/settlement/receipt/audit
event per transition."

## A note on the worked example's numbers before tracing it

The brief's own example says: "Sender: India, INR balance ₹100,000;
Payment: ₹85,000; Receiver: USA, USD; FX: 1 USD = ₹85; therefore destination
amount = $1,000."

Read literally — "the sender enters/pays ₹85,000, and the system works out
that comes to $1,000 on the other end" — **that is not how the current
implementation works, and this is worth flagging explicitly rather than
silently reinterpreting**, per the brief's own instruction to stop and
report ambiguities instead of inventing an interpretation.

What the code actually does (`server.js` line 3423 on, and the identical
assumption baked into the frontend's `SendMoneyScreen.jsx` — see its own
comment at line 250-253: *"amountNumber is the typed face value — the
receiver's own currency ... which for a cross-border payment is a different
number, in a different currency, than what actually left the sender's
balance"*) is the reverse: the `amount` field in the request body is always
denominated in the **receiver's own currency** (`destinationCurrency`), and
the sender's own debit (`debitAmount`) is the *derived, converted* figure.
This is consistent — frontend and backend agree with each other, and
`cashback`/`payeeReceives` (both receiver-currency) are computed straight
from `amount` with no unit conversion, while `debitAmount`/`cashbackCredit`
(both sender-currency) are computed by multiplying by `fxRate` — but it is
the opposite convention from a UPI-style "I am sending ₹85,000 out of my
account" mental model, and the opposite of how the brief's own example
describes the input.

This is not treated as a bug and nothing was changed to "fix" it: the
convention is applied consistently everywhere `amount` is read
(cashback/payee split, ledger currency tagging, the prototype amount cap),
and rewriting it to be sender-denominated would be exactly the kind of
"invent a rule / redesign the economic concept" move the brief prohibits.
It is flagged here as a **finding for the user to confirm intent on**, filed
under Unresolved Design Questions in the audit report, because it changes
what a person actually has to type into the amount box to reproduce the
brief's own example.

To trace the brief's actual intended outcome — sender debited ₹85,000,
receiver credited $1,000, at 1 USD = ₹85 — the request must carry
`amount: 1000` (US dollars, the receiver's currency), not `amount: 85000`.
That is the request this trace uses below. (Sending `amount: 85000` as
literally written in the brief would be interpreted as "pay the receiver
$85,000", requiring an INR debit of ₹7,225,000 — far more than the sender's
₹100,000 balance — and would simply be refused for insufficient balance at
line 3407, never reaching settlement at all.)

## Setup

- Sender: India, `countryIso: 'IN'`, `User.balance = 100000` (INR, prototype
  units — this backend keeps balances as plain `Number`, not integer minor
  units; see the Mathematical Invariants section of the audit report for
  what that does and doesn't put at risk).
- Receiver: USA, `countryIso: 'US'`, `User.cashbackRate = 0` (a plain
  receive, no Creator share — the cashback path is traced separately,
  below, using the brief's own 0%/0.01%/1%/3%/5%/7% cases).
- `Country.localCurrency`: `IN -> INR`, `US -> USD`.
- FX: `ExchangeRate` cache holds `{ fromCurrency: 'USD', toCurrency: 'INR',
  rate: 85 }` — i.e. "1 USD = 85 INR", fetched or cached by
  `lib/fxRates.js#getRate('USD', 'INR')`.
- Request: `POST /api/transactions/send { senderSymbolId, receiverSymbolId,
  amount: 1000, pin, idempotencyKey }`.

## State machine, as actually implemented

The brief names the phases CREATED → FX QUOTED → AUTHORIZED → SENDER DEBIT →
POOL UPDATE → DESTINATION SETTLEMENT → RECEIVER CREDIT → CASHBACK →
ASSET/SHARE RECORDS → RECEIPTS → SETTLED. The current code does not have
that many discrete persisted states (`Transaction.status` only ever takes
the value `'success'` on the happy path — there is no intermediate
`'pending'` row written and then advanced; the whole thing is one atomic
unit), but every one of those *conceptual* steps does happen, in this order,
inside a single function (`performTransfer`, `server.js` line ~3500-3732),
itself wrapped by `withMongoTransaction` (line ~3767) so the whole block
commits or rolls back as one:

**1. AUTHORIZED (PIN + identity).** Around line 3309 on. `Pin.findOne`, checks
`lockedUntil`, `bcrypt.compare(cleanPin, pinRecord.pinHash)`. Wrong PIN:
`failedAttempts` incremented and saved, `AuditLog` write
(`transaction.send.pin_invalid`), 401 returned, nothing else below runs.
Locked: `AuditLog` write (`transaction.send.blocked`), 423 returned. Correct
PIN: `failedAttempts`/`lockedUntil` reset, `lastVerifiedAt` stamped, `Pin`
document saved — this is a real DB write even on a successful payment.

**2. FX QUOTED.** Lines 3378-3402. Both parties' `Country.localCurrency`
looked up. Since `senderCurrency ('INR') !== destinationCurrency ('USD')`,
`getRate('USD', 'INR')` is called. This either returns a cached rate (a
fresh `ExchangeRate` row, age-checked against `FX_RATE_MAX_AGE_MS = 6h`) or
fetches live from open.er-api.com and caches the result; if neither
succeeds, the whole request fails closed with `502` — **no rate is ever
invented**. This trace assumes a cache hit: `fxRate = 85`,
`fxRateSource = 'cache'` (or `'live'`/whatever `lib/fxRates.js` names its
source). No DB write for a cache hit; a live fetch would additionally
`ExchangeRate.create`/`updateOne` the new row (not shown here, since it
doesn't happen on this particular request).

**3. Split computed (destination currency).** Lines 3415-3424.
`payeeCashbackRate = 0` (this receiver). `cashback = toMinorUnit(1000 * 0,
'USD') = 0`. `payeeReceives = toMinorUnit(1000 - 0, 'USD') = 1000`.

**4. Split computed (sender currency, converted).** Lines 3395-3396 (courtesy
check first) then 3529-3530 (used inside `performTransfer`).
`debitAmount = toMinorUnit(1000 * 85, 'INR') = 85000`.
`cashbackCredit = toMinorUnit(0 * 85, 'INR') = 0`.

**5. Courtesy balance check.** Lines 3405-3414. `senderBalanceBefore =
100000 >= debitAmount (85000)` — passes. (This check reads a value another
request could change before the real write lands — it exists only to fail
fast with a useful number for the ordinary case; see its own comment. The
check that actually protects the balance is the next step.)

**6. Idempotency / duplicate checks.** Lines 3416-3451. `cleanIdempotencyKey`
pre-check (`Transaction.findOne` by `fromUserId` + `metadata.idempotencyKey`)
and the 15-second duplicate-window check (`Transaction.findOne` by
`fromUserId`/`toUserId`/`amount`/`currency`/`note`/`createdAt`). Both are
plain reads, not atomic claims — see the Mathematical Invariants section
(Invariant F) for exactly what gap that leaves and what closes part of it.
Neither finds anything for a first-time request; both pass.

**7. SENDER DEBIT.** Around line 3536, inside `performTransfer`, inside the
Mongo session/transaction. `User.findOneAndUpdate({ _id: sender._id,
balance: { $gte: 85000 } }, { $inc: { balance: -85000 } })`. This is the
real guard — an indivisible, conditional document write. Two concurrent
₹85,000 sends against a ₹100,000 balance cannot both match this filter; the
second's `$gte` fails and `debitedSender` comes back null, throwing
`InsufficientBalanceError` (line 3514) rather than allowing an overdraft.
Sender balance is now **15,000 INR** (before cashback credit, if any — none
here).

**8. Transaction row created.** Around line 3577. `Transaction.create([{
fromUserId, toUserId, amount: 1000, currency: 'USD' (destinationCurrency),
type: 'send', status: 'success', referenceId: 'GLOOBAL-TXN-...', metadata:
{ idempotencyKey, senderCurrency: 'INR', debitAmount: 85000, fxRate: 85,
... } }])`, in-session. Created *before* the receiver is credited so the
settlement step below has a real `transaction._id` to attach its audit row
to (see the code's own comment) — but still inside the same atomic block,
so a settlement failure below rolls this row back too, leaving no
half-written `Transaction`.

**9. DESTINATION SETTLEMENT (POOL UPDATE, both sides).**
`settleCrossBorderPayment` (`lib/settlementEngine.js` line 104), called
because `senderCurrency !== destinationCurrency`. Four writes, two pools:
  - `CountryCurrencyPool.loadOrCreate('US', 'INR', 'USD')` — the USA's own
    pool for the INR corridor, denominated in USD. If this corridor has
    never been touched before, it is seeded at
    `DEFAULT_POOL_SEED_BALANCE = 5,000,000` (USD) — not zero — specifically
    so a corridor's first-ever payment isn't refused for a reason that has
    nothing to do with the payment itself (see that model's own header
    comment).
  - **Destination gross release (the hard liquidity gate):**
    `findOneAndUpdate({ _id: destinationPool._id, availableBalance: { $gte:
    1000 } }, { $inc: { availableBalance: -1000, totalBalance: -1000 } })`.
    Gated on the **full face amount** (1000), not the net-of-cashback
    figure — even though 0 cashback comes back a moment later in this
    example, the code always checks the gross figure (see the module's own
    comment on why: the whole amount genuinely has to be real, available
    liquidity at that instant). Fails → throws
    `InsufficientPoolLiquidityError`, which aborts the *entire* transaction,
    including the sender's debit from step 7 and the `Transaction` row from
    step 8 — nothing is left half-done. In this example it succeeds:
    destination pool available balance is now 4,999,000 USD.
  - **Destination cashback return:** skipped — `destinationCashbackReturn
    (cashback) = 0`, so no second write happens on this pool for this
    example (the code guards this write with `if (destinationCashbackReturn
    > 0)`).
  - `CountryCurrencyPool.loadOrCreate('IN', 'USD', 'INR')` — India's own
    pool for the USD corridor, denominated in INR. Also seeded at 5,000,000
    INR if new.
  - **Source credit:** `findOneAndUpdate({ _id: sourcePool._id }, { $inc: {
    availableBalance: 85000, totalBalance: 85000 } })` — the sender's full
    converted debit lands here. Always succeeds (a credit, no liquidity
    gate). Source pool available balance is now 5,085,000 INR.
  - **Source cashback release:** skipped — `sourceCashbackRelease
    (cashbackCredit) = 0`.
  - `Settlement.create`: one row, `sourceAmount: 85000, sourceCreditAmount:
    85000, sourceCashbackRelease: 0, destinationAmount: 1000,
    destinationReleaseAmount: 1000, destinationCashbackReturn: 0, rate: 85,
    rateSource: 'cache', status: 'settled'`. This is the audit trail row
    the brief's own section 2 asks for — it captures the *exact* rate used,
    never a recalculated one (Invariant D).

**10. RECEIVER CREDIT.** Lines 3617-3623. `User.findOneAndUpdate({ _id:
receiver._id }, { $inc: { balance: 1000 } })`. Receiver balance is now
**1,000 USD** (from 0).

**11. CASHBACK (sender side).** Lines 3642-3654. Skipped in this example —
`cashbackCredit = 0`, so the `if (cashbackCredit > 0)` block never runs and
the sender's balance stays at 15,000 INR (not 15,000 + 0 — no-op, not a
zero-value write). The cashback-nonzero case is traced separately below.

**12. LEDGER ENTRIES.** Lines 3656-3728. Two rows written in this example
(a third exists only when `cashbackCredit > 0`):
  - Debit, `userId: sender`, `amount: 85000`, `currency: 'INR'`,
    `balanceBefore: 100000`, `balanceAfter: 15000`.
  - Credit, `userId: receiver`, `amount: 1000`, `currency: 'USD'`,
    `balanceBefore: 0`, `balanceAfter: 1000`.

  All of the above — steps 7 through 12 — commit or roll back together as
  one Mongo transaction (or, on a deployment without replica-set
  transaction support, are manually compensated on failure by the
  `!session` revert branch at line ~3766+; see Invariant G).

**13. AUDIT LOG.** (Outside `performTransfer`, after `withMongoTransaction`
returns successfully — this is deliberately not inside the money-moving
transaction; an audit-log failure must never roll back a real payment.)
`recordAudit({ action: 'transaction.send.success', status: 'success',
metadata: { transactionId, referenceId, amount: 1000, senderCurrency: 'INR',
destinationCurrency: 'USD', crossBorder: true, settlementId } })`.

**14. ASSET SEED.** Best-effort, outside the atomic block. Skipped in this
example — `payeeCashbackRate = 0`, so the `if (payeeCashbackRate > 0)`
guard at the call site never runs `AssetSeed.create`. (Traced separately
below for the cashback-nonzero case.)

**15. SHARE LEG / RECEIPTS.** `mintShareLegAndReceipts`
(`lib/merchantShareFlow.js`), best-effort, outside the atomic block. Since
`cashback = 0` here, `hasShare` is false: one `Receipt` is issued (`leg:
'payment', role: 'shared'`) and no second `Transaction`/receipt pair is
minted. `paymentTransaction.status` and every balance above are already
final by this point — a failure in this step changes nothing about the
payment's own correctness, only whether a receipt row exists for it.

**16. SETTLED (response).** `201`, with `transaction`, `settlement`,
`senderBalanceAfter: 15000`, `debitAmount: 85000`, `fxRate: 85`,
`payeeReceives: 1000`, `cashback: 0` in the body.

### End state for this example

| Account/pool | Before | After |
|---|---|---|
| Sender balance (INR) | 100,000 | 15,000 |
| Receiver balance (USD) | 0 | 1,000 |
| India→USD pool (INR) `availableBalance` | 5,000,000 | 5,085,000 |
| USA→INR pool (USD) `availableBalance` | 5,000,000 | 4,999,000 |

Conservation check (Invariant D, cross-border): the sender's own currency
side moved **exactly** ₹85,000 out of the sender and into India's pool; the
receiver's own currency side moved **exactly** $1,000 out of the USA's pool
and into the receiver. Each side is internally exact in its own currency —
₹85,000 leaves one place and lands in exactly one other place; $1,000 leaves
one place and lands in exactly one other place — connected only by the
single captured `fxRate: 85`, which is never recomputed anywhere downstream
of this one settlement row. See the audit report's Mathematical Invariants
section for the general form of this and why it holds for the
cashback-nonzero case too.

## The cashback-nonzero variant (brief section 7's six rates)

Re-run mentally with `receiver.cashbackRate` in turn `{0, 0.0001, 0.01,
0.03, 0.05, 0.07}` against the same `amount: 1000` (USD), same `fxRate: 85`.
`cashback`/`payeeReceives` are computed once in destination currency (line
3423-3424); `cashbackCredit` is `cashback * fxRate`, rounded again in the
*sender's* currency (line 3396). Computed directly from the live
`toMinorUnit` implementation (not simulated) for the 2-decimal case
(INR/USD both have `Currency.decimals: 2`):

| rate | cashback (USD) | payeeReceives (USD) | sum | cashback+payeeReceives == amount? |
|---|---|---|---|---|
| 0% | 0 | 1000 | 1000 | yes |
| 0.01% | 0.1 | 999.9 | 1000 | yes |
| 1% | 10 | 990 | 1000 | yes |
| 3% | 30 | 970 | 1000 | yes |
| 5% | 50 | 950 | 1000 | yes |
| 7% | 70 | 930 | 1000 | yes |

No rounding leakage at any of the six rates — `cashback + payeeReceives`
reconstructs `amount` exactly in every case (Invariant E holds for this
amount/decimals pair). For each nonzero row, the additional steps that ran
in the trace above:

- **Step 11 (cashback, sender side)** now runs: sender is credited
  `cashbackCredit = toMinorUnit(cashback * 85, 'INR')` — e.g. at the 1% row,
  `10 * 85 = 850` INR credited back, so the sender's net cost for a "pay
  $1,000, get 1% back" send is ₹85,000 − ₹850 = ₹84,150, not the full
  ₹85,000.
- **Step 9 (settlement)** carries a nonzero `destinationCashbackReturn`
  (credited back into the USA pool) and `sourceCashbackRelease` (released
  back out of the India pool) — both pool balances net to the same "gross
  moved, cashback moved back" two-line shape described in step 9 above, just
  with real numbers instead of zeros.
- **Step 12 (ledger)** gets its third row: `entryType: 'credit', userId:
  sender, amount: cashbackCredit, currency: 'INR', note: 'Cashback credited
  to balance'`.
- **Step 14 (asset seed)** now runs: `AssetSeed.create({ userId: sender._id,
  amountPaid: <derived from the ledger debit row>, cashbackRate: <this
  receiver's rate>, cashback: cashbackCredit, currency: 'INR', transactionId
  })` — this is the *new*, post-fix path (see the audit report's Bugs Fixed
  section): it derives every figure from the `Transaction`/`LedgerEntry`
  rows just written, not from anything the client sent.
- **Step 15 (share leg)** now mints a second `Transaction` (`type: 'share'`,
  `fromUserId: receiver, toUserId: sender, amount: cashback (USD),
  metadata.noBalanceMovement: true`) and two receipt pairs (4 `Receipt`
  rows total) instead of one shared receipt — documenting the same value
  already reflected in the `AssetSeed`, not moving any balance a second
  time.

## What this trace does **not** cover

- A same-currency (domestic) send: simpler by exactly the FX/settlement
  steps (3, 9) — everything else is identical, with `fxRate = 1` throughout.
- A **failure** at each step (insufficient balance, insufficient pool
  liquidity, FX unavailable, PIN invalid/locked, duplicate/idempotent
  retry): each is traced individually in the audit report's Failure
  Injection section, since each has a different recoverable end state and
  is more useful shown as "what rolls back and what's left behind" than
  woven into this happy-path trace.
