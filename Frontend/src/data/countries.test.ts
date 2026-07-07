import { describe, it, expect } from "vitest";
import { countryMatches, isoToFlag, ALL_COUNTRIES, COUNTRY_BY_ISO } from "./countries";

describe("isoToFlag", () => {
  it("converts a 2-letter ISO code to the matching flag emoji", () => {
    expect(isoToFlag("US")).toBe("🇺🇸");
    expect(isoToFlag("gb")).toBe("🇬🇧"); // lowercase input still works
  });
});

describe("countryMatches", () => {
  const usa = { name: "United States", iso: "US", dialCode: "+1", flag: "🇺🇸" };

  it("matches an empty query (shows everything)", () => {
    expect(countryMatches(usa, "")).toBe(true);
    expect(countryMatches(usa, "   ")).toBe(true);
  });

  it("matches by partial, case-insensitive name", () => {
    expect(countryMatches(usa, "unit")).toBe(true);
    expect(countryMatches(usa, "STATES")).toBe(true);
  });

  it("matches by dial code", () => {
    expect(countryMatches(usa, "+1")).toBe(true);
  });

  it("does not match an unrelated query", () => {
    expect(countryMatches(usa, "germany")).toBe(false);
    expect(countryMatches(usa, "+49")).toBe(false);
  });
});

describe("ALL_COUNTRIES / COUNTRY_BY_ISO", () => {
  it("has no duplicate ISO codes across the combined list", () => {
    const isoCodes = ALL_COUNTRIES.map((c) => c.iso);
    expect(new Set(isoCodes).size).toBe(isoCodes.length);
  });

  it("indexes every country from ALL_COUNTRIES by its ISO code", () => {
    for (const country of ALL_COUNTRIES) {
      expect(COUNTRY_BY_ISO[country.iso]).toEqual(country);
    }
  });
});
