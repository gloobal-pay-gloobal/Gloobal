// Seed Country and Currency from data/countryCurrencyMap.js and the
// frontend's registration country list — the reference data the
// multi-currency pool work depends on, but that nothing before it ever
// wrote to Mongo.
//
//   node scripts/seed-countries-currencies.mjs              dry run
//   node scripts/seed-countries-currencies.mjs --execute    writes
//
// Idempotent: every write is an upsert keyed on iso / code, so running
// this again after Frontend's country list changes only touches the rows
// that actually differ (a name correction, a currency reassignment) —
// existing pools and settlements that reference a country/currency by its
// code are untouched either way, since neither is ever renamed here, only
// added.
//
// This does NOT create any CountryCurrencyPool rows. Pools are created
// lazily by CountryCurrencyPool.loadOrCreate() the first time a country
// actually needs to settle in a given counterpart currency — see that
// model's header comment for why pre-materializing all 194 x up to 141
// combinations here would be over 27,000 rows nothing will ever touch.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(BACKEND, "server.js"));

require("dotenv").config({ path: join(BACKEND, ".env"), quiet: true });

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is not set — this script needs Backend/.env.");
  process.exit(1);
}

const EXECUTE = process.argv.includes("--execute");

const mongoose = require("mongoose");
const Country = require(join(BACKEND, "models/Country"));
const Currency = require(join(BACKEND, "models/Currency"));
const { COUNTRY_CURRENCY, buildCurrencyMaster } = require(join(BACKEND, "data/countryCurrencyMap"));

// The exact 194-entry list from Frontend's backend/data/countries.js
// (TOP_COUNTRIES + REST_COUNTRIES), inlined here rather than imported —
// Backend and Frontend are separate deploys with no shared module
// boundary between them, so this is a deliberate copy, not a reference.
// If that list ever changes, re-run this script with the updated array.
const FRONTEND_COUNTRIES = require(join(BACKEND, "data/frontendCountryList.json"));

async function main() {
  console.log(EXECUTE ? "Running LIVE (--execute) — this writes to Mongo." : "Dry run — pass --execute to write.");

  const missingCurrency = FRONTEND_COUNTRIES.filter((c) => !COUNTRY_CURRENCY[c.iso]);
  if (missingCurrency.length) {
    console.error(`countryCurrencyMap.js is missing ${missingCurrency.length} ISO code(s): ${missingCurrency.map((c) => c.iso).join(", ")}`);
    process.exit(1);
  }

  const currencyMaster = buildCurrencyMaster();
  const countryDocs = FRONTEND_COUNTRIES.map((c) => ({
    iso: c.iso,
    name: c.name,
    dialCode: c.dial,
    localCurrency: COUNTRY_CURRENCY[c.iso],
  }));

  console.log(`Countries to upsert: ${countryDocs.length}`);
  console.log(`Currencies to upsert: ${currencyMaster.length}`);

  if (!EXECUTE) {
    console.log("\nSample country rows:");
    console.table(countryDocs.slice(0, 5));
    console.log("\nSample currency rows:");
    console.table(currencyMaster.slice(0, 5));
    console.log("\nDry run only — nothing written. Re-run with --execute to apply.");
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const currencyWrites = currencyMaster.map((row) => ({
    updateOne: {
      filter: { code: row.code },
      update: { $set: row },
      upsert: true,
    },
  }));
  const currencyResult = await Currency.bulkWrite(currencyWrites, { ordered: false });
  console.log(`Currency: ${currencyResult.upsertedCount} inserted, ${currencyResult.modifiedCount} updated.`);

  const countryWrites = countryDocs.map((row) => ({
    updateOne: {
      filter: { iso: row.iso },
      update: { $set: row },
      upsert: true,
    },
  }));
  const countryResult = await Country.bulkWrite(countryWrites, { ordered: false });
  console.log(`Country: ${countryResult.upsertedCount} inserted, ${countryResult.modifiedCount} updated.`);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
