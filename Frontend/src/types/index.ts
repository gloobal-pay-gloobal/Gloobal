// ---------------------------------------------------------------------------
// Shared types used across multiple files. Single source of truth — other
// files import from here rather than each redeclaring their own shape for
// the same data (that's how three slightly-different "Country" shapes were
// starting to creep in before this pass).
// ---------------------------------------------------------------------------

/** A country entry from the registration country picker / dial-code list. */
export interface Country {
  name: string;
  iso: string;
  dialCode: string;
  flag: string;
}

/** Alias kept for readability at call sites where "the user's chosen
 * country" reads better than the generic "Country" — same shape. */
export type DialCountry = Country;

export type RegistrationStage =
  | "login"
  | "loginPin"
  | "phone"
  | "otp"
  | "secureId"
  | "referral"
  | "pin"
  | "deviceAuth"
  | "dashboard";
export type ActiveScreen = "send" | "bank" | "coverage" | "receive" | null;

/** A dial symbol shape used to mask a flag in the ambient particle
 * background (+, -, ×, =) or a plain circle/square chip. */
export type FlagSign = "circle" | "square" | "+" | "-" | "×" | "=";

/** One of the 8 Secure ID / Referral ID dial symbols. */
export type DialSymbol = "−" | "+" | "×" | "=" | "○" | "□" | "●" | "■";

/** A bank entry as shown in Add Bank / Link Account. `logo` is a Clearbit
 * logo-API URL (or null, in which case BankAvatar falls back to a colored
 * initials tile) — never a stored image. */
export interface Bank {
  id: string;
  name: string;
  initials: string;
  color: string;
  logo: string | null;
  phone: string;
  isGloobal?: boolean;
}

/** Sender profile passed into SendMoneyScreen — deliberately narrow (only
 * what that screen actually reads), not the full app state. */
export interface SenderProfile extends Country {
  phoneNumber: string;
  symbolId?: string;
  fullName?: string;
}

/** A short-lived QR session token bound to a permanent Global ID — see
 * lib/qr.ts for the full mint/rotation model. */
export interface SessionToken {
  token: string;
  expiresAt: number;
  globalId: string;
}
