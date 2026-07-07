import React, { Suspense, useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { phoneSchema } from "../screens/registration/phoneSchema";
import { GROWTH_START_SCALE, MAX_PARTICLES, makeParticle, type FlagParticle } from "../components/ambient/AmbientParticles";
import { MaskEyeIcon, SubmitButton, SymbolChipRow } from "../components/common/FormPrimitives";
import { PinDialPad, SymbolDialPad } from "../components/dial/SymbolDial";
import { FlagSignShape } from "../components/icons/MiscIcons";
import { ALL_COUNTRIES, TOP_COUNTRIES, COUNTRY_BY_ISO } from "../data/countries";
import { CountryPickerScreen } from "../screens/registration/CountryPickerScreen";
import { PhoneConnector } from "../screens/registration/PhoneEntryForm";
import { PinScreen } from "../screens/registration/PinScreen";
import { T } from "../styles/theme";
import { commandBus } from "./commandBus";
import { login, register, sendOtp, verifyOtp, setPin as apiSetPin, type BackendUser } from "../services/api/authApi";
import { OtpVerifyScreen } from "../screens/registration/OtpVerifyScreen";
import { DeviceVerificationScreen } from "../screens/registration/DeviceVerificationScreen";
import { saveSession, loadSession, clearSession } from "./sessionPersistence";
import { useSessionLock } from "./useSessionLock";
import { readReferralCodeFromUrl, shareReferralLink } from "./referralLink";
import { featureRegistry } from "./featureRegistry";
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<FlagParticle[]>([]);
  const elsRef = useRef<Record<string, HTMLElement | null>>({});
  const rafRef = useRef<number | null>(null);
  const dimsRef = useRef({ w: 0, h: 0 });
  const frameRef = useRef(0);

  const [, forceRender] = useState(0);
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
  const [secureId, setSecureId] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
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
  const [dialCountry, setDialCountry] = useState<DialCountry>(TOP_COUNTRIES[0]);
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

  // App lock: only meaningful once actually authenticated (dashboard) —
  // see useSessionLock.ts for the backgrounding-threshold logic.
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

  // Secure ID doesn't call the backend yet — referral (or skipping it)
  // is what actually registers, since referredBy needs the referral
  // field's final value either way.
  const handleSubmitSecureId = () => {
    if (secureId.length === SECURE_ID_LENGTH) flipTo("referral");
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

  const handleSubmitReferral = () => {
    if (referralCode.length === REFERRAL_LENGTH) registerAndAdvance(referralCode);
  };

  const handleSkipReferral = () => registerAndAdvance("");

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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    dimsRef.current = { w: stage.clientWidth, h: stage.clientHeight };

    for (let i = 0; i < 8; i++) {
      const p = makeParticle(dimsRef.current.w, dimsRef.current.h);
      p.y = Math.random() * dimsRef.current.h;
      p.spawnY = p.y + dimsRef.current.h * 0.5; // already "grown up" on load
      p.scale = 1;
      p.opacity = 0.15 + Math.random() * 0.5;
      particlesRef.current.push(p);
    }
    forceRender((n) => n + 1);

    // People who've asked their OS for reduced motion get a calm, static
    // scattering of particles instead of the continuous drifting animation.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const tick = () => {
      frameRef.current += 1;
      const { w, h } = dimsRef.current;
      const arr = particlesRef.current;

      // 1. Move.
      for (const p of arr) {
        p.x += p.vx;
        p.y += p.vy;
        p.twinklePhase += p.twinkleSpeed;
      }

      // 2. Resolve overlaps: if two particles touch, nudge them apart and
      // give each a small push in the opposite direction, like a soft bounce.
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i];
          const b = arr[j];
          const ra = (Math.max(a.pw, a.ph) * a.scale) / 2;
          const rb = (Math.max(b.pw, b.ph) * b.scale) / 2;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          const minDist = (ra + rb) * 0.9;

          if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            // Separate so they no longer overlap.
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            // A small push apart, mostly sideways so the upward flow holds.
            const push = 0.18;
            a.vx -= nx * push;
            a.vy -= ny * push * 0.25;
            b.vx += nx * push;
            b.vy += ny * push * 0.25;

            a.vx = Math.max(-1.3, Math.min(1.3, a.vx));
            b.vx = Math.max(-1.3, Math.min(1.3, b.vx));
            a.vy = Math.max(-1.6, Math.min(-0.15, a.vy));
            b.vy = Math.max(-1.6, Math.min(-0.15, b.vy));
          }
        }
      }

      // 3. Update opacity, growth, and paint.
      for (const p of arr) {
        const distFromBottom = h - p.y;
        if (distFromBottom < 60) {
          p.opacity = Math.min(0.9, distFromBottom / 60);
        } else {
          p.opacity = 0.35 + Math.abs(Math.sin(p.twinklePhase)) * 0.55;
        }

        // Growth: starts as a pinprick (1/10 scale) at spawn and eases up to
        // its full, "existing" size the further it travels up the stage.
        // Eased (not linear) so the grow-in feels smooth rather than abrupt.
        const traveled = p.spawnY - p.y;
        const growthRatio = Math.min(1, traveled / (h * 0.5));
        const eased = 1 - Math.pow(1 - growthRatio, 3);
        p.scale = GROWTH_START_SCALE + (1 - GROWTH_START_SCALE) * eased;

        const el = elsRef.current[p.id];
        if (el) {
          el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.scale})`;
          el.style.opacity = String(p.opacity);
        }
      }

      let changed = false;
      particlesRef.current = arr.filter((p) => {
        const alive = p.y > -30 && p.x > -30 && p.x < w + 30;
        if (!alive) changed = true;
        return alive;
      });

      if (frameRef.current % 10 === 0 && particlesRef.current.length < MAX_PARTICLES) {
        particlesRef.current.push(makeParticle(w, h));
        changed = true;
      }

      if (changed) forceRender((n) => n + 1);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Secure ID entry on the login card just advances to a PIN step now —
  // real POST /api/login needs both, collected together in handleLoginPin.
  const handleLogin = () => {
    if (verifying || stage !== "login") return;
    if (loginSecureId.length !== SECURE_ID_LENGTH) return;
    setLoginError(null);
    flipTo("loginPin");
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
      setVerifying(false);
      flipTo("otp");
    } catch (err) {
      setVerifying(false);
      setOtpError(err instanceof Error ? err.message : "Couldn't send OTP. Try again.");
    }
  });

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
    resetPhoneForm();
    setSecureId("");
    setReferralCode("");
    setPin("");
    setOtp("");
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

  return (
    <div
      ref={stageRef}
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
      {particlesRef.current.map((p) => (
        <div
          key={p.id}
          ref={(el) => {
            if (el) elsRef.current[p.id] = el;
            else delete elsRef.current[p.id];
          }}
          style={{
            position: "absolute",
            top: -(p.ph / 2),
            left: -(p.pw / 2),
            width: p.pw,
            height: p.ph,
            userSelect: "none",
            pointerEvents: "none",
            willChange: "transform, opacity",
            opacity: p.opacity,
          }}
        >
          <FlagSignShape sign={p.sign} flag={p.flag} box={p.box} />
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          top: "calc(18px + env(safe-area-inset-top, 0px))",
          left: "calc(18px + env(safe-area-inset-left, 0px))",
          width: 44,
          height: 44,
          zIndex: 20,
        }}
      >
        <svg viewBox="0 0 44 44" width="100%" height="100%">
          <defs>
            <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={T.accent2} />
              <stop offset="50%" stopColor={T.accent} />
              <stop offset="100%" stopColor="#C026D3" />
            </linearGradient>
          </defs>
          <circle cx="22" cy="22" r="20" fill="url(#lg1)" />
          <path
            d="M13 24 L20 15 L27 22 L34 13"
            stroke="#fff"
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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

              {stage === "login" && (
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

              {stage === "login" && (
                <SymbolChipRow length={SECURE_ID_LENGTH} value={loginSecureId} masked={!loginRevealed} />
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
            {stage === "login" && (
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
                <SymbolDialPad value={referralCode} onChange={setReferralCode} length={REFERRAL_LENGTH} />
              </div>
            )}

            {stage === "login" && (
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
              <div style={{ marginTop: 20 }}>
                <SubmitButton
                  onClick={handleSubmitSecureId}
                  disabled={secureId.length !== SECURE_ID_LENGTH}
                />
              </div>
            )}

            {stage === "referral" && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <SubmitButton
                  onClick={handleSubmitReferral}
                  disabled={referralCode.length !== REFERRAL_LENGTH || registering}
                />
                <button
                  onClick={handleSkipReferral}
                  disabled={registering}
                  style={{
                    marginTop: 10,
                    border: "none",
                    background: "none",
                    color: T.accent2,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: registering ? "not-allowed" : "pointer",
                    padding: "6px 8px",
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
          onBack={() => flipTo("phone")}
          verifying={verifying}
          error={otpError}
          length={OTP_LENGTH}
        />
      )}

      {stage === "loginPin" && (
        <PinScreen
          value={loginPin}
          length={PIN_LENGTH}
          onChange={setLoginPin}
          onSubmit={handleLoginPin}
          onBack={() => flipTo("login")}
          submitting={verifying}
          error={loginError}
        />
      )}

      {stage === "pin" && (
        <PinScreen
          value={pin}
          length={PIN_LENGTH}
          onChange={setPin}
          onSubmit={handleSubmitPin}
          onBack={() => flipTo("referral")}
          submitting={registering}
          error={registerError}
        />
      )}

      {stage === "deviceAuth" && (
        <DeviceVerificationScreen
          symbolId={globalIdTag}
          onVerified={() => flipTo("dashboard")}
          onBack={() => flipTo(registeredMobile ? "pin" : "loginPin")}
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
                onClose={() => setActiveScreen(null)}
                sender={{ ...dialCountry, phoneNumber, symbolId: globalIdTag, fullName: registeredUser?.fullName }}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {activeScreen === "bank" && (
        <ErrorBoundary>
          <Suspense fallback={<ScreenFallback />}>
            <AddBankScreen onClose={() => setActiveScreen(null)} country={dialCountry} />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeScreen === "coverage" && (
        <ErrorBoundary>
          <Suspense fallback={<ScreenFallback />}>
            <GlobalCoverageScreen onClose={() => setActiveScreen(null)} dialCountry={dialCountry} />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeScreen === "receive" && (
        <ErrorBoundary>
          <Suspense fallback={<ScreenFallback />}>
            <ReceiveScreen
              onClose={() => setActiveScreen(null)}
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
            setShowPicker(false);
            setCountrySearch("");
          }}
          onClose={() => {
            setShowPicker(false);
            setCountrySearch("");
          }}
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
