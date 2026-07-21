import React, { Suspense, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  Fingerprint,
  Info,
  Gift,
} from "lucide-react";
import { ExplainSheet } from "./components/common/ExplainSheet";
import { CircularInButton } from "./components/auth/CircularInButton";
import { CountryPickerScreen } from "./components/auth/CountryPickerScreen";
import { LoginAuthScreen } from "./components/auth/LoginAuthScreen";
import { PhoneConnector } from "./components/auth/PhoneConnector";
import { PinScreen } from "./components/auth/PinScreen";
import { GROWTH_START_SCALE, MAX_PARTICLES, makeParticle } from "./components/backgrounds/FlagParticleField";
import { OTP_LENGTH } from "./components/bank/LinkAccountFlow";
import { CyclingBadge, MaskEyeIcon, SubmitButton, SymbolChipRow } from "./components/common/CodeEntry";
import { PhoneDialPad, SymbolDialPad } from "./components/common/DialPads";
import { FlagEmoji, FlagSignShape } from "./components/common/FlagComponents";
import { AddBankScreen, DashboardScreen, GloobalCoverageScreen, SendMoneyScreen } from "./lazyScreens";
import { ErrorBoundary } from "./pwa/ErrorBoundary";
import { ScreenFallback } from "./pwa/ScreenFallback";
import { ALL_COUNTRIES, TOP_COUNTRIES, mobileDigitRange } from "./constants/countries";
import { T } from "./styles/theme";
import globalIdLogo from "./assets/globalid-logo.png";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { warmUpBackend } from "./services/httpClient";
import {
  sendOtp,
  verifyOtp,
  register as registerUser,
  setPin as apiSetPin,
  login as apiLogin,
  resolveUser,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  passkeyAuthOptions,
  passkeyAuthVerify,
} from "./services/api/authApi";

// Combines the chosen country's dial code with the typed national number
// into the string the backend's normalizeMobileNumber helper expects.
// India gets the explicit 10-digit -> +91XXXXXXXXXX shortcut since that's
// the backend's primary documented case; everything else falls back to
// dialCode + digits.
function normalizeMobileForApi(dialCountry, phoneNumber) {
  const raw = String(phoneNumber || "").trim();
  if (raw.startsWith("+")) return raw.replace(/[\s-]/g, "");
  const digits = raw.replace(/\D/g, "");
  if (dialCountry.iso === "IN" && digits.length === 10) return `+91${digits}`;
  return `${dialCountry.dialCode}${digits}`;
}

// Hoisted to module scope (not recreated inline at each call site) so
// these stay the same array reference across renders — required for
// CyclingBadge's React.memo to actually skip re-renders instead of seeing
// a "new" words array every time.
const LOGIN_BADGE_WORDS = ["Login", "Gloobal", "Id"];
const CREATE_BADGE_WORDS = ["Create", "Secure", "Gloobal", "Id"];

