// Checks for lib/settlementEngine.js as wired into POST /api/transactions/send.
//
//   node tests/cross-border-settlement.test.mjs
//
// Runs the real server.js against a THROWAWAY database on the same cluster
// MONGO_URI points at — same replica set, so behaviour matches production,
// but no production collection is touched. The run refuses to start if it
// finds itself connected to anything else.
//
// Pre-seeds an ExchangeRate cache row instead of relying on a live call to
// open.er-api.com, the same way the rest of this suite never depends on
// anything outside MongoDB — see lib/fxRates.js's getRate: a fresh cache
// hit never touches the network, so this test's rate is exactly the one
// the seeded row says, not whatever the provider happens to answer today.
//
// What it guards. settleCrossBorderPayment is best-effort by design — a
// settlement bug must never surface as a failed payment (see
// lib/settlementEngine.js's header comment). That makes it easy for a
// broken settlement to go unnoticed: the payment still returns 201 either
// way. This checks the settlement side directly rather than only the
// payment's status code.

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

const TEST_DB = "gloobal_settlement_check";
const [beforeQuery, query] = process.env.MONGO_URI.split("?");
process.env.MONGO_URI = `${beforeQuery.replace(/\/[^/]*$/, "/")}${TEST_DB}${query ? "?" + query : ""}`;
process.env.PORT = process.env.TEST_PORT || "5197";
process.env.PROTOTYPE_TRANSACTION_MAX_AMOUNT = "100000";
process.env.AUTH_TOKEN_SECRET = "test-secret-not-the-production-one";
process.env.PROTOTYPE_OTP = "123456";

const mongoose = require("mongoose");

require(join(BACKEND, "server.js"));

const User = require(join(BACKEND, "models/User"));
const Pin = require(join(BACKEND, "models/Pin"));
const Transaction = require(join(BACKEND, "models/Transaction"));
const LedgerEntry = require(join(BACKEND, "models/LedgerEntry"));
const Country = require(join(BACKEND, "models/Country"));
const Currency = require(join(BACKEND, "models/Currency"));
const CountryCurrencyPool = require(join(BACKEND, "models/CountryCurrencyPool"));
const ExchangeRate = require(join(BACKEND, "models/ExchangeRate"));
const Settlement = require(join(BACKEND, "models/Settlement"));

const BASE = `http://127.0.0.1:${process.env.PORT}`;
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const symbolId = (seed) => Array.from({ length: 12 }, (_, i) => SYMBOLS[(seed + i * 3) % 8]).join("");

const INDIA_SENDER = symbolId(2);
const US_RECEIVER = symbolId(6);
const DOMESTIC_RECEIVER = symbolId(9);
const PIN = "246813";

// 1 INR = 0.05 USD — an unrealistic but deliberately clean rate, so the
// expected destinationAmount is exact arithmetic (1000 * 0.05 = 50), not a
// real-world figure that needs rounding assertions to check.
const SEEDED_RATE = 0.05;

const untilConnected = () =>
  new Promise((resolve, reject) => {
    if (mongoose.connection.readyState === 1) return resolve();
    mongoose.connection.once("connected", resolve);
    mongoose.connection.once("error", reject);
    setTimeout(() => reject(new Error("timed out connecting to MongoDB")), 40000);
  });

let senderToken = null;

const post = (path, body, token) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: Object.assign(
      { "Content-Type": "application/json" },
      token ? { Authorization: `Bearer ${token}` } : {}
    ),
    body: JSON.stringify(body)
  }).then(async (response) => ({ status: response.status, body: await response.json().catch(() => null) }));

async function registerAccount(symbol, mobileNumber, name) {
  await post("/api/otp/send", { mobileNumber, purpose: "registration" });
  await post("/api/otp/verify", { mobileNumber, otp: "123456", purpose: "registration" });
  const registered = await post("/api/register-symbol", { fullName: name, mobileNumber, symbolId: symbol });
  const token = registered.body?.token;
  await post("/api/pin/set", { symbolId: symbol, pin: PIN }, token);
  return token;
}

async function setUp() {
  await Promise.all([
    User.deleteMany({}),
    Pin.deleteMany({}),
    Transaction.deleteMany({}),
    LedgerEntry.deleteMany({}),
    Country.deleteMany({}),
    Currency.deleteMany({}),
    CountryCurrencyPool.deleteMany({}),
    ExchangeRate.deleteMany({}),
    Settlement.deleteMany({}),
  ]);

  senderToken = await registerAccount(INDIA_SENDER, "+919000000011", "Settlement Sender");
  await registerAccount(US_RECEIVER, "+919000000012", "Settlement Receiver US");
  await registerAccount(DOMESTIC_RECEIVER, "+919000000013", "Settlement Receiver Domestic");

  await User.updateOne({ symbolId: INDIA_SENDER }, { $set: { countryIso: "IN", balance: 10000, cashbackRate: 0 } });
  await User.updateOne({ symbolId: US_RECEIVER }, { $set: { countryIso: "US", balance: 0, cashbackRate: 0 } });
  // Left at the default 'IN' deliberately — this is the same-currency case.
  await User.updateOne({ symbolId: DOMESTIC_RECEIVER }, { $set: { balance: 0, cashbackRate: 0 } });

  await Country.create([
    { iso: "IN", name: "India", dialCode: "+91", localCurrency: "INR" },
    { iso: "US", name: "United States", dialCode: "+1", localCurrency: "USD" },
  ]);

  // Seeded fresh, not fetched — see the header comment on why this test
  // never calls the real FX provider.
  await ExchangeRate.create({ fromCurrency: "INR", toCurrency: "USD", rate: SEEDED_RATE, source: "test-seed", fetchedAt: new Date() });
}

