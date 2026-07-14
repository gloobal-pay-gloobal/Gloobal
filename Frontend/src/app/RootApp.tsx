import React, { Suspense, useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { phoneSchema } from "../screens/registration/phoneSchema";
import { FloatingFlagBackground } from "../components/ambient/FloatingFlagBackground";
import { MaskEyeIcon, SubmitButton, SymbolChipRow } from "../components/common/FormPrimitives";
import { PinDialPad, SymbolDialPad } from "../components/dial/SymbolDial";
import { ALL_COUNTRIES, TOP_COUNTRIES, COUNTRY_BY_ISO } from "../data/countries";
import { CountryPickerScreen } from "../screens/registration/CountryPickerScreen";
import { PhoneConnector } from "../screens/registration/PhoneEntryForm";
import { PinScreen } from "../screens/registration/PinScreen";
import { T } from "../styles/theme";
import { commandBus } from "./commandBus";
import { login, register, resolveUser, sendOtp, verifyOtp, setPin as apiSetPin, type BackendUser } from "../services/api/authApi";
import { ApiError } from "../services/httpClient";
import { OtpVerifyScreen } from "../screens/registration/OtpVerifyScreen";
import { DeviceVerificationScreen } from "../screens/registration/DeviceVerificationScreen";
import { saveSession, loadSession, clearSession, saveCountryPreference, loadCountryPreference } from "./sessionPersistence";
import { useSessionLock } from "./useSessionLock";
import { useBackNavigation } from "./useBackNavigation";
import { readReferralCodeFromUrl, shareReferralLink } from "./referralLink";
import { featureRegistry } from "./featureRegistry";
import globalIdLogo from "../assets/globalid-logo.png";
import { ErrorBoundary } from "./ErrorBoundary";
import { ScreenFallback } from "../components/common/ScreenFallback";
import type { RegistrationStage, ActiveScreen, DialCountry } from "../types";
import "./featureManifest";

// Combines the chosen country's dial code with the typed national number
// into the string the backend's normalizeMobileNumber helper expects.
// India gets the explicit 10-digit -> +91XXXXXXXXXX shortcut since that's
// the backend's primary documented case; everything else falls back to
// dialCode + digits.
function normalizeMobileForApi(dialCountry: DialCountry, phoneNumber: string): string {
  const raw = String(phoneNumber || "").trim();
  if (raw.startsWith("+")) return raw.replace(/[\s-]/g, "");
  const digits = raw.replace(/\D/g, "");
  if (dialCountry.iso === "IN" && digits.length === 10) return `+91${digits}`;
  return `${dialCountry.dialCode}${digits}`;
}

// Dashboard/Send/Bank/Coverage/Receive are no longer imported eagerly —
// they're pulled from the Feature Registry instead (featureManifest.ts's
// registrations, each a real `lazy(() => import(...))`). This is the
// change App.tsx's comment block used to flag as "not yet real": before
// this, RootApp statically imported all five screens up front, so every
// one of them shipped in the initial bundle regardless of whether that
// session ever opened Send Money or Global Coverage. Now each is its own
// chunk, fetched only the first time its stage/activeScreen is reached.
// The registry keys below must match featureManifest.ts's `key` values.
const DashboardScreen = featureRegistry.get("dashboard")!.Component;
const SendMoneyScreen = featureRegistry.get("send")!.Component;
const AddBankScreen = featureRegistry.get("banking")!.Component;
const GlobalCoverageScreen = featureRegistry.get("coverage")!.Component;
const ReceiveScreen = featureRegistry.get("receive")!.Component;


export function RootApp() {
  const [verifying, setVerifying] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  // Default landing screen is registration (phone entry), matching the
  // founder video — Login is one tap away via "Already have a Global ID?"
  // on the phone screen, not the default. A restored dashboard session
  // (see the loadSession effect below) still overrides this on mount.
  const [stage, setStage] = useState<RegistrationStage>("phone");
  const [flipping, setFlipping] = useState(false);
  const [loginSecureId, setLoginSecureId] = useState("");
  const [loginRevealed, setLoginRevealed] = useState(false);
  const [loginPin, setLoginPin] = useState("");
  // Login accepts either a Secure ID (dial pad, unchanged) or a mobile
  // number — resolved to the owning Secure ID via the existing
  // GET /api/users/resolve endpoint (already used by Send Money's
  // recipient lookup) before falling into the same loginPin step either
  // way. No backend change needed.
  const [loginMethod, setLoginMethod] = useState<"secureId" | "mobile">("secureId");
  const [loginMobileNumber, setLoginMobileNumber] = useState("");
  // Deliberately separate from `verifying`: that flag also drives the
  // Secure ID Log In button, OTP send, etc. Sharing one flag meant
  // switching from the Mobile Number tab back to Secure ID while a lookup
  // was still in flight left the whole login UI stuck on "Logging in…"
  // until the unrelated mobile request settled (caught in manual testing).
  const [resolvingMobile, setResolvingMobile] = useState(false);
  // Read inside the async handler below, after the `await` — state
  // captured by the closure at call time would still show "mobile"/"login"
  // even if the person has since switched tabs or left the login stage
  // entirely, so a slow, abandoned lookup could silently hijack whatever
  // they're doing by then (also caught in manual testing).
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const loginMethodRef = useRef(loginMethod);
  loginMethodRef.current = loginMethod;
  const [secureId, setSecureId] = useState("");
  // Live availability check against the real backend while the person is
  // picking their Secure ID — see the debounced effect below. This is a
  // UX nicety only: the backend's own duplicate checks in /api/register-symbol
  // (plus the unique index on User.symbolId) are the actual source of
  // truth and still run at submit time regardless of what this shows.
  const [secureIdCheck, setSecureIdCheck] = useState<"idle" | "checking" | "available" | "taken" | "error">("idle");
  const [referralCode, setReferralCode] = useState("");
  const [referralFieldError, setReferralFieldError] = useState<string | null>(null);
  // Live referral-code check against the real backend, mirroring the Secure
  // ID availability check below but with the opposite meaning: a referral
  // code is only valid if it belongs to an *existing* user (unlike Secure
  // ID, where existing means taken). "checking"/"invalid" block Submit;
  // "error" (network hiccup / cold backend) does not — this is only a
  // convenience check, not a real guard (register-symbol itself just
  // ignores an unrecognized referredBy rather than rejecting it).
  const [referralCheck, setReferralCheck] = useState<"idle" | "checking" | "valid" | "invalid" | "error">("idle");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  // Resend cooldown: a plain epoch-ms deadline rather than a live ticking
  // countdown here — OtpVerifyScreen owns turning this into "Resend in Ns"
  // itself so this component doesn't need a per-second re-render.
  const [otpResendAvailableAt, setOtpResendAvailableAt] = useState<number | null>(null);
  const [otpResending, setOtpResending] = useState(false);
  const OTP_RESEND_COOLDOWN_MS = 30_000;
  const [registeredMobile, setRegisteredMobile] = useState("");
  // The account as the real backend knows it, once registration or login
  // has actually succeeded — symbolId here is the source of truth for
  // every screen downstream (Dashboard, Send Money, Receive), not the
  // fake dialCountry-derived tag this replaced.
  const [registeredUser, setRegisteredUser] = useState<BackendUser | null>(null);
  // The single source of truth for the user's country, chosen once via the
  // country picker during registration (the "phone" stage below). Every
  // other screen — dashboard, Global ID, Send Money, Add Bank, Global
  // Coverage — reads this same value instead of asking again. The picker
  // itself is only reachable while stage === "phone", so once registration
  // is complete this is effectively locked until a future settings screen
  // explicitly offers to change it.
  //
  // Defaults to whatever was last picked (see saveCountryPreference in
  // sessionPersistence.ts), not always India — otherwise every fresh PWA
  // open/logout silently reset this to India, and anyone outside India
  // using the Mobile Number login tab without re-picking their flag got
  // their number prefixed +91 instead of their real country code, which
  // then 404s the resolve lookup and reads as "Secure ID not found" even
  // for a genuinely registered account.
  const [dialCountry, setDialCountry] = useState<DialCountry>(
    () => COUNTRY_BY_ISO[loadCountryPreference() || ""] || COUNTRY_BY_ISO.IN || TOP_COUNTRIES[0]
  );
  // Real form validation via react-hook-form + zod (see phoneSchema.ts)
  // instead of the inline `digits.length < 6` check this replaced.
  // PhoneConnector itself stays a plain controlled component — it doesn't
  // need to know a validation library exists — this just bridges RHF's
  // field state into the same `phoneNumber` / `onChangePhone` props it
  // already expected.
  const {
    handleSubmit: handlePhoneSubmit,
    setValue: setPhoneFormValue,
    watch: watchPhoneForm,
    reset: resetPhoneForm,
    formState: { errors: phoneErrors, isSubmitted: phoneSubmitted },
  } = useForm<{ phoneNumber: string }>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: "" },
  });
  const phoneNumber = watchPhoneForm("phoneNumber");
  const setPhoneNumber = (v: string) => setPhoneFormValue("phoneNumber", v, { shouldValidate: phoneSubmitted });
  const [showPicker, setShowPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>(null); // null | "send" | "bank" | "coverage" | "receive"
  // Whether the entered Secure ID / Referral ID symbols are shown in the
  // clear or masked as dots — toggled by the eye button next to each.
  const [secureIdRevealed, setSecureIdRevealed] = useState(false);
  const [referralRevealed, setReferralRevealed] = useState(false);

  const SECURE_ID_LENGTH = 12;
  const REFERRAL_LENGTH = 12;
  const PIN_LENGTH = 6;
  const OTP_LENGTH = 4;

  // The person's one permanent Global ID — real symbolId from the backend
  // once registration or login has succeeded, falling back to whatever's
  // currently in the dial pad so the UI has something to show mid-flow.
  // Also doubles as their own shareable referral code (see referralLink.ts).
  const globalIdTag = registeredUser?.symbolId || loginSecureId || secureId;

  // If this app was opened via someone else's shared referral link
  // (?ref=...), prefill the referral code field with it — runs once on
  // mount only; it should never overwrite something the person is
  // actively typing into that field later in the session.
  useEffect(() => {
    const refFromUrl = readReferralCodeFromUrl();
    if (refFromUrl) setReferralCode(refFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live Secure ID availability check: the moment a full 12-symbol code is
  // dialed in, ask the real backend (via the existing /api/users/resolve
  // lookup — no new endpoint needed) whether it's already taken, instead of
  // only finding out after Referral/PIN at final submit. 404 means nobody
  // has it (available); a resolved user means it's taken; anything else
  // (network hiccup, cold Render backend) is left as "error" and doesn't
  // block continuing — /api/register-symbol's own duplicate checks and the
  // unique index on User.symbolId are still the real, final guard.
  useEffect(() => {
    if (stage !== "secureId" || secureId.length !== SECURE_ID_LENGTH) {
      setSecureIdCheck("idle");
      return;
    }
    let cancelled = false;
    setSecureIdCheck("checking");
    const timer = setTimeout(() => {
      resolveUser(secureId)
        .then(() => {
          if (!cancelled) setSecureIdCheck("taken");
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.status === 404) setSecureIdCheck("available");
          else setSecureIdCheck("error");
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [secureId, stage]);

  // Live referral-code check: the moment a full 12-symbol code is dialed
  // in on the Referral step, ask the real backend (the same
  // /api/users/resolve lookup the Secure ID check above already uses)
  // whether it actually belongs to someone. 404 means nobody has it
  // (invalid); a resolved user means it's real (valid); anything else
  // (network hiccup, cold Render backend) is left as "error" and doesn't
  // block continuing.
  useEffect(() => {
    if (stage !== "referral" || referralCode.length !== REFERRAL_LENGTH) {
      setReferralCheck("idle");
      return;
    }
    let cancelled = false;
    setReferralCheck("checking");
    const timer = setTimeout(() => {
      resolveUser(referralCode)
        .then(() => {
          if (!cancelled) setReferralCheck("valid");
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.status === 404) setReferralCheck("invalid");
          else setReferralCheck("error");
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [referralCode, stage]);

  // Restores wherever the person left off on the dashboard after a page
  // refresh or PWA relaunch, instead of dropping them back to the login
  // screen every time. Deliberately narrow: only ever restores TO the
  // dashboard (never mid-registration — resuming a half-typed Secure ID
  // after an unexplained refresh is more confusing than just starting that
  // step over), and only runs once on mount. Does NOT restore `secureId` —
  // see sessionPersistence.ts for why that's never written to storage in
  // the first place.
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.stage === "dashboard" && saved.symbolId) {
      const country = COUNTRY_BY_ISO[saved.dialCountryIso];
      if (country) setDialCountry(country);
      if (saved.phoneNumber) setPhoneFormValue("phoneNumber", saved.phoneNumber);
      setRegisteredUser({ symbolId: saved.symbolId, fullName: saved.fullName });
      setStage("dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps the persisted session in sync with the live one — cheap to write
  // on every relevant change since sessionStorage writes are synchronous
  // and small. symbolId/fullName are only ever included once stage is
  // actually "dashboard" — see sessionPersistence.ts's PersistedSession
  // note for why that's the one point this stops being "someone's still
  // mid-typing a credential."
  useEffect(() => {
    saveSession({
      stage,
      dialCountryIso: dialCountry.iso,
      phoneNumber,
      symbolId: stage === "dashboard" ? registeredUser?.symbolId : undefined,
      fullName: stage === "dashboard" ? registeredUser?.fullName : undefined,
    });
  }, [stage, dialCountry, phoneNumber, registeredUser]);

  // Long-lived country preference (localStorage, survives logout/app close)
  // — separate from the sessionStorage save above, which only restores
  // dialCountry for an already-dashboard session. See the state init above
  // and sessionPersistence.ts for why this exists.
  useEffect(() => {
    saveCountryPreference(dialCountry.iso);
  }, [dialCountry]);

  // App lock: only meaningful once actually authenticated (dashboard) —
  // see useSessionLock.ts for the backgrounding-threshold logic.
  // Purely a loading-state affordance: `verifying` covers every real
  // network call in the login/registration flow, all of which can hit a
  // cold Render backend. Rather than sitting on a bare spinner for up to
  // LOGIN_TIMEOUT_MS with no explanation, surface a plain-language reason
  // once it's been running long enough to plausibly be a cold start rather
  // than a normal round trip.
  const [showSlowHint, setShowSlowHint] = useState(false);
  useEffect(() => {
    if (!verifying && !resolvingMobile) {
      setShowSlowHint(false);
      return;
    }
    const timer = setTimeout(() => setShowSlowHint(true), 5000);
    return () => clearTimeout(timer);
  }, [verifying, resolvingMobile]);
  const slowHintText = "Still connecting — the server may be waking up (can take up to 30s).";

  const { locked, unlock } = useSessionLock({ enabled: stage === "dashboard" });
  const [unlockPin, setUnlockPin] = useState("");
  const handleUnlock = () => {
    if (unlockPin.length !== PIN_LENGTH) return;
    setUnlockPin("");
    unlock();
  };

  // Flips the card to the next face: rotate on edge, swap the content once
  // it's edge-on (so nothing appears mirrored), then rotate back to flat.
  const flipTo = (next: RegistrationStage) => {
    setFlipping(true);
    setTimeout(() => {
      setStage(next);
      setFlipping(false);
    }, 220);
  };

  // Secure ID itself doesn't register with the backend yet — referral (or
  // skipping it) is what actually calls /api/register-symbol, since
  // referredBy needs the referral field's final value either way. Blocked
  // here on the live availability check (see the debounced effect above)
  // finding this code already taken; "checking"/"idle" also block so a
  // fast tap can't outrun the in-flight lookup. "error" (network hiccup)
  // does NOT block — register-symbol's own duplicate check is the real
  // guard regardless of what this pre-check managed to confirm.
  const handleSubmitSecureId = () => {
    if (secureId.length !== SECURE_ID_LENGTH) return;
    if (secureIdCheck === "checking" || secureIdCheck === "taken") return;
    flipTo("referral");
  };

  // Shared by the Referral submit button and "Skip for now" — real
  // POST /api/register-symbol call, once, right after the referral step
  // either way (referredBy just ends up empty on skip).
  const registerAndAdvance = async (referredByValue: string) => {
    if (registering) return;
    setRegisterError(null);
    setRegistering(true);
    try {
      const result = await register({
        fullName: "Gloobal User",
        mobileNumber: registeredMobile,
        symbolId: secureId,
        referredBy: referredByValue || undefined,
      });
      setRegisteredUser(result.user);
      setRegistering(false);
      flipTo("pin");
    } catch (err) {
      setRegistering(false);
      setRegisterError(err instanceof Error ? err.message : "Couldn't create your Global ID. Try again.");
    }
  };

  // Referral is optional: empty just continues like Skip. A partial code
  // (started typing, didn't finish) shows validation instead of silently
  // doing nothing — previously the Submit button just stayed disabled with
  // no feedback, which read as "broken" to anyone who'd typed a few symbols.
  const handleSubmitReferral = () => {
    if (registering) return;
    setReferralFieldError(null);
    if (referralCode.length === 0) {
      registerAndAdvance("");
      return;
    }
    if (referralCode.length !== REFERRAL_LENGTH) {
      setReferralFieldError(`Enter all ${REFERRAL_LENGTH} symbols, or leave blank to skip.`);
      return;
    }
    if (referralCheck === "checking") return;
    if (referralCheck === "invalid") {
      setReferralFieldError("This referral ID doesn't exist — check it, or leave blank to skip.");
      return;
    }
    registerAndAdvance(referralCode);
  };

  const handleSkipReferral = () => {
    if (registering) return;
    setReferralFieldError(null);
    registerAndAdvance("");
  };

  // Real PIN set: POST /api/pin/set against the symbolId the backend
  // actually returned from register-symbol (falls back to the locally
  // typed secureId if that response was ever missing a user object).
  const handleSubmitPin = async () => {
    if (pin.length !== PIN_LENGTH || registering) return;
    setRegisterError(null);
    setRegistering(true);
    try {
      const symbolIdForPin = registeredUser?.symbolId || secureId;
      await apiSetPin(symbolIdForPin, pin);
      setRegistering(false);
      flipTo("deviceAuth");
    } catch (err) {
      setRegistering(false);
      setRegisterError(err instanceof Error ? err.message : "Couldn't set your PIN. Try again.");
    }
  };

  // Secure ID entry on the login card just advances to a PIN step now —
  // real POST /api/login needs both, collected together in handleLoginPin.
  const handleLogin = () => {
    if (verifying || stage !== "login") return;
    if (loginSecureId.length !== SECURE_ID_LENGTH) return;
    setLoginError(null);
    flipTo("loginPin");
  };

  // Mobile-number login: resolves the typed number to its owning Secure ID
  // via /api/users/resolve, then continues into the exact same loginPin
  // step the Secure ID path uses — from there on, the two paths are
  // identical.
  const handleLoginWithMobile = async () => {
    if (resolvingMobile || stage !== "login") return;
    const digits = loginMobileNumber.replace(/\D/g, "");
    if (digits.length < 6) return;
    setLoginError(null);
    setResolvingMobile(true);
    try {
      const identifier = normalizeMobileForApi(dialCountry, loginMobileNumber);
      const resolved = await resolveUser(identifier);
      setResolvingMobile(false);
      // Abandoned if the person switched tabs or left the login stage
      // while this was in flight — don't act on a stale result.
      if (loginMethodRef.current !== "mobile" || stageRef.current !== "login") return;
      setLoginSecureId(resolved.symbolId);
      flipTo("loginPin");
    } catch (err) {
      setResolvingMobile(false);
      if (loginMethodRef.current !== "mobile" || stageRef.current !== "login") return;
      setLoginError(err instanceof Error ? err.message : "No Global ID found for that mobile number.");
    }
  };

  const handleLoginPin = async () => {
    if (loginPin.length !== PIN_LENGTH || verifying) return;
    setLoginError(null);
    setVerifying(true);
    try {
      const result = await login(loginSecureId, loginPin);
      setRegisteredUser(result.user);
      setVerifying(false);
      flipTo("deviceAuth");
    } catch (err) {
      setVerifying(false);
      setLoginError(err instanceof Error ? err.message : "That Secure ID or PIN wasn't recognized.");
    }
  };

  // handlePhoneSubmit runs the zod schema first and only calls this
  // callback if `phoneNumber` actually passes validation — the manual
  // `digits.length < 6` check this replaced is now enforced by
  // phoneSchema.ts instead, with a real inline error message (rendered
  // next to PhoneConnector below) if it fails. Real POST /api/otp/send —
  // there was no OTP step at all before this; the backend flow requires
  // one before secureId can be chosen.
  const handleVerify = handlePhoneSubmit(async () => {
    if (verifying || stage !== "phone") return;
    const mobileNumber = normalizeMobileForApi(dialCountry, phoneNumber);
    setOtpError(null);
    setVerifying(true);
    try {
      await sendOtp(mobileNumber);
      setRegisteredMobile(mobileNumber);
      setOtpResendAvailableAt(Date.now() + OTP_RESEND_COOLDOWN_MS);
      setVerifying(false);
      flipTo("otp");
    } catch (err) {
      setVerifying(false);
      setOtpError(err instanceof Error ? err.message : "Couldn't send OTP. Try again.");
    }
  });

  // Re-sends to the same already-validated mobile number — no phone-form
  // re-submission needed. Kept on its own `otpResending` flag rather than
  // reusing `verifying`, so a resend in flight can't disable the Verify OTP
  // button (or vice versa) for an unrelated reason.
  const handleResendOtp = async () => {
    if (otpResending || verifying || stage !== "otp") return;
    setOtpError(null);
    setOtpResending(true);
    try {
      await sendOtp(registeredMobile);
      setOtpResendAvailableAt(Date.now() + OTP_RESEND_COOLDOWN_MS);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Couldn't resend OTP. Try again.");
    } finally {
      setOtpResending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (verifying || otp.length !== OTP_LENGTH) return;
    setOtpError(null);
    setVerifying(true);
    try {
      await verifyOtp(registeredMobile, otp);
      setVerifying(false);
      flipTo("secureId");
    } catch (err) {
      setVerifying(false);
      setOtpError(err instanceof Error ? err.message : "Incorrect OTP. Try again.");
    }
  };

  const handleStartOver = () => {
    setVerifying(false);
    setLoginError(null);
    setRegistering(false);
    setRegisterError(null);
    setOtpError(null);
    setLoginSecureId("");
    setLoginPin("");
    setLoginMethod("secureId");
    setLoginMobileNumber("");
    resetPhoneForm();
    setSecureId("");
    setReferralCode("");
    setReferralCheck("idle");
    setPin("");
    setOtp("");
    setOtpResendAvailableAt(null);
    setOtpResending(false);
    setRegisteredMobile("");
    setRegisteredUser(null);
    clearSession();
    flipTo("login");
  };

  // Real Command Bus wiring: DashboardScreen dispatches "auth/logout"
  // without knowing or importing anything about RootApp — this is the
  // one place that command actually gets handled. Re-registers if
  // handleStartOver's closure changes (it doesn't currently capture
  // anything that changes per-render, but this is the correct/safe
  // pattern regardless), and always unregisters on unmount so a stale
  // closure from a previous mount can never fire.
  useEffect(() => {
    return commandBus.register("auth/logout", handleStartOver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wires each full-screen step/overlay's existing onBack/onClose handler
  // (unchanged below) to the phone's hardware/gesture back button — see
  // useBackNavigation.ts. This app has no router-based history for its
  // internal stage/overlay state, so without this a back gesture would
  // just leave the PWA instead of stepping back one screen.
  const backToPhone = () => flipTo("phone");
  const backToLogin = () => flipTo("login");
  const backToReferral = () => flipTo("referral");
  const backToPinOrLoginPin = () => flipTo(registeredMobile ? "pin" : "loginPin");
  const closeActiveScreen = () => setActiveScreen(null);
  const closePicker = () => {
    setShowPicker(false);
    setCountrySearch("");
  };
  useBackNavigation(stage === "otp", backToPhone);
  useBackNavigation(stage === "loginPin", backToLogin);
  useBackNavigation(stage === "pin", backToReferral);
  useBackNavigation(stage === "deviceAuth", backToPinOrLoginPin);
  useBackNavigation(activeScreen !== null, closeActiveScreen);
  useBackNavigation(showPicker, closePicker);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        background: "#ffffff",
        overflow: "hidden",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <FloatingFlagBackground />

      <div
        style={{
          position: "absolute",
          top: "calc(18px + env(safe-area-inset-top, 0px))",
          left: "calc(18px + env(safe-area-inset-left, 0px))",
          zIndex: 20,
        }}
      >
        <img
          src={globalIdLogo}
          alt="Gloobal ID"
          style={{
            display: "block",
            width: "clamp(46px, 12vw, 52px)",
            height: "auto",
            objectFit: "contain",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: "calc(22px + env(safe-area-inset-top, 0px))",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 0.5,
          color: T.ink,
          fontFamily: T.fontDisplay,
        }}
      >
        Gl<span style={{ color: T.accent2 }}>o</span>
        <span style={{ color: "#C026D3" }}>o</span>bal ID
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "6%",
          transform: "translateX(-50%)",
          width: "92%",
          maxWidth: 340,
          zIndex: 20,
        }}
      >
        <div style={{ perspective: 800, position: "relative" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: flipping ? "rotateY(90deg)" : "rotateY(0deg)",
              transition: "transform 0.22s ease",
            }}
          >
            {/* Login method switch — Secure ID (dial pad, unchanged) or
                Mobile Number (resolved to a Secure ID via the existing
                /api/users/resolve lookup, see handleLoginWithMobile). */}
            {stage === "login" && (
              <div
                style={{
                  display: "flex",
                  marginBottom: 14,
                  padding: 3,
                  borderRadius: T.radiusMd,
                  background: T.surfaceAlt,
                  border: `1px solid ${T.line}`,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {(["secureId", "mobile"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setLoginMethod(m);
                      setLoginError(null);
                    }}
                    className="v2-tap"
                    style={{
                      border: "none",
                      borderRadius: T.radiusSm,
                      padding: "7px 16px",
                      fontSize: 11.5,
                      fontWeight: 800,
                      letterSpacing: 0.2,
                      cursor: "pointer",
                      color: loginMethod === m ? "#fff" : T.inkSoft,
                      background: loginMethod === m ? T.gradButton : "transparent",
                      transition: "background 0.15s ease, color 0.15s ease",
                      touchAction: "manipulation",
                    }}
                  >
                    {m === "secureId" ? "Secure ID" : "Mobile Number"}
                  </button>
                ))}
              </div>
            )}

            {/* The Secure ID / Referral card itself — unmoved, unchanged:
                same shadows, border radius, corner label, and counter as
                before. Just the card; the dial and button now live below
                it instead of inside it. */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                minHeight: stage === "phone" ? 96 : 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "18px 14px",
                borderRadius: T.radiusLg,
                boxShadow: T.shadowFloat,
                border: `1px solid ${T.line}`,
                background: T.surface,
                boxSizing: "border-box",
                overflow: "visible",
              }}
            >
              {stage === "phone" && (
                <>
                  <PhoneConnector
                    country={dialCountry}
                    phoneNumber={phoneNumber}
                    onChangePhone={setPhoneNumber}
                    onOpenPicker={() => setShowPicker(true)}
                    onActivate={handleVerify}
                    verifying={verifying}
                  />
                  {phoneErrors.phoneNumber && (
                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: "#EF4444" }}>
                      {phoneErrors.phoneNumber.message}
                    </div>
                  )}
                  {otpError && !phoneErrors.phoneNumber && (
                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: "#EF4444" }}>{otpError}</div>
                  )}
                </>
              )}

              {stage === "login" && (
                <span
                  style={{
                    position: "absolute",
                    top: -11,
                    left: 16,
                    background: T.surface,
                    border: `1px solid ${T.line}`,
                    borderRadius: 7,
                    padding: "3px 9px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: T.accent,
                    boxShadow: T.shadowCard,
                  }}
                >
                  Log In
                </span>
              )}

              {stage === "login" && loginMethod === "secureId" && (
                <button
                  onClick={() => setLoginRevealed((v) => !v)}
                  aria-label={loginRevealed ? "Hide Secure ID" : "Show Secure ID"}
                  className="v2-tap"
                  style={{
                    position: "absolute",
                    top: -11,
                    right: 16,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: `1px solid ${T.line}`,
                    background: T.surface,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: T.shadowCard,
                  }}
                >
                  <MaskEyeIcon open={loginRevealed} color={T.inkSoft} />
                </button>
              )}

              {stage === "login" && loginMethod === "secureId" && (
                <SymbolChipRow length={SECURE_ID_LENGTH} value={loginSecureId} masked={!loginRevealed} />
              )}

              {stage === "login" && loginMethod === "mobile" && (
                <div style={{ width: "100%", marginTop: 4 }}>
                  <PhoneConnector
                    country={dialCountry}
                    phoneNumber={loginMobileNumber}
                    onChangePhone={setLoginMobileNumber}
                    onOpenPicker={() => setShowPicker(true)}
                    onActivate={handleLoginWithMobile}
                    verifying={resolvingMobile}
                  />
                </div>
              )}

              {stage === "secureId" && (
                <span
                  style={{
                    position: "absolute",
                    top: -11,
                    left: 16,
                    background: T.surface,
                    border: `1px solid ${T.line}`,
                    borderRadius: 7,
                    padding: "3px 9px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: T.accent,
                    boxShadow: T.shadowCard,
                  }}
                >
                  Secure ID
                </span>
              )}

              {stage === "referral" && (
                <span
                  style={{
                    position: "absolute",
                    top: -11,
                    left: 16,
                    background: T.surface,
                    border: `1px solid ${T.line}`,
                    borderRadius: 7,
                    padding: "3px 9px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: T.accent,
                    boxShadow: T.shadowCard,
                  }}
                >
                  Referral ID
                </span>
              )}

              {/* Eye toggle now sits as its own corner badge, top-right,
                  mirroring the label badge on the top-left — out of the
                  chip row entirely, so that row's full width goes to the
                  12 boxes. */}
              {stage === "secureId" && (
                <button
                  onClick={() => setSecureIdRevealed((v) => !v)}
                  aria-label={secureIdRevealed ? "Hide Secure ID" : "Show Secure ID"}
                  className="v2-tap"
                  style={{
                    position: "absolute",
                    top: -11,
                    right: 16,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: `1px solid ${T.line}`,
                    background: T.surface,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: T.shadowCard,
                  }}
                >
                  <MaskEyeIcon open={secureIdRevealed} color={T.inkSoft} />
                </button>
              )}

              {stage === "referral" && (
                <button
                  onClick={() => setReferralRevealed((v) => !v)}
                  aria-label={referralRevealed ? "Hide Referral ID" : "Show Referral ID"}
                  className="v2-tap"
                  style={{
                    position: "absolute",
                    top: -11,
                    right: 16,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: `1px solid ${T.line}`,
                    background: T.surface,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: T.shadowCard,
                  }}
                >
                  <MaskEyeIcon open={referralRevealed} color={T.inkSoft} />
                </button>
              )}

              {stage === "secureId" && (
                <SymbolChipRow length={SECURE_ID_LENGTH} value={secureId} masked={!secureIdRevealed} />
              )}

              {stage === "referral" && (
                <SymbolChipRow length={REFERRAL_LENGTH} value={referralCode} masked={!referralRevealed} />
              )}
            </div>

            {/* Symbol dial pad — same compact grid-button pattern as
                PinDialPad, sized down so the card, dial, and button all
                stay fully visible together on one screen. */}
            {stage === "login" && loginMethod === "secureId" && (
              <div style={{ marginTop: 32, position: "relative", zIndex: 1, width: "100%" }}>
                <SymbolDialPad value={loginSecureId} onChange={setLoginSecureId} length={SECURE_ID_LENGTH} />
              </div>
            )}

            {stage === "secureId" && (
              <div style={{ marginTop: 32, position: "relative", zIndex: 1, width: "100%" }}>
                <SymbolDialPad value={secureId} onChange={setSecureId} length={SECURE_ID_LENGTH} />
              </div>
            )}

            {stage === "referral" && (
              <div style={{ marginTop: 32, position: "relative", zIndex: 1, width: "100%" }}>
                <SymbolDialPad
                  value={referralCode}
                  onChange={(v) => {
                    setReferralCode(v);
                    setReferralFieldError(null);
                  }}
                  length={REFERRAL_LENGTH}
                />
              </div>
            )}

            {stage === "login" && loginMethod === "secureId" && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
                {loginError && (
                  <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, color: "#EF4444", textAlign: "center" }}>
                    {loginError}
                  </div>
                )}
                <SubmitButton
                  onClick={handleLogin}
                  disabled={loginSecureId.length !== SECURE_ID_LENGTH || verifying}
                  label={verifying ? "Logging in…" : "Log In"}
                />
                <button
                  onClick={() => flipTo("phone")}
                  style={{
                    marginTop: 10,
                    border: "none",
                    background: "none",
                    color: T.accent2,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: "6px 8px",
                  }}
                >
                  New here? Create a Global ID
                </button>
              </div>
            )}

            {/* Mobile Number mode: PhoneConnector's own circular arrow
                button (inside the card above) is the submit action, so this
                footer is just the error + "New here" link. */}
            {stage === "login" && loginMethod === "mobile" && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
                {resolvingMobile && showSlowHint && !loginError && (
                  <div style={{ marginBottom: 10, fontSize: 11, color: T.inkFaint, textAlign: "center", maxWidth: 240 }}>
                    {slowHintText}
                  </div>
                )}
                {loginError && (
                  <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, color: "#EF4444", textAlign: "center" }}>
                    {loginError}
                  </div>
                )}
                <button
                  onClick={() => flipTo("phone")}
                  style={{
                    border: "none",
                    background: "none",
                    color: T.accent2,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: "6px 8px",
                  }}
                >
                  New here? Create a Global ID
                </button>
              </div>
            )}

            {stage === "phone" && (
              <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => flipTo("login")}
                  style={{
                    border: "none",
                    background: "none",
                    color: T.accent2,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: "6px 8px",
                  }}
                >
                  Already have a Global ID? Log in
                </button>
              </div>
            )}

            {stage === "secureId" && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
                {secureId.length === SECURE_ID_LENGTH && secureIdCheck !== "idle" && (
                  <div
                    style={{
                      marginBottom: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      textAlign: "center",
                      color:
                        secureIdCheck === "taken"
                          ? "#EF4444"
                          : secureIdCheck === "available"
                          ? T.positive
                          : T.inkFaint,
                    }}
                  >
                    {secureIdCheck === "checking" && "Checking availability…"}
                    {secureIdCheck === "available" && "✓ Available"}
                    {secureIdCheck === "taken" && "This Secure ID is already taken — try a different one"}
                    {secureIdCheck === "error" && "Couldn't check availability right now — you can still continue"}
                  </div>
                )}
                <SubmitButton
                  onClick={handleSubmitSecureId}
                  disabled={secureId.length !== SECURE_ID_LENGTH || secureIdCheck === "checking" || secureIdCheck === "taken"}
                />
              </div>
            )}

            {stage === "referral" && (
              <div
                style={{
                  marginTop: 26,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                {!referralFieldError && referralCode.length === REFERRAL_LENGTH && referralCheck !== "idle" && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      textAlign: "center",
                      color:
                        referralCheck === "invalid"
                          ? "#EF4444"
                          : referralCheck === "valid"
                          ? T.positive
                          : T.inkFaint,
                    }}
                  >
                    {referralCheck === "checking" && "Checking referral ID…"}
                    {referralCheck === "valid" && "✓ Valid referral ID"}
                    {referralCheck === "invalid" && "This referral ID doesn't exist — try again or skip"}
                    {referralCheck === "error" && "Couldn't check right now — you can still continue"}
                  </div>
                )}
                {referralFieldError && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#EF4444", textAlign: "center" }}>
                    {referralFieldError}
                  </div>
                )}
                {(() => {
                  const referralBlocked =
                    referralCheck === "checking" || (referralCode.length === REFERRAL_LENGTH && referralCheck === "invalid");
                  const submitDisabled = registering || referralBlocked;
                  return (
                    <button
                      type="button"
                      onClick={handleSubmitReferral}
                      disabled={submitDisabled}
                      className="v2-tap"
                      style={{
                        width: "100%",
                        maxWidth: 230,
                        border: "none",
                        borderRadius: T.radiusMd,
                        padding: "14px 24px",
                        fontSize: 13.5,
                        fontWeight: 800,
                        letterSpacing: 0.2,
                        color: "#fff",
                        cursor: submitDisabled ? "default" : "pointer",
                        background: submitDisabled ? T.gradButtonDisabled : T.gradButton,
                        boxShadow: submitDisabled ? "none" : "0 10px 24px rgba(124,58,237,0.34)",
                        transition: "box-shadow 0.15s ease, background 0.15s ease, transform 0.1s ease",
                        touchAction: "manipulation",
                      }}
                    >
                      {registering ? "Submitting…" : referralCheck === "checking" ? "Checking…" : "Submit"}
                    </button>
                  );
                })()}
                <button
                  type="button"
                  onClick={handleSkipReferral}
                  disabled={registering}
                  className="v2-tap"
                  style={{
                    width: "100%",
                    maxWidth: 230,
                    border: `1.5px solid ${T.line}`,
                    borderRadius: T.radiusMd,
                    padding: "11px 24px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                    color: T.inkSoft,
                    background: T.surface,
                    cursor: registering ? "not-allowed" : "pointer",
                    boxShadow: T.shadowCard,
                    transition: "box-shadow 0.15s ease, background 0.15s ease",
                    touchAction: "manipulation",
                  }}
                >
                  Skip for now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {stage === "otp" && (
        <OtpVerifyScreen
          mobile={registeredMobile}
          otp={otp}
          onChangeOtp={setOtp}
          onVerify={handleVerifyOtp}
          onBack={backToPhone}
          verifying={verifying}
          error={otpError}
          length={OTP_LENGTH}
          hint={showSlowHint ? slowHintText : null}
          onResend={handleResendOtp}
          resending={otpResending}
          resendAvailableAt={otpResendAvailableAt}
        />
      )}

      {stage === "loginPin" && (
        <PinScreen
          value={loginPin}
          length={PIN_LENGTH}
          onChange={setLoginPin}
          onSubmit={handleLoginPin}
          onBack={backToLogin}
          submitting={verifying}
          error={loginError}
          hint={showSlowHint ? slowHintText : null}
        />
      )}

      {stage === "pin" && (
        <PinScreen
          value={pin}
          length={PIN_LENGTH}
          onChange={setPin}
          onSubmit={handleSubmitPin}
          onBack={backToReferral}
          submitting={registering}
          error={registerError}
        />
      )}

      {stage === "deviceAuth" && (
        <DeviceVerificationScreen
          symbolId={globalIdTag}
          onVerified={() => flipTo("dashboard")}
          onBack={backToPinOrLoginPin}
        />
      )}

      {stage === "dashboard" && (
        <ErrorBoundary>
          <Suspense fallback={<ScreenFallback />}>
            <DashboardScreen
              dialCountry={dialCountry}
              symbolId={globalIdTag}
              fullName={registeredUser?.fullName}
              referralCode={globalIdTag}
              onShareReferral={() => shareReferralLink(globalIdTag)}
              onOpenSend={() => setActiveScreen("send")}
              onOpenBank={() => setActiveScreen("bank")}
              onOpenCoverage={() => setActiveScreen("coverage")}
              onOpenReceive={() => setActiveScreen("receive")}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeScreen === "send" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 190, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <ErrorBoundary>
            <Suspense fallback={<ScreenFallback />}>
              <SendMoneyScreen
                onClose={closeActiveScreen}
                sender={{ ...dialCountry, phoneNumber, symbolId: globalIdTag, fullName: registeredUser?.fullName }}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {activeScreen === "bank" && (
        <ErrorBoundary>
          <Suspense fallback={<ScreenFallback />}>
            <AddBankScreen onClose={closeActiveScreen} country={dialCountry} />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeScreen === "coverage" && (
        <ErrorBoundary>
          <Suspense fallback={<ScreenFallback />}>
            <GlobalCoverageScreen onClose={closeActiveScreen} dialCountry={dialCountry} />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeScreen === "receive" && (
        <ErrorBoundary>
          <Suspense fallback={<ScreenFallback />}>
            <ReceiveScreen
              onClose={closeActiveScreen}
              dialCountry={dialCountry}
              secureId={secureId}
              globalIdTag={globalIdTag}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {showPicker && (
        <CountryPickerScreen
          topCountries={TOP_COUNTRIES}
          countries={ALL_COUNTRIES}
          search={countrySearch}
          onSearch={setCountrySearch}
          onSelect={(c) => {
            setDialCountry(c);
            closePicker();
          }}
          onClose={closePicker}
        />
      )}

      {/* App lock — shown after the PWA was backgrounded past the
          threshold in useSessionLock.ts. Sits above everything (dashboard,
          any open overlay) with its own PIN dial pad; nothing behind it is
          interactive while this is up. Same permissive "any full-length
          PIN unlocks" behavior as the rest of this prototype's dial pads —
          swap handleUnlock's body for a real credential check before this
          touches production. */}
      {locked && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            background: T.bg,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, marginBottom: 6 }}>
            Welcome back
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 28 }}>Enter your PIN to continue</div>
          <PinDialPad value={unlockPin} onChange={setUnlockPin} length={PIN_LENGTH} />
          <div style={{ marginTop: 20 }}>
            <SubmitButton onClick={handleUnlock} disabled={unlockPin.length !== PIN_LENGTH} label="Unlock" />
          </div>
        </div>
      )}

      {/* Global fonts, shared keyframes, and .v2-tap/.v2-row utility
          classes now live in src/styles/global.css (imported once in
          main.tsx) instead of being injected here on every render. */}
    </div>
  );
}