function GloobalId() {
  const stageRef = useRef(null);
  const particlesRef = useRef([]);
  const elsRef = useRef({});
  const rafRef = useRef(null);
  const dimsRef = useRef({ w: 0, h: 0 });
  const frameRef = useRef(0);

  const [, forceRender] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [stage, setStage] = useState("phone"); // phone -> otp -> secureId -> referral -> pin -> dashboard (registration); secureId -> loginAuth -> dashboard (login)
  const [flipping, setFlipping] = useState(false);
  const [secureId, setSecureId] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [pin, setPin] = useState("");
  // The 6-digit code sent to the phone number just entered — real
  // POST /api/otp/send fires in handleVerify, so this starts empty and is
  // actually typed in by whoever received the code, not pre-filled.
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(null);
  // The mobile number OTP was actually sent to (normalized to the
  // backend's +91XXXXXXXXXX-style format) — kept separate from the raw
  // `phoneNumber` dial-pad buffer so a later edit to that buffer can't
  // silently change what verifyOtp checks against.
  const [registeredMobile, setRegisteredMobile] = useState("");
  // The account as the real backend knows it, once registration or login
  // has actually succeeded — symbolId here is the source of truth for
  // every downstream screen (Dashboard, Send Money), not just whatever's
  // currently typed into the dial pad.
  const [registeredUser, setRegisteredUser] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState(null);
  const [loginError, setLoginError] = useState(null);
  // Mobile-number login has its own in-flight flag, separate from
  // `verifying` — switching back to the Secure ID tab while a mobile
  // lookup is still in flight shouldn't leave that tab stuck disabled.
  const [resolvingMobile, setResolvingMobile] = useState(false);
  // Real WebAuthn device-setup step, shown once right after registration
  // sets a PIN (see the "deviceSetup" stage below) — separate busy/status
  // state from loginAuthScanning since setup and login-time verify are two
  // different ceremonies that never run at the same time, but keeping
  // separate flags avoids one screen's leftover state bleeding into the
  // other if someone navigates back and forth quickly.
  const [deviceSetupBusy, setDeviceSetupBusy] = useState(false);
  const [deviceSetupStatus, setDeviceSetupStatus] = useState(null);
  const [deviceSetupError, setDeviceSetupError] = useState(null);
  const [loginAuthError, setLoginAuthError] = useState(null);
  const [loginAuthStatus, setLoginAuthStatus] = useState(null);
  // The single source of truth for the user's country, chosen once via the
  // country picker during registration (the "phone" stage below). Every
  // other screen — dashboard, Gloobal ID, Send Money, Add Bank, Gloobal
  // Coverage — reads this same value instead of asking again. The picker
  // itself is only reachable while stage === "phone", so once registration
  // is complete this is effectively locked until a future settings screen
  // explicitly offers to change it.
  const [dialCountry, setDialCountry] = useState(() => TOP_COUNTRIES.find((c) => c.iso === "IN") || TOP_COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [phoneDialOpen, setPhoneDialOpen] = useState(false);
  const [showLoginFace, setShowLoginFace] = useState(false);
  // Tapping IN doesn't go to a separate screen — it reuses this exact
  // Secure ID stage (same card, same chip row, same dial pad). This flag
  // is the only thing that changes: the button reads "IN" instead of
  // "Submit" and, on success, goes straight to the dashboard instead of
  // continuing on to the Referral step.
  const [isLoginAttempt, setIsLoginAttempt] = useState(false);
  // Login can flip between Secure ID and mobile number via the refresh
  // icon on the card — its own buffer/country, separate from the main
  // registration phone number.
  const [loginEntryMode, setLoginEntryMode] = useState("id"); // 'id' | 'mobile'
  const [loginMobileBuffer, setLoginMobileBuffer] = useState("");
  const [loginMobileCountry, setLoginMobileCountry] = useState(null);
  const [showLoginPicker, setShowLoginPicker] = useState(false);
  const [loginCountrySearch, setLoginCountrySearch] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [activeScreen, setActiveScreen] = useState(null); // null | "send" | "bank" | "coverage"
  // Whether the entered Secure ID / Referral ID symbols are shown in the
  // clear or masked as dots — toggled by the eye button next to each.
  const [secureIdRevealed, setSecureIdRevealed] = useState(false);
  const [referralRevealed, setReferralRevealed] = useState(false);
  // The two info-corner explanation overlays — what the Gloobal symbols
  // are, and what a referral is worth. Purely informational, so they carry
  // no backend state of their own.
  const [showIdExplain, setShowIdExplain] = useState(false);
  const [showReferralExplain, setShowReferralExplain] = useState(false);
  const [otpRevealed, setOtpRevealed] = useState(false);
  const [pinRevealed, setPinRevealed] = useState(false);
  const [loginMobileRevealed, setLoginMobileRevealed] = useState(false);
  // The PIN + Face/Fingerprint confirmation shown after a successful
  // Secure ID or mobile-number login, before landing on the dashboard —
  // its own buffer and reveal state, separate from the registration PIN.
  const [loginAuthPin, setLoginAuthPin] = useState("");
  const [loginAuthRevealed, setLoginAuthRevealed] = useState(false);
  const [loginAuthScanning, setLoginAuthScanning] = useState(false);

  const SECURE_ID_LENGTH = 12;
  const REFERRAL_LENGTH = 12;
  const PIN_LENGTH = 6;
  const OTP_LENGTH = 6;

  // Flips the card to the next face: rotate on edge, swap the content once
  // it's edge-on (so nothing appears mirrored), then rotate back to flat.
  const flipTo = (next) => {
    setFlipping(true);
    setTimeout(() => {
      setStage(next);
      setFlipping(false);
    }, 220);
  };

  // Secure ID and Referral no longer auto-advance as soon as they're full —
  // the person fills in the code, then taps Submit to move on.
  const effectiveLoginCountry = loginMobileCountry || dialCountry;
  const [loginMinLen, loginMaxLen] = mobileDigitRange(effectiveLoginCountry.iso);
  const loginMobileComplete = loginMobileBuffer.length >= loginMinLen;

  // Real GET /api/users/resolve for mobile-number login — finds the
  // Secure ID behind the typed mobile number before continuing into the
  // same PIN/biometric step the direct-Secure-ID path uses. The resolved
  // symbolId is stored in `secureId` (the same field the ID-entry path
  // fills in) so handleSubmitLoginAuth/handleBiometricVerify below don't
  // need to know which path got them there.
  const handleSubmitSecureId = async () => {
    if (isLoginAttempt && loginEntryMode === "mobile") {
      if (!loginMobileComplete || resolvingMobile) return;
      setLoginError(null);
      setResolvingMobile(true);
      try {
        const identifier = normalizeMobileForApi(effectiveLoginCountry, loginMobileBuffer);
        const resolved = await resolveUser(identifier);
        setSecureId(resolved.symbolId);
        setResolvingMobile(false);
        flipTo("loginAuth");
      } catch (err) {
        setResolvingMobile(false);
        setLoginError(err instanceof Error ? err.message : "No Gloobal ID found for that mobile number.");
      }
      return;
    }
    if (secureId.length !== SECURE_ID_LENGTH) return;
    if (isLoginAttempt) {
      setLoginError(null);
      flipTo("loginAuth");
      return;
    }
    flipTo("referral");
  };

  // Shared by the Referral submit button and "Skip for now" — real
  // POST /api/register-symbol call, once, right after the referral step
  // either way (referredBy just ends up empty on skip).
  const registerAndAdvance = async (referredByValue) => {
    if (registering) return;
    setRegisterError(null);
    setRegistering(true);
    try {
      const result = await registerUser({
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
      setRegisterError(err instanceof Error ? err.message : "Couldn't create your Gloobal ID. Try again.");
    }
  };

  const handleSubmitReferral = () => {
    if (referralCode.length === REFERRAL_LENGTH) registerAndAdvance(referralCode);
  };

  const handleSkipReferral = () => {
    registerAndAdvance("");
  };

  // Real POST /api/pin/set, then on to the one-time real passkey setup
  // step (see the "deviceSetup" stage) rather than straight to the
  // dashboard — a passkey has to actually be registered here for the
  // login screen's Face/Fingerprint buttons to ever have anything real to
  // verify against later.
  const handleSubmitPin = async () => {
    if (pin.length !== PIN_LENGTH || registering) return;
    setRegisterError(null);
    setRegistering(true);
    try {
      const symbolIdForPin = registeredUser?.symbolId || secureId;
      await apiSetPin(symbolIdForPin, pin);
      setRegistering(false);
      setDeviceSetupError(null);
      setDeviceSetupStatus(null);
      flipTo("deviceSetup");
    } catch (err) {
      setRegistering(false);
      setRegisterError(err instanceof Error ? err.message : "Couldn't set your PIN. Try again.");
    }
  };

  // Real POST /api/login — verifies Secure ID + PIN against the backend.
  const handleSubmitLoginAuth = async () => {
    if (loginAuthPin.length !== PIN_LENGTH || verifying) return;
    setLoginAuthError(null);
    setVerifying(true);
    try {
      const result = await apiLogin(secureId, loginAuthPin);
      setRegisteredUser(result.user);
      setVerifying(false);
      setLoginAuthPin("");
      flipTo("dashboard");
    } catch (err) {
      setVerifying(false);
      setLoginAuthError(err instanceof Error ? err.message : "That Secure ID or PIN wasn't recognized.");
    }
  };

  const friendlyPasskeyMessage = (raw) => {
    const lower = String(raw || "").toLowerCase();
    return lower.includes("not allowed") || lower.includes("timed out") || lower.includes("device")
      ? "This browser or device can't complete a passkey check here. Try live HTTPS or another device."
      : raw;
  };

  // Real WebAuthn verify — tapping Face ID or Fingerprint on the login
  // screen runs an actual passkey authentication ceremony against
  // whichever Secure ID is currently in the card (typed directly, or
  // resolved from a mobile-number lookup above).
  const handleBiometricVerify = async () => {
    if (loginAuthScanning || !secureId) return;
    setLoginAuthError(null);
    setLoginAuthScanning(true);
    setLoginAuthStatus("Requesting device authentication…");
    try {
      const options = await passkeyAuthOptions(secureId);
      const authResponse = await startAuthentication({ optionsJSON: options });
      setLoginAuthStatus("Verifying device response…");
      const verify = await passkeyAuthVerify(secureId, authResponse);
      if (!verify.verified) throw new Error("Device authentication failed.");
      const profile = await resolveUser(secureId);
      setRegisteredUser(profile);
      setLoginAuthScanning(false);
      setLoginAuthStatus(null);
      setLoginAuthPin("");
      flipTo("dashboard");
    } catch (err) {
      setLoginAuthScanning(false);
      setLoginAuthStatus(null);
      setLoginAuthError(friendlyPasskeyMessage(err instanceof Error ? err.message : "Device authentication failed."));
    }
  };

  // Real WebAuthn setup — shown once right after registration sets a PIN.
  // A passkey is optional (Skip for now is always available), but if the
  // person does set one up here, this is a real
  // POST /api/passkey/register/options + verify ceremony, not a fake
  // timeout.
  const handleBiometricSetup = async () => {
    if (deviceSetupBusy) return;
    const symbolId = registeredUser?.symbolId || secureId;
    if (!symbolId) return;
    setDeviceSetupError(null);
    setDeviceSetupBusy(true);
    setDeviceSetupStatus("Starting device security prompt…");
    try {
      const options = await passkeyRegisterOptions(symbolId);
      const registrationResponse = await startRegistration({ optionsJSON: options });
      setDeviceSetupStatus("Finalizing device authentication…");
      const verify = await passkeyRegisterVerify(symbolId, registrationResponse);
      if (!verify.verified) throw new Error("Device authentication setup failed.");
      setDeviceSetupBusy(false);
      setDeviceSetupStatus("Device authentication enabled.");
      setTimeout(() => flipTo("dashboard"), 500);
    } catch (err) {
      setDeviceSetupBusy(false);
      setDeviceSetupStatus(null);
      setDeviceSetupError(friendlyPasskeyMessage(err instanceof Error ? err.message : "Device authentication setup failed."));
    }
  };

  // Fire the moment the app opens, well before anyone has typed a phone
  // number and hit submit — so a cold Render backend has a head start
  // waking up before the real OTP send needs it. Fire-and-forget, never
  // surfaces an error.
  useEffect(() => {
    warmUpBackend();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
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
          el.style.opacity = p.opacity;
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
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real POST /api/otp/send — registration is OTP-gated, so this has to
  // succeed before the Secure ID step is reachable at all.
  const handleVerify = async () => {
    if (verifying || stage !== "phone") return;
    const digits = phoneNumber.replace(/\D/g, "");
    const [minLen, maxLen] = mobileDigitRange(dialCountry.iso);
    if (digits.length < minLen || digits.length > maxLen) return;
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
  };

  // Real POST /api/otp/verify.
  const handleSubmitOtp = async () => {
    if (otp.length !== OTP_LENGTH || verifying) return;
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
    setPhoneNumber("");
    setPhoneDialOpen(false);
    setShowLoginFace(false);
    setIsLoginAttempt(false);
    setLoginEntryMode("id");
    setLoginMobileBuffer("");
    setLoginMobileCountry(null);
    setShowLoginPicker(false);
    setLoginCountrySearch("");
    setSecureId("");
    setReferralCode("");
    setPin("");
    setOtp("");
    setOtpError(null);
    setRegisteredMobile("");
    setRegisteredUser(null);
    setRegisterError(null);
    setLoginError(null);
    setLoginAuthError(null);
    setLoginAuthStatus(null);
    setDeviceSetupError(null);
    setDeviceSetupStatus(null);
    setLoginAuthPin("");
    setLoginAuthScanning(false);
    flipTo("phone");
  };

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

      {stage === "phone" && (
        <div
          style={{
            position: "absolute",
            top: "calc(18px + env(safe-area-inset-top, 0px))",
            left: "calc(18px + env(safe-area-inset-left, 0px))",
            zIndex: 20,
          }}
        >
          {/* The mark sits in its own card rather than floating loose on
              the background — same surface/border/radius/shadow language
              as every other container in the app, so it reads as a
              deliberate brand lockup instead of a stray image. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
              borderRadius: T.radiusMd,
              background: T.surface,
              border: `1px solid ${T.line}`,
              boxShadow: T.shadowCard,
              boxSizing: "border-box",
            }}
          >
            <img
              src={globalIdLogo}
              alt="Gloobal ID"
              style={{ display: "block", width: "clamp(46px, 12vw, 52px)", height: "auto", objectFit: "contain" }}
            />
          </div>
        </div>
      )}

      {/* "Gloobal ID" wordmark — shown once, on the landing page during
          registration only. On the login page it doesn't repeat as a
          separate floating element anymore; the card's own top-center
          badge cycles through "Login" / "Gloobal" / "Id" instead, so the
          branding lives in one place rather than two overlapping ones. */}
      {stage === "phone" && (
        <div
          style={{
            position: "absolute",
            top: "calc(22px + env(safe-area-inset-top, 0px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            fontSize: "clamp(26px, 8vw, 32px)",
            fontWeight: 800,
            letterSpacing: 0.5,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            color: T.ink,
            fontFamily: T.fontDisplay,
          }}
        >
          Gl<span style={{ color: T.accent2 }}>o</span>
          <span style={{ color: "#C026D3" }}>o</span>bal ID
        </div>
      )}

      {/* The same "Gloobal ID" wordmark carried onto the Secure ID and
          Referral steps, so the brand heading reads identically on every
          screen of the flow instead of only on the landing page. Same
          type scale as the phone step's wordmark above. */}
      {(stage === "secureId" || stage === "referral") && (
        <div
          style={{
            position: "absolute",
            top: "calc(22px + env(safe-area-inset-top, 0px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            fontSize: "clamp(26px, 8vw, 32px)",
            fontWeight: 800,
            letterSpacing: 0.5,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            color: T.ink,
            fontFamily: T.fontDisplay,
          }}
        >
          Gl<span style={{ color: T.accent2 }}>o</span>
          <span style={{ color: "#C026D3" }}>o</span>bal ID
        </div>
      )}

      {/* Screen-level info corner — pinned to the top-right of the stage
          rather than to the card's own corner, where it used to collide
          with the eye toggle and the flip button. Same explanation
          overlays as before; only the anchor moved. */}
      {((stage === "secureId" && !isLoginAttempt) || stage === "referral") && (
        <button
          onClick={() => (stage === "referral" ? setShowReferralExplain(true) : setShowIdExplain(true))}
          aria-label={stage === "referral" ? "What is a referral?" : "What is a Gloobal ID?"}
          className="v2-tap"
          style={{
            position: "absolute",
            top: "calc(18px + env(safe-area-inset-top, 0px))",
            right: "calc(18px + env(safe-area-inset-right, 0px))",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `1.5px solid ${T.line}`,
            background: T.surface,
            color: T.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: T.shadowRaised,
            zIndex: 30,
          }}
        >
          <Info size={17} />
        </button>
      )}

      {/* Back navigation for the two steps that previously had none:
          Secure ID goes back to the OTP step it came from, and Referral
          goes back to the Secure ID step. Both sit opposite the info
          corner so neither control crowds the other. */}
      {(stage === "secureId" || stage === "referral") && (
        <button
          onClick={() => {
            if (stage === "referral") return flipTo("secureId");
            // Registration reached this card from the OTP step, so that's
            // where back belongs. A login attempt never passed through
            // OTP — it flipped straight here from the phone card — so it
            // has to unwind to "phone" instead, and drop the login flag
            // so the card comes back in its registration face.
            if (isLoginAttempt) {
              setIsLoginAttempt(false);
              setShowLoginFace(false);
              setLoginEntryMode("id");
              setLoginMobileBuffer("");
              setLoginError(null);
              return flipTo("phone");
            }
            return flipTo("otp");
          }}
          aria-label="Back"
          className="v2-tap"
          style={{
            position: "absolute",
            top: "calc(18px + env(safe-area-inset-top, 0px))",
            left: "calc(18px + env(safe-area-inset-left, 0px))",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `1.5px solid ${T.line}`,
            background: T.surface,
            color: T.ink,
            fontSize: 19,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: T.shadowRaised,
            zIndex: 30,
          }}
        >
          ‹
        </button>
      )}

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
                <PhoneConnector
                  country={dialCountry}
                  phoneNumber={phoneNumber}
                  onOpenPicker={() => setShowPicker(true)}
                  onOpenDial={() => setPhoneDialOpen(true)}
                  dialOpen={phoneDialOpen}
                  onActivate={handleVerify}
                  verifying={verifying}
                  showLogin={showLoginFace}
                  onLoginTap={() => {
                    setIsLoginAttempt(true);
                    // Always start a fresh login attempt on the Secure ID
                    // face, and clear any mobile buffer left over from a
                    // previous attempt this session — otherwise a stale
                    // "mobile" mode from before can carry over here and
                    // the card opens asking for a mobile number instead.
                    setLoginEntryMode("id");
                    setLoginMobileBuffer("");
                    setLoginMobileCountry(null);
                    flipTo("secureId");
                  }}
                />
              )}

              {stage === "phone" && otpError && (
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: "#EF4444", textAlign: "center" }}>
                  {otpError}
                </div>
              )}

              {/* Flip to log in — on the card's own boundary now, not on
                  the call button, same treatment as the Secure ID card's
                  flip icon. Keeps a slow, continuous spin on its own (not
                  tied to being tapped) so it reads as "this can be flipped"
                  at a glance instead of sitting there looking static. */}
              {stage === "phone" && (
                <button
                  onClick={() => {
                    // One tap = straight into the real login card (Secure
                    // ID face), not just a relabeled button still sitting
                    // on the phone-number screen. Previously this only
                    // toggled showLoginFace, which swapped the round
                    // button's label to "IN" but left the phone-number
                    // field on screen — a second tap on that button was
                    // needed to actually reach the Secure ID card, which
                    // read as "flip does nothing" / "IN doesn't log me in."
                    setShowLoginFace(true);
                    setIsLoginAttempt(true);
                    setLoginEntryMode("id");
                    setLoginMobileBuffer("");
                    setLoginMobileCountry(null);
                    flipTo("secureId");
                  }}
                  aria-label="Flip to log in"
                  className="v2-tap"
                  style={{
                    position: "absolute",
                    top: -20,
                    right: -18,
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    border: `1.5px solid ${T.line}`,
                    background: T.surface,
                    color: T.accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: T.shadowRaised,
                    zIndex: 3,
                  }}
                >
                  <RefreshCw size={22} style={{ animation: "iconAttention 2s linear infinite" }} />
                </button>
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
                    minWidth: 44,
                    textAlign: "center",
                  }}
                >
                  {isLoginAttempt ? (
                    <CyclingBadge words={LOGIN_BADGE_WORDS} intervalMs={2600} />
                  ) : (
                    <CyclingBadge words={CREATE_BADGE_WORDS} intervalMs={2600} />
                  )}
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

              {/* The info button that used to sit on this card's top-right
                  corner now lives at the screen's own top-right instead
                  (see the screen-level info corner above), so it can't
                  crowd the card's eye/flip controls. */}

              {stage === "otp" && (
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
                  Verify OTP
                </span>
              )}

              {/* Edit number — flips back to the phone step, same corner
                  spot the flip-to-login icon uses on that step. */}
              {stage === "otp" && (
                <button
                  onClick={() => flipTo("phone")}
                  aria-label="Edit phone number"
                  className="v2-tap"
                  style={{
                    position: "absolute",
                    top: -11,
                    right: 16,
                    background: "none",
                    border: "none",
                    color: T.accent2,
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: "3px 4px",
                  }}
                >
                  Edit number
                </button>
              )}

              {/* Eye toggle: mask/reveal the code — same on both
                  registration and login, but only relevant in ID mode.
                  Shifted left of its usual spot on login so it doesn't
                  collide with the bigger flip-to-mobile icon in the
                  top-right corner. */}
              {/* Eye toggle for OTP — shifted left of "Edit number" so the
                  two controls don't collide in the same top-right corner. */}
              {stage === "otp" && (
                <button
                  onClick={() => setOtpRevealed((v) => !v)}
                  aria-label={otpRevealed ? "Hide OTP" : "Show OTP"}
                  className="v2-tap"
                  style={{
                    position: "absolute",
                    top: -11,
                    right: 90,
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
                    zIndex: 2,
                  }}
                >
                  <MaskEyeIcon open={otpRevealed} color={T.inkSoft} />
                </button>
              )}

              {stage === "secureId" && (!isLoginAttempt || loginEntryMode === "id") && (
                <button
                  onClick={() => setSecureIdRevealed((v) => !v)}
                  aria-label={secureIdRevealed ? "Hide Secure ID" : "Show Secure ID"}
                  className="v2-tap"
                  style={{
                    position: "absolute",
                    top: -11,
                    right: isLoginAttempt ? 68 : 16,
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
                    zIndex: 2,
                  }}
                >
                  <MaskEyeIcon open={secureIdRevealed} color={T.inkSoft} />
                </button>
              )}

              {/* Eye toggle for the mobile login number — same boundary
                  spot the Secure ID eye uses in ID mode (right: 68, clear
                  of the bigger flip-to-mobile icon in the corner). */}
              {stage === "secureId" && isLoginAttempt && loginEntryMode === "mobile" && (
                <button
                  onClick={() => setLoginMobileRevealed((v) => !v)}
                  aria-label={loginMobileRevealed ? "Hide mobile number" : "Show mobile number"}
                  className="v2-tap"
                  style={{
                    position: "absolute",
                    top: -11,
                    right: 68,
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
                    zIndex: 2,
                  }}
                >
                  <MaskEyeIcon open={loginMobileRevealed} color={T.inkSoft} />
                </button>
              )}

              {/* Flip to mobile — login only. Fixed to the card's top-right
                  corner (not tied to the card's height, which changes
                  between ID and mobile content) so it's always in the same
                  reachable spot in both modes. Twice the size of the eye
                  toggle, and visibly rotates on tap. */}
              {stage === "secureId" && isLoginAttempt && (
                <button
                  onClick={() => setLoginEntryMode((m) => (m === "id" ? "mobile" : "id"))}
                  aria-label={`Switch to ${loginEntryMode === "id" ? "mobile number" : "Gloobal ID"}`}
                  className="v2-tap"
                  style={{
                    position: "absolute",
                    top: -20,
                    right: -18,
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    border: `1.5px solid ${T.line}`,
                    background: T.surface,
                    color: T.accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: T.shadowRaised,
                    zIndex: 3,
                  }}
                >
                  <RefreshCw
                    size={22}
                    style={{
                      transform: loginEntryMode === "mobile" ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
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

              {stage === "secureId" && (!isLoginAttempt || loginEntryMode === "id") && (
                <SymbolChipRow length={SECURE_ID_LENGTH} value={secureId} masked={!secureIdRevealed} />
              )}

              {stage === "secureId" && isLoginAttempt && loginEntryMode === "mobile" && (
                <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", gap: 10 }}>
                  <button
                    onClick={() => setShowLoginPicker(true)}
                    aria-label={`Country: ${effectiveLoginCountry.name}. Tap to change`}
                    style={{ flexShrink: 0, width: 46, height: 40, borderRadius: 13, border: `1px solid ${T.line}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                  >
                    <FlagEmoji flag={effectiveLoginCountry.flag} width={38} height={32} radius={10} dropShadow="drop-shadow(0 4px 10px rgba(76,29,149,0.18))" />
                  </button>

                  {/* Masked by default, revealed with the eye toggle that
                      now sits on the card's boundary (top-right corner)
                      instead of inline here — same spot the Secure ID eye
                      uses in ID mode. */}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: T.radiusMd, padding: "9px 13px" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, letterSpacing: loginMobileRevealed ? 0 : 2, color: loginMobileBuffer ? T.ink : T.inkFaint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {loginMobileBuffer
                        ? loginMobileRevealed
                          ? loginMobileBuffer.replace(/(\d{3})(?=\d)/g, "$1 ")
                          : loginMobileBuffer.replace(/\d/g, "•").replace(/(.{3})(?=.)/g, "$1 ")
                        : "Mobile number"}
                    </span>
                  </div>
                </div>
              )}

              {stage === "referral" && (
                <SymbolChipRow length={REFERRAL_LENGTH} value={referralCode} masked={!referralRevealed} />
              )}

              {stage === "otp" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
                  <span style={{ fontSize: 11.5, color: T.inkFaint, fontWeight: 600, textAlign: "center" }}>
                    Enter the code sent to {dialCountry.dialCode} {phoneNumber}
                  </span>
                  <SymbolChipRow length={OTP_LENGTH} value={otp} masked={!otpRevealed} boxSize={34} justify="center" />
                </div>
              )}
            </div>

            {/* Symbol dial pad — same compact grid-button pattern as
                PhoneDialPad, sized down so the card, dial, and button all
                stay fully visible together on one screen. */}
            {stage === "secureId" && (!isLoginAttempt || loginEntryMode === "id") && (
              <div style={{ marginTop: 32, position: "relative", zIndex: 1, width: "100%" }}>
                <SymbolDialPad value={secureId} onChange={setSecureId} length={SECURE_ID_LENGTH} />
              </div>
            )}

            {stage === "secureId" && isLoginAttempt && loginEntryMode === "mobile" && (
              <div style={{ marginTop: 28, position: "relative", zIndex: 1, width: "100%" }}>
                <PhoneDialPad
                  value={loginMobileBuffer}
                  onChange={setLoginMobileBuffer}
                  minLength={loginMinLen}
                  maxLength={loginMaxLen}
                  onSubmit={handleSubmitSecureId}
                />
                {loginError && (
                  <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: "#EF4444", textAlign: "center" }}>
                    {loginError}
                  </div>
                )}
              </div>
            )}

            {stage === "referral" && (
              <div style={{ marginTop: 32, position: "relative", zIndex: 1, width: "100%" }}>
                <SymbolDialPad value={referralCode} onChange={setReferralCode} length={REFERRAL_LENGTH} />
              </div>
            )}

            {stage === "phone" && phoneDialOpen && (
              <div style={{ marginTop: 28, position: "relative", zIndex: 1, width: "100%" }}>
                <PhoneDialPad
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  minLength={mobileDigitRange(dialCountry.iso)[0]}
                  maxLength={mobileDigitRange(dialCountry.iso)[1]}
                  onSubmit={handleVerify}
                />
              </div>
            )}

            {/* OTP dial pad — the numeric code is 6 digits, entered with
                the exact same dial pad as the mobile number step, not the
                symbol dial used for the 12-character Secure/Referral ID. */}
            {stage === "otp" && (
              <div style={{ marginTop: 28, position: "relative", zIndex: 1, width: "100%" }}>
                <PhoneDialPad value={otp} onChange={setOtp} minLength={OTP_LENGTH} maxLength={OTP_LENGTH} onSubmit={handleSubmitOtp} />
              </div>
            )}

            {stage === "secureId" && !isLoginAttempt && (
              <div style={{ marginTop: 20 }}>
                <SubmitButton
                  onClick={handleSubmitSecureId}
                  disabled={secureId.length !== SECURE_ID_LENGTH}
                  label="IN"
                />
              </div>
            )}

            {stage === "secureId" && isLoginAttempt && loginEntryMode === "id" && (
              <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
                <CircularInButton onClick={handleSubmitSecureId} disabled={secureId.length !== SECURE_ID_LENGTH} size={44} />
              </div>
            )}

            {stage === "referral" && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
                {registerError && (
                  <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: "#EF4444", textAlign: "center" }}>
                    {registerError}
                  </div>
                )}
                <SubmitButton
                  onClick={handleSubmitReferral}
                  disabled={referralCode.length !== REFERRAL_LENGTH || registering}
                  label={registering ? "Submitting…" : "IN"}
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
                    cursor: registering ? "default" : "pointer",
                    padding: "6px 8px",
                  }}
                >
                  {registering ? "Continuing…" : "Skip for now"}
                </button>
              </div>
            )}

            {stage === "otp" && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
                {otpError && (
                  <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: "#EF4444", textAlign: "center" }}>
                    {otpError}
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (verifying) return;
                    setOtp("");
                    setOtpError(null);
                    setVerifying(true);
                    try {
                      await sendOtp(registeredMobile);
                    } catch (err) {
                      setOtpError(err instanceof Error ? err.message : "Couldn't resend OTP. Try again.");
                    } finally {
                      setVerifying(false);
                    }
                  }}
                  disabled={verifying}
                  style={{
                    border: "none",
                    background: "none",
                    color: T.accent2,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: verifying ? "default" : "pointer",
                    padding: "6px 8px",
                  }}
                >
                  Resend code
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {stage === "phone" && !phoneDialOpen && (
        <div style={{ position: "absolute", left: "50%", bottom: "3%", transform: "translateX(-50%)", zIndex: 20, width: "100%", padding: "0 16px", display: "flex", justifyContent: "center" }}>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.4,
              color: T.inkFaint,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            Cashless · Textless · Borderless · Limitless
          </span>
        </div>
      )}

      {stage === "pin" && (
        <PinScreen
          value={pin}
          length={PIN_LENGTH}
          onChange={setPin}
          onSubmit={handleSubmitPin}
          onBack={() => flipTo("referral")}
          revealed={pinRevealed}
          onToggleReveal={() => setPinRevealed((v) => !v)}
          error={registerError}
          submitting={registering}
        />
      )}

      {stage === "loginAuth" && (
        <LoginAuthScreen
          mode="login"
          value={loginAuthPin}
          length={PIN_LENGTH}
          onChange={setLoginAuthPin}
          onSubmit={handleSubmitLoginAuth}
          onBack={() => {
            setLoginAuthPin("");
            setLoginAuthError(null);
            flipTo("secureId");
          }}
          revealed={loginAuthRevealed}
          onToggleReveal={() => setLoginAuthRevealed((v) => !v)}
          onBiometric={handleBiometricVerify}
          scanning={loginAuthScanning || verifying}
          error={loginAuthError}
          status={loginAuthStatus}
        />
      )}

      {stage === "deviceSetup" && (
        <LoginAuthScreen
          mode="setup"
          value=""
          length={PIN_LENGTH}
          onChange={() => {}}
          onSubmit={() => {}}
          onBack={() => flipTo("dashboard")}
          revealed={false}
          onToggleReveal={() => {}}
          onBiometric={handleBiometricSetup}
          scanning={deviceSetupBusy}
          error={deviceSetupError}
          status={deviceSetupStatus}
          onSkip={() => flipTo("dashboard")}
        />
      )}

      {stage === "dashboard" && (
        <ErrorBoundary>
          <Suspense fallback={<ScreenFallback />}>
            <DashboardScreen
              dialCountry={dialCountry}
              onLogout={handleStartOver}
              onOpenSend={() => setActiveScreen("send")}
              onOpenBank={() => setActiveScreen("bank")}
              onOpenCoverage={() => setActiveScreen("coverage")}
              myGloobalId={registeredUser?.symbolId || secureId}
              referralCount={registeredUser?.referralCount}
              phoneNumber={phoneNumber}
              fullName={registeredUser?.fullName}
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
                sender={{
                  ...dialCountry,
                  phoneNumber,
                  symbolId: registeredUser?.symbolId || secureId,
                  fullName: registeredUser?.fullName,
                }}
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
            <GloobalCoverageScreen onClose={() => setActiveScreen(null)} dialCountry={dialCountry} />
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

      {showLoginPicker && (
        <CountryPickerScreen
          topCountries={TOP_COUNTRIES}
          countries={ALL_COUNTRIES}
          search={loginCountrySearch}
          onSearch={setLoginCountrySearch}
          onSelect={(c) => {
            setLoginMobileCountry(c);
            setLoginMobileBuffer("");
            setShowLoginPicker(false);
            setLoginCountrySearch("");
          }}
          onClose={() => {
            setShowLoginPicker(false);
            setLoginCountrySearch("");
          }}
        />
      )}

      {showIdExplain && (
        <ExplainSheet title="What is a Gloobal ID?" onClose={() => setShowIdExplain(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ borderRadius: T.radiusLg, background: T.surfaceAlt, border: `1px solid ${T.line}`, padding: "16px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Gloobal Symbols</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6 }}>
                Instead of ordinary digits or letters, a Gloobal ID is built from eight shapes we call Gloobal
                Symbols — four math signs and four hollow/filled shapes:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {["−", "+", "×", "=", "○", "□", "●", "■"].map((s) => (
                  <span
                    key={s}
                    style={{
                      width: 34, height: 34, borderRadius: 10, background: T.surface, border: `1px solid ${T.line}`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: T.accent,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6, marginTop: 10 }}>
                Twelve of these symbols, picked and ordered however you like, make up your own Gloobal ID —
                yours to remember and share, in place of a phone number or account number.
              </div>
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Two examples
            </div>
            {[
              { label: "Example 1", code: "+−×=○□●■+−×=" },
              { label: "Example 2", code: "●■○□+−×=●■○□" },
            ].map((ex) => (
              <div key={ex.label} style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "14px 16px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkFaint, marginBottom: 6 }}>{ex.label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: 2, fontFamily: T.fontDisplay }}>{ex.code}</div>
              </div>
            ))}
          </div>
        </ExplainSheet>
      )}

      {showReferralExplain && (
        <ExplainSheet title="What is a referral?" onClose={() => setShowReferralExplain(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ borderRadius: T.radiusLg, background: T.surfaceAlt, border: `1px solid ${T.line}`, padding: "16px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Your referral code</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6 }}>
                Your Gloobal ID also works as a referral code. Share it with a friend — when they register
                using it, you&apos;re both connected inside your Referral Network in Profile.
              </div>
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Benefits
            </div>
            {[
              { title: "Earn together", body: "You and the friend you invite both get a welcome reward once they complete registration." },
              { title: "Grow your network", body: "Everyone you refer shows up in My Referral Network, so you can track who's joined and what you've earned." },
              { title: "No limit", body: "There's no cap on how many people you can refer — the more you invite, the more it adds up." },
            ].map((b) => (
              <div key={b.title} style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: T.positiveSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Gift size={15} color={T.positive} />
                </span>
                <span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2, lineHeight: 1.5 }}>{b.body}</div>
                </span>
              </div>
            ))}
          </div>
        </ExplainSheet>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes phoneFlipPop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes badgePop { from { transform: translateY(-3px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes iconAttention { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .phone-flip-btn { animation: phoneFlipPop 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
        /* Ambient dashboard motion — floating financial symbols, drifting
           dots, and slow geometric outlines. Transform/opacity only, so
           these stay on the compositor thread. */
        @keyframes finDrift {
          0% { transform: translate3d(0, 0, 0) rotate(var(--r0)); opacity: 0; }
          12% { opacity: var(--peak-op); }
          88% { opacity: var(--peak-op); }
          100% { transform: translate3d(var(--dx), var(--dy), 0) rotate(var(--r1)); opacity: 0; }
        }
        @keyframes finDotPulse {
          0%, 100% { transform: translate3d(0, 0, 0) scale(0.7); opacity: 0; }
          50% { transform: translate3d(0, -6px, 0) scale(1); opacity: var(--peak-op); }
        }
        @keyframes finGlow {
          0%, 100% { filter: none; }
          50% { filter: drop-shadow(0 0 6px currentColor) brightness(1.5); }
        }
        @keyframes finGeoSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-hidden="true"] span, [aria-hidden="true"] div { animation: none !important; opacity: 0 !important; }
        }
        @keyframes signalWave {
          0%, 100% { transform: scale(0.6); opacity: 0.3; box-shadow: none; }
          50% { transform: scale(1.35); opacity: 1; box-shadow: 0 0 6px 2px rgba(124,58,237,0.55); }
        }
        button:focus-visible {
          outline: 2px solid #3b6ef5;
          outline-offset: 2px;
        }
        /* Shared Version 2 tap/row feedback — used across registration,
           dashboard, country picker, and PIN screens for a consistent,
           lightweight "premium" press feel. Purely visual, no logic. */
        .v2-tap { transition: transform 0.1s ease, box-shadow 0.15s ease, background 0.15s ease; }
        .v2-tap:active { transform: scale(0.94); }
        .v2-row { transition: background 0.15s ease; }
        .v2-row:hover { background: rgba(124,58,237,0.05); }
        .v2-row:active { background: rgba(124,58,237,0.09); }
        @keyframes successPop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .v2-success-pop { animation: successPop 0.35s cubic-bezier(.34,1.56,.64,1); }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
          .v2-tap:active { transform: none; }
        }
      `}</style>
    </div>
  );
}

export default GloobalId;
