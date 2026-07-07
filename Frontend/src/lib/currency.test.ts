import { describe, it, expect } from "vitest";
import { convert, fmt, RATES } from "../lib/currency";

describe("convert", () => {
  it("returns the same amount when converting a currency to itself", () => {
    expect(convert("100", "USD", "USD")).toBeCloseTo(100);
  });

  it("converts using the EUR-relative rate table", () => {
    // 100 EUR -> USD should be exactly 100 * RATES.USD given RATES.EUR is
    // the 1.0 anchor point every other rate is relative to.
    expect(convert("100", "EUR", "USD")).toBeCloseTo(100 * RATES.USD);
  });

  it("round-trips through a third currency without drifting", () => {
    const original = 250;
    const toJpy = convert(String(original), "USD", "JPY");
    const back = convert(String(toJpy), "JPY", "USD");
    expect(back).toBeCloseTo(original, 5);
  });

  it("returns 0 for a non-numeric amount instead of NaN", () => {
    expect(convert("not-a-number", "USD", "EUR")).toBe(0);
  });

  it("returns 0 for an empty string", () => {
    expect(convert("", "USD", "EUR")).toBe(0);
  });
});

describe("fmt", () => {
  it("always shows exactly 2 decimal places", () => {
    expect(fmt(5)).toBe("5.00");
    expect(fmt(5.1)).toBe("5.10");
    expect(fmt(5.999)).toBe("6.00");
  });

  it("adds thousands separators", () => {
    expect(fmt(12480.5)).toBe("12,480.50");
  });
});
