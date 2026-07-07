import { describe, it, expect, beforeEach } from "vitest";
import { buildReferralLink, readReferralCodeFromUrl, REFERRAL_QUERY_PARAM } from "./referralLink";

describe("buildReferralLink", () => {
  it("builds a URL on the current origin carrying the referral code", () => {
    const link = buildReferralLink("US1++++++++++++");
    const url = new URL(link);
    expect(url.origin).toBe(window.location.origin);
    expect(url.searchParams.get(REFERRAL_QUERY_PARAM)).toBe("US1++++++++++++");
  });

  it("URL-encodes special characters in the referral code", () => {
    const link = buildReferralLink("has space+plus");
    const url = new URL(link);
    expect(url.searchParams.get(REFERRAL_QUERY_PARAM)).toBe("has space+plus");
  });
});

describe("readReferralCodeFromUrl", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("returns null when no referral code is present", () => {
    expect(readReferralCodeFromUrl()).toBeNull();
  });

  it("reads a referral code from the current URL's query string", () => {
    window.history.replaceState({}, "", `/?${REFERRAL_QUERY_PARAM}=US1234`);
    expect(readReferralCodeFromUrl()).toBe("US1234");
  });
});
