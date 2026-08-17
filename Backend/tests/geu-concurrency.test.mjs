// GEU (Gloobal Energy Unit) concurrency checks — brief section 24: "test 100
// simultaneous entry mints, 100 simultaneous growth events for the same
// account/day, 100 simultaneous redemptions. Verify no double mint/growth/
// redemption, no negative balance from races, no lost updates, no broken
// supply invariant."
//
//   node tests/geu-concurrency.test.mjs
//
// Runs the real server.js against a THROWAWAY database on the same cluster
// MONGO_URI points at (same pattern every other test file in this directory
// uses) — no production collection is read or written, and the test
// database is dropped when the run ends. Kept as its own process/file
// rather than folded into geu-invariants.test.mjs so its own in-process
// writeLimit budget (this server's rate limiter is in-memory and per
// process — see server.js's own "In-process and therefore per-instance"
// comment) starts fresh, and so a slow race doesn't block the much larger
// number of ordinary functional checks in that other file.
//
// Every request carries its own synthetic X-Forwarded-For value, exactly
// like geu-invariants.test.mjs, so 300+ concurrent GEU writes don't run
// into this server's own per-client writeLimit (150 / 5 min) — that budget
// is a real anti-abuse control on ONE caller hammering the API, not a
// ceiling on how many genuinely different concurrent requests this test is
// allowed to prove atomicity against.

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(BACKEND, "server.js"));

require("dotenv").config({ path: join(BACKEND, ".env"), quiet: true });

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is not set — this test needs Backend/.env.");
  process.exit(1);
}

const TEST_DB = "gloobal_geu_concurrency_check";
const [beforeQuery, query] = process.env.MONGO_URI.split("?");
process.env.MONGO_URI = `${beforeQuery.replace(/\/[^/]*$/, "/")}${TEST_DB}${query ? "?" + query : ""}`;
process.env.PORT = process.env.TEST_PORT || "5202";
process.env.PROTOTYPE_TRANSACTION_MAX_AMOUNT = "1000000";
process.env.AUTH_TOKEN_SECRET = "test-secret-not-the-production-one";
process.env.PROTOTYPE_OTP = "123456";

const mongoose = require("mongoose");

require(join(BACKEND, "server.js"));

const User = require(join(BACKEND, "models/User"));
const Pin = require(join(BACKEND, "models/Pin"));
const Transaction = require(join(BACKEND, "models/Transaction"));
const LedgerEntry = require(join(BACKEND, "models/LedgerEntry"));
const Country = require(join(BACKEND, "models/Country"));
const GeuSupply = require(join(BACKEND, "models/GeuSupply"));
const GeuEntryMint = require(join(BACKEND, "models/GeuEntryMint"));
const GeuGrowthEvent = require(join(BACKEND, "models/GeuGrowthEvent"));
const GeuRedemption = require(join(BACKEND, "models/GeuRedemption"));

const BASE = `http://127.0.0.1:${process.env.PORT}`;
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const symbolId = (seed) => {
  let n = seed;
  const chars = [];
  for (let i = 0; i < 12; i += 1) {
    chars.push(SYMBOLS[n % 8]);
    n = Math.floor(n / 8);
  }
  return chars.join("");
};

const PIN = "864209";

let nextFakeIp = 1;
const freshIp = () => `10.88.${Math.floor(nextFakeIp / 256)}.${nextFakeIp++ % 256}`;

const untilConnected = () =>
  new Promise((resolve, reject) => {
    if (mongoose.connection.readyState === 1) return resolve();
    mongoose.connection.once("connected", resolve);
    mongoose.connection.once("error", reject);
    setTimeout(() => reject(new Error("timed out connecting to MongoDB")), 40000);
  });

const call = (method, path, body, token, ip) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: Object.assign(
      { "Content-Type": "application/json", "X-Forwarded-For": ip || freshIp() },
      token ? { Authorization: `Bearer ${token}` } : {}
    ),
    body: body === undefined ? undefined : JSON.stringify(body)
  }).then(async (response) => ({ status: response.status, body: await response.json().catch(() => null) }));

const post = (path, body, token, ip) => call("POST", path, body, token, ip);