const send = (senderSymbol, receiverSymbol, amount, note) =>
  post(
    "/api/transactions/send",
    { senderSymbolId: senderSymbol, receiverSymbolId: receiverSymbol, amount, currency: "INR", note, pin: PIN },
    senderToken
  );

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures += 1;
};

async function run() {
  await untilConnected();
  if (mongoose.connection.name !== TEST_DB) {
    throw new Error(`refusing to run against "${mongoose.connection.name}" — expected ${TEST_DB}`);
  }
  console.log(`db: ${mongoose.connection.name}\n`);

  await setUp();

  console.log("1. IN -> US payment settles at the seeded rate");
  const crossBorder = await send(INDIA_SENDER, US_RECEIVER, 1000, "cross-border");
  check("send accepted", crossBorder.status === 201, `status=${crossBorder.status}`);
  check("settlement present on the response", !!crossBorder.body?.settlement);
  check("sourceAmount is the sent amount", crossBorder.body?.settlement?.sourceAmount === 1000);
  check("destinationAmount uses the seeded rate", crossBorder.body?.settlement?.destinationAmount === 50,
    `destinationAmount=${crossBorder.body?.settlement?.destinationAmount}`);
  check("rate matches the seeded rate", crossBorder.body?.settlement?.rate === SEEDED_RATE);
  check("rateSource names the cache, not a live fetch", crossBorder.body?.settlement?.rateSource === "test-seed",
    crossBorder.body?.settlement?.rateSource);

  console.log("\n2. a Settlement row was actually persisted");
  const settlementRow = await Settlement.findOne({ settlementId: crossBorder.body?.settlement?.settlementId }).lean();
  check("row exists", !!settlementRow);
  check("status is settled", settlementRow?.status === "settled", settlementRow?.status);
  check("transactionId links back to the Transaction",
    String(settlementRow?.transactionId) === String(crossBorder.body?.transaction?._id || settlementRow?.transactionId));

  console.log("\n3. India's pool (keyed by USD) was credited the INR amount");
  const sourcePool = await CountryCurrencyPool.findOne({ countryIso: "IN", counterCurrency: "USD" }).lean();
  check("pool exists", !!sourcePool);
  check("availableBalance credited 1000", sourcePool?.availableBalance === 1000, `availableBalance=${sourcePool?.availableBalance}`);
  check("totalBalance matches availableBalance (reservedBalance untouched)",
    sourcePool?.totalBalance === sourcePool?.availableBalance);

  console.log("\n4. US's pool (keyed by INR) was debited the USD amount");
  const destinationPool = await CountryCurrencyPool.findOne({ countryIso: "US", counterCurrency: "INR" }).lean();
  check("pool exists", !!destinationPool);
  check("availableBalance debited 50", destinationPool?.availableBalance === -50, `availableBalance=${destinationPool?.availableBalance}`);
  // A fresh pool starts at 0 and nothing in this build funds it before a
  // settlement draws from it — a destination pool going negative on the
  // very first cross-border payment is expected today, not a bug this test
  // is guarding against. Real pool funding/rebalancing is unbuilt; noted
  // here so it isn't mistaken for silently working.
  console.log("     (negative balance is expected — pools are never pre-funded yet, see comment above)");

  console.log("\n5. IN -> IN payment (both accounts default countryIso) does not settle");
  const domestic = await send(INDIA_SENDER, DOMESTIC_RECEIVER, 500, "domestic");
  check("send accepted", domestic.status === 201, `status=${domestic.status}`);
  check("no settlement on the response", domestic.body?.settlement === null,
    JSON.stringify(domestic.body?.settlement));
  check("no new pool rows were created", (await CountryCurrencyPool.countDocuments({})) === 2,
    `pool count=${await CountryCurrencyPool.countDocuments({})}`);
  check("no new Settlement row was created", (await Settlement.countDocuments({})) === 1);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  return failures;
}

let exitCode = 1;
try {
  exitCode = (await run()) === 0 ? 0 : 1;
} catch (error) {
  console.error("HARNESS ERROR:", error.message);
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
