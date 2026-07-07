import { describe, it, expect } from "vitest";
import { hashSeed, ensureScanSafeDark, MOCK_generateSessionToken, QR_TTL_SECONDS } from "../lib/qr";

describe("hashSeed", () => {
  it("is deterministic — same input always produces the same sequence", () => {
    const a = hashSeed("test-token-123");
    const b = hashSeed("test-token-123");
    // Pull several values from each independent generator instance and
    // confirm they match step-for-step — this determinism is what lets the
    // QR fade between "old pattern" and "new pattern" using the same seed.
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces a different sequence for a different seed string", () => {
    const a = hashSeed("token-a");
    const b = hashSeed("token-b");
    expect(a()).not.toBe(b());
  });

  it("always returns values in the [0, 1) range", () => {
    const rand = hashSeed("range-check");
    for (let i = 0; i < 50; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("ensureScanSafeDark", () => {
  it("leaves an already-dark color unchanged", () => {
    expect(ensureScanSafeDark("#15132A")).toBe("#15132A");
  });

  it("darkens a light color below the max-lightness threshold", () => {
    const result = ensureScanSafeDark("#F59E0B", 0.4);
    // Parse the result back to confirm it's actually darker, not just a
    // different string — this is the property that matters for real QR
    // scan reliability, not the exact hex value.
    const toLightness = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    };
    expect(toLightness(result)).toBeLessThanOrEqual(0.41); // small epsilon for rounding
    expect(toLightness(result)).toBeLessThan(toLightness("#F59E0B"));
  });
});

describe("MOCK_generateSessionToken", () => {
  it("returns a token bound to the given globalId with a future expiry", async () => {
    const before = Date.now();
    const session = await MOCK_generateSessionToken("US1++++++++++++");
    expect(session.globalId).toBe("US1++++++++++++");
    expect(session.token).toContain("."); // payload.signature shape
    expect(session.expiresAt).toBeGreaterThan(before);
    expect(session.expiresAt - before).toBeLessThanOrEqual(QR_TTL_SECONDS * 1000 + 1000);
  });

  it("produces a different token on each call (never replays the same credential)", async () => {
    const first = await MOCK_generateSessionToken("US1++++++++++++");
    const second = await MOCK_generateSessionToken("US1++++++++++++");
    expect(first.token).not.toBe(second.token);
  });
});
