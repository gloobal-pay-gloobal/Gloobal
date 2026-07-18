import React, { Suspense, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  Fingerprint,
} from "lucide-react";
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
  const [pin, setPin] = useState("123456");
  // The 6-digit code sent to the phone number just entered. Pre-filled with
  // a stand-in demo value (123456) since there's no real SMS backend here.
  const [otp, setOtp] = useState("123456");
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

  const handleSubmitSecureId = () => {
    if (isLoginAttempt && loginEntryMode === "mobile") {
      if (!loginMobileComplete) return;
      flipTo("loginAuth");
      return;
    }
    if (secureId.length !== SECURE_ID_LENGTH) return;
    if (isLoginAttempt) {
      flipTo("loginAuth");
      return;
    }
    flipTo("referral");
  };

  const handleSubmitReferral = () => {
    if (referralCode.length === REFERRAL_LENGTH) flipTo("pin");
  };

  const handleSubmitPin = () => {
    if (pin.length === PIN_LENGTH) flipTo("dashboard");
  };

  // Confirms the login PIN — in this demo any complete code is accepted,
  // same as the OTP step, since there's no real backend to check against.
  const handleSubmitLoginAuth = () => {
    if (loginAuthPin.length !== PIN_LENGTH) return;
    setLoginAuthPin("");
    flipTo("dashboard");
  };

  // Face / Fingerprint — a brief "scanning" beat on the tapped icon, then
  // straight through to the dashboard, same destination the PIN reaches.
  const handleBiometricAuth = () => {
    if (loginAuthScanning) return;
    setLoginAuthScanning(true);
    setTimeout(() => {
      setLoginAuthScanning(false);
      setLoginAuthPin("");
      flipTo("dashboard");
    }, 700);
  };

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

  const handleVerify = () => {
    if (verifying || stage !== "phone") return;
    const digits = phoneNumber.replace(/\D/g, "");
    const [minLen, maxLen] = mobileDigitRange(dialCountry.iso);
    if (digits.length < minLen || digits.length > maxLen) return;
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      flipTo("otp");
    }, 900);
  };

  const handleSubmitOtp = () => {
    if (otp.length !== OTP_LENGTH) return;
    flipTo("secureId");
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
    setOtp("123456");
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
          <img
            src={globalIdLogo}
            alt="Gloobal ID"
            style={{ display: "block", width: "clamp(46px, 12vw, 52px)", height: "auto", objectFit: "contain" }}
          />
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
                  label="Submit"
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
                <SubmitButton
                  onClick={handleSubmitReferral}
                  disabled={referralCode.length !== REFERRAL_LENGTH}
                />
                <button
                  onClick={() => flipTo("pin")}
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
                  Skip for now
                </button>
              </div>
            )}

            {stage === "otp" && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <button
                  onClick={() => setOtp("")}
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
        />
      )}

      {stage === "loginAuth" && (
        <LoginAuthScreen
          value={loginAuthPin}
          length={PIN_LENGTH}
          onChange={setLoginAuthPin}
          onSubmit={handleSubmitLoginAuth}
          onBack={() => {
            setLoginAuthPin("");
            flipTo("secureId");
          }}
          revealed={loginAuthRevealed}
          onToggleReveal={() => setLoginAuthRevealed((v) => !v)}
          onBiometric={handleBiometricAuth}
          scanning={loginAuthScanning}
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
              myGloobalId={secureId}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeScreen === "send" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 190, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <ErrorBoundary>
            <Suspense fallback={<ScreenFallback />}>
              <SendMoneyScreen onClose={() => setActiveScreen(null)} sender={{ ...dialCountry, phoneNumber }} />
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