async function registerAccount(symbol, mobileNumber, name, countryIso) {
  const ip = freshIp();
  await post("/api/otp/send", { mobileNumber, purpose: "registration" }, null, ip);
  await post("/api/otp/verify", { mobileNumber, otp: "123456", purpose: "registration" }, null, ip);
  const registered = await post("/api/register-symbol", { fullName: name, mobileNumber, symbolId: symbol, countryIso }, null, ip);
  const token = registered.body?.token;
  await post("/api/pin/set", { symbolId: symbol, pin: PIN }, token, ip);
  return token;
}

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures += 1;
};

const geuOf = async (symbol) => {
  const u = await User.findOne({ symbolId: symbol }).lean();
  return { geu: u?.geuBalance || 0, fiat: u?.balance || 0, id: u?._id };
};

async function run() {
  await untilConnected();
  if (mongoose.connection.name !== TEST_DB) {
    throw new Error(`refusing to run against "${mongoose.connection.name}" — expected ${TEST_DB}`);
  }
  console.log(`db: ${mongoose.connection.name}\n`);

  await Promise.all([
    User.deleteMany({}), Pin.deleteMany({}), Transaction.deleteMany({}), LedgerEntry.deleteMany({}),
    Country.deleteMany({}), GeuSupply.deleteMany({}), GeuEntryMint.deleteMany({}),
    GeuGrowthEvent.deleteMany({}), GeuRedemption.deleteMany({}),
  ]);

  await Country.create([{ iso: "IN", name: "India", dialCode: "+91", localCurrency: "INR" }]);

  const ENTRY_RACER = symbolId(11);
  const GROWTH_RACER = symbolId(12);
  const REDEEM_RACER = symbolId(13);

  const entryToken = await registerAccount(ENTRY_RACER, "+919300000011", "Entry Racer", "IN");
  const growthToken = await registerAccount(GROWTH_RACER, "+919300000012", "Growth Racer", "IN");
  const redeemToken = await registerAccount(REDEEM_RACER, "+919300000013", "Redeem Racer", "IN");
  if (![entryToken, growthToken, redeemToken].every(Boolean)) {
    throw new Error("registration did not return a token for every racer account");
  }

  // ---------------------------------------------------------------------
  console.log("1. 100 concurrent entry mints against the SAME account, sized so exactly half can be backed");
  // ---------------------------------------------------------------------
  const ENTRY_AMOUNT = 100;
  const ENTRY_STARTING_BALANCE = 5000; // exactly 50 mints of 100 can be backed
  await User.updateOne({ symbolId: ENTRY_RACER }, { $set: { balance: ENTRY_STARTING_BALANCE } });

  const entryRequests = Array.from({ length: 100 }, (_, i) =>
    post("/api/geu/entry", { symbolId: ENTRY_RACER, amount: ENTRY_AMOUNT, idempotencyKey: `entry-race-${i}` }, entryToken)
  );
  const entryResults = await Promise.all(entryRequests);
  const entryAccepted = entryResults.filter((r) => r.status === 201);
  const entryRefused = entryResults.filter((r) => r.status === 400);
  const entryOther = entryResults.filter((r) => r.status !== 201 && r.status !== 400);

  check(`exactly 50 of 100 entry mints accepted (${ENTRY_STARTING_BALANCE} / ${ENTRY_AMOUNT})`,
    entryAccepted.length === 50, `accepted=${entryAccepted.length} refused=${entryRefused.length} other=${entryOther.length}`);
  check("no unexpected status codes", entryOther.length === 0, JSON.stringify(entryOther.map((r) => r.status)));

  const entryRacerAfter = await geuOf(ENTRY_RACER);
  check("account fiat balance landed on exactly 0, never negative", entryRacerAfter.fiat === 0, `fiat=${entryRacerAfter.fiat}`);
  check(`account geuBalance credited exactly ${50 * ENTRY_AMOUNT} (50 x ${ENTRY_AMOUNT}), no more and no less`,
    entryRacerAfter.geu === 50 * ENTRY_AMOUNT, `geu=${entryRacerAfter.geu}`);
  check("fiat + geu is conserved at the starting balance", entryRacerAfter.fiat + entryRacerAfter.geu === ENTRY_STARTING_BALANCE,
    `fiat+geu=${entryRacerAfter.fiat + entryRacerAfter.geu}`);
  check("exactly 50 GeuEntryMint rows were written — one per accepted request, none lost, none duplicated",
    (await GeuEntryMint.countDocuments({ userId: entryRacerAfter.id })) === 50);
  const entrySupplyAfter = await GeuSupply.load();
  check("GeuSupply.createdFromEntry matches exactly what was actually minted",
    entrySupplyAfter.createdFromEntry === 50 * ENTRY_AMOUNT, `createdFromEntry=${entrySupplyAfter.createdFromEntry}`);
  check("GeuSupply.capitalBackingReferenceInr matches exactly what was actually minted (1 GEU = INR1)",
    entrySupplyAfter.capitalBackingReferenceInr === 50 * ENTRY_AMOUNT, `capitalBackingReferenceInr=${entrySupplyAfter.capitalBackingReferenceInr}`);

  // ---------------------------------------------------------------------
  console.log("\n2. 100 concurrent growth events for the SAME account AND THE SAME growthPeriod — must produce exactly one applied event");
  // ---------------------------------------------------------------------
  const growthEntry = await post("/api/geu/entry", { symbolId: GROWTH_RACER, amount: 10000, idempotencyKey: "growth-racer-fund" }, growthToken);
  check("funding entry for the growth racer accepted", growthEntry.status === 201, `status=${growthEntry.status}`);
  const growthOpeningBalance = (await geuOf(GROWTH_RACER)).geu;
  check("growth racer funded with exactly 10000 GEU", growthOpeningBalance === 10000, `geu=${growthOpeningBalance}`);
  const GROWTH_CEILING = Math.floor(growthOpeningBalance * 0.003 * 100) / 100; // 30, floored the same way floorToMinorUnit does
  check("sanity: ceiling for this balance is 30 (10000 * 0.003)", GROWTH_CEILING === 30, `ceiling=${GROWTH_CEILING}`);

  const SAME_PERIOD = "2026-08-10";
  const growthRequests = Array.from({ length: 100 }, (_, i) =>
    post("/api/geu/growth", { symbolId: GROWTH_RACER, growthPeriod: SAME_PERIOD, requestedGrowthAmount: GROWTH_CEILING }, growthToken)
  );
  const growthResults = await Promise.all(growthRequests);
  const growthWinners = growthResults.filter((r) => r.status === 201);
  const growthLosers409 = growthResults.filter((r) => r.status === 409);
  const growthLosersDup = growthResults.filter((r) => r.status === 200 && r.body?.duplicate === true);
  const growthOther = growthResults.filter((r) =>
    !(r.status === 201 || r.status === 409 || (r.status === 200 && r.body?.duplicate === true)));

  check("exactly ONE of the 100 concurrent same-period growth requests actually applied (201)",
    growthWinners.length === 1, `winners=${growthWinners.length}`);
  check("every other request was either a race-loser (409, balance changed under it) or a recognised duplicate (200) — never a second real growth event",
    growthLosers409.length + growthLosersDup.length === 99, `409s=${growthLosers409.length} duplicates=${growthLosersDup.length}`);
  check("no unexpected status codes (e.g. a 500 that would indicate an unhandled partial write)", growthOther.length === 0, JSON.stringify(growthOther.map((r) => r.status)));

  const growthRacerAfter = await geuOf(GROWTH_RACER);
  check(`account geuBalance moved by exactly the ONE applied growth amount (${GROWTH_CEILING}), not double-applied`,
    growthRacerAfter.geu === growthOpeningBalance + GROWTH_CEILING, `expected=${growthOpeningBalance + GROWTH_CEILING} actual=${growthRacerAfter.geu}`);
  check("exactly one GeuGrowthEvent row exists for this (account, period) — the unique index held under the race",
    (await GeuGrowthEvent.countDocuments({ accountId: growthRacerAfter.id, growthPeriod: SAME_PERIOD })) === 1);
  const growthSupplyAfter = await GeuSupply.load();
  check("GeuSupply.createdFromGrowth increased by exactly the one applied amount, not 100x it",
    growthSupplyAfter.createdFromGrowth === GROWTH_CEILING, `createdFromGrowth=${growthSupplyAfter.createdFromGrowth}`);

  // ---------------------------------------------------------------------
  console.log("\n3. 100 concurrent redemptions against the SAME account, sized so exactly half can be redeemed");
  // ---------------------------------------------------------------------
  const redeemEntry = await post("/api/geu/entry", { symbolId: REDEEM_RACER, amount: 5000, idempotencyKey: "redeem-racer-fund" }, redeemToken);
  check("funding entry for the redeem racer accepted", redeemEntry.status === 201, `status=${redeemEntry.status}`);
  const REDEEM_AMOUNT = 100;
  const redeemOpening = await geuOf(REDEEM_RACER);
  check("redeem racer funded with exactly 5000 GEU and 0 fiat left", redeemOpening.geu === 5000 && redeemOpening.fiat === 0,
    `geu=${redeemOpening.geu} fiat=${redeemOpening.fiat}`);

  const redeemRequests = Array.from({ length: 100 }, (_, i) =>
    post("/api/geu/redeem", { symbolId: REDEEM_RACER, amount: REDEEM_AMOUNT, idempotencyKey: `redeem-race-${i}` }, redeemToken)
  );
  const redeemResults = await Promise.all(redeemRequests);
  const redeemAccepted = redeemResults.filter((r) => r.status === 201);
  const redeemRefused = redeemResults.filter((r) => r.status === 400);
  const redeemOther = redeemResults.filter((r) => r.status !== 201 && r.status !== 400);

  check(`exactly 50 of 100 redemptions accepted (${redeemOpening.geu} / ${REDEEM_AMOUNT})`,
    redeemAccepted.length === 50, `accepted=${redeemAccepted.length} refused=${redeemRefused.length} other=${redeemOther.length}`);
  check("no unexpected status codes", redeemOther.length === 0, JSON.stringify(redeemOther.map((r) => r.status)));

  const redeemRacerAfter = await geuOf(REDEEM_RACER);
  check("account geuBalance landed on exactly 0, never negative", redeemRacerAfter.geu === 0, `geu=${redeemRacerAfter.geu}`);
  check(`account fiat credited exactly ${50 * REDEEM_AMOUNT} (50 x ${REDEEM_AMOUNT}), no more and no less`,
    redeemRacerAfter.fiat === 50 * REDEEM_AMOUNT, `fiat=${redeemRacerAfter.fiat}`);
  check("fiat + geu is conserved at the pre-race total", redeemRacerAfter.fiat + redeemRacerAfter.geu === redeemOpening.fiat + redeemOpening.geu,
    `expected=${redeemOpening.fiat + redeemOpening.geu} actual=${redeemRacerAfter.fiat + redeemRacerAfter.geu}`);
  check("exactly 50 GeuRedemption rows were written — one per accepted request, none lost, none duplicated",
    (await GeuRedemption.countDocuments({ userId: redeemRacerAfter.id })) === 50);
  const redeemSupplyAfter = await GeuSupply.load();
  check("GeuSupply.destroyedFromRedemption matches exactly what was actually redeemed",
    redeemSupplyAfter.destroyedFromRedemption === 50 * REDEEM_AMOUNT, `destroyedFromRedemption=${redeemSupplyAfter.destroyedFromRedemption}`);

  // ---------------------------------------------------------------------
  console.log("\n4. global supply invariant still reconciles after all three races");
  // ---------------------------------------------------------------------
  const finalSupply = await GeuSupply.load();
  const circulating = finalSupply.createdFromEntry + finalSupply.createdFromGrowth - finalSupply.destroyedFromRedemption - finalSupply.destroyedFromNegativeGrowth;
  const [held] = await User.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ["$geuBalance", 0] } } } }]);
  check("createdFromEntry + createdFromGrowth - destroyedFromRedemption - destroyedFromNegativeGrowth == sum(User.geuBalance) even after three separate races",
    circulating === (held?.total || 0), `circulating=${circulating} heldByAccounts=${held?.total || 0}`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  return failures;
}

let exitCode = 1;
try {
  exitCode = (await run()) === 0 ? 0 : 1;
} catch (error) {
  console.error("HARNESS ERROR:", error);
} finally {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === TEST_DB) {
      await mongoose.connection.dropDatabase();
      console.log(`dropped test database ${TEST_DB}`);
    }
    await mongoose.disconnect();
  } catch (error) {
    console.error("cleanup error:", error.message);
  }
  process.exit(exitCode);
}
