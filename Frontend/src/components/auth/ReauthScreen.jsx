import React, { useEffect, useRef, useState } from "react";
import { Fingerprint, ScanFace, ShieldAlert } from "lucide-react";
import { PhoneDialPad } from "../common/DialPads";
import { FlagEmoji } from "../common/FlagComponents";
import { T } from "../../styles/theme";
import { PinScreenHeader, PinChipCard } from "./PinScreenShell";

// The lock screen. Shown on every app open, relaunch, and refresh where a
// session was restored — the dashboard is never reachable from cold
// storage alone.
//
// Before this screen existed, a restored session went straight to the
// dashboard, so anyone holding an unlocked phone had the account: no
// passkey, no PIN, nothing. The persisted blob now says *whose* account to
// unlock, and this screen is what unlocks it.
//
// Three ways in, in order of preference:
//   1. Passkey. Fired automatically on mount when this device enrolled
//      one, because the whole point of Face ID is not having to ask.
//   2. PIN. The fallback whenever the passkey is declined, cancelled,
//      unavailable, or was never set up. Always reachable — a passkey
//      prompt that fails must never be a dead end.
//   3. Neither. A device with no platform authenticator and an account
//      with no PIN cannot be verified at all, so the screen stops and
//      asks for a device lock instead of pretending to authenticate.

const PIN_LENGTH = 6;
const VISIBLE_ID_SYMBOLS = 4;
const MASKED_TAIL_LENGTH = 8;

// The character standing in for a hidden symbol. It must not be one of the
// eight Gloobal Symbols, and this is the whole bug it fixes: the mask used
// to be "●", which is the *dot* symbol — a legal part of every Gloobal ID.
// An account whose real ID was −+×=○□●■−+×= therefore rendered here as
// −+×=●●●●●●●●, which is not a masked ID at all but a different, perfectly
// valid-looking one. The founder read it as exactly that and reported the
// lock screen was naming the wrong account.
//
// "•" (U+2022 BULLET) is the same stand-in SymbolChipRow already uses for
// every other masked code in the app, so the lock screen now hides symbols
// the way the rest of the app does.
const MASK_CHAR = "•";

// Shows enough of the ID to confirm "yes, that's my account" and no more.
// The tail length is fixed rather than derived from the real ID's length,
// so the dots don't leak how long the ID is.
export function maskSymbolId(symbolId) {
  const id = String(symbolId || "");
  if (!id) return "";
  return id.slice(0, VISIBLE_ID_SYMBOLS) + MASK_CHAR.repeat(MASKED_TAIL_LENGTH);
}

// Android exposes a settings deep link; nothing equivalent exists on iOS
// or desktop, where the only honest answer is to say where to look.
const ANDROID_SECURITY_SETTINGS = "intent:#Intent;action=android.settings.SECURITY_SETTINGS;end";
const isAndroid = () =>
  typeof navigator !== "undefined" && /android/i.test(navigator.userAgent || "");

export function ReauthScreen({
  user,
  countryEmoji,
  biometricEnrolled,
  platformAuthenticatorAvailable,
  pin,
  onPinChange,
  onSubmitPin,
  onBiometric,
  onDifferentAccount,
  scanning,
  error,
  status,
}) {
  const [revealed, setRevealed] = useState(false);
  const autoFired = useRef(false);

  const hasPin = user?.hasPin !== false;
  // Only the total absence of both routes is a dead end. An enrolled
  // passkey counts even when the capability probe is still pending, so a
  // slow probe never downgrades someone to the phone-lock message.
  const canUseBiometric = Boolean(biometricEnrolled) || platformAuthenticatorAvailable === true;
  const lockedOut = !canUseBiometric && !hasPin;

  // Fire the passkey ceremony on arrival rather than making the person tap
  // a button to reach a prompt they were always going to get. Guarded by a
  // ref, not by state, so a re-render mid-ceremony can't start a second one.
  useEffect(() => {
    if (autoFired.current) return;
    if (!biometricEnrolled || !onBiometric) return;
    autoFired.current = true;
    onBiometric("auto");
  }, [biometricEnrolled, onBiometric]);

  return (
    <div
      data-testid="reauth-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: T.fontBody,
      }}
    >
      {/* No back button. There is nowhere behind this screen: it is the
          first thing a restored session sees, and the only ways out are
          authenticating or the explicit "Sign in with a different account"
          link at the bottom, which clears the session on purpose. The
          header's arrow used to be wired straight to that link, so tapping
          back read as "go back one step" and silently logged the person
          out instead. */}
      <PinScreenHeader title="Verify it's you" />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 20,
          padding: "32px 24px 40px",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Whose account is being unlocked. The flag and the first four
            symbols are the whole identity claim — enough to catch "this is
            my partner's phone", not enough to be worth stealing. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {countryEmoji && <FlagEmoji flag={countryEmoji} width={44} height={33} radius={6} />}
          <span
            data-testid="reauth-masked-id"
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: 2,
              color: T.ink,
              fontFamily: T.fontDisplay,
            }}
          >
            {maskSymbolId(user?.symbolId)}
          </span>
          {user?.fullName && (
            <span style={{ fontSize: 13, fontWeight: 700, color: T.inkFaint }}>{user.fullName}</span>
          )}
        </div>

        {lockedOut ? (
          <div
            data-testid="reauth-device-lock"
            style={{
              width: "100%",
              maxWidth: 320,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              padding: 20,
              borderRadius: T.radiusLg,
              background: T.surface,
              border: `1px solid ${T.line}`,
              boxShadow: T.shadowCard,
              boxSizing: "border-box",
            }}
          >
            <ShieldAlert size={40} color={T.accent} />
            <p style={{ margin: 0, textAlign: "center", fontSize: 13.5, fontWeight: 700, color: T.ink }}>
              Please lock your device with a PIN or pattern to use Gloobal securely.
            </p>
            {isAndroid() ? (
              <button
                type="button"
                onClick={() => {
                  window.location.href = ANDROID_SECURITY_SETTINGS;
                }}
                className="v2-tap"
                style={{
                  border: "none",
                  borderRadius: T.radiusSm,
                  background: T.gradButton,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  padding: "11px 20px",
                  cursor: "pointer",
                }}
              >
                Set up security
              </button>
            ) : (
              <p style={{ margin: 0, textAlign: "center", fontSize: 12, fontWeight: 600, color: T.inkFaint }}>
                Open your device Settings and turn on a screen lock, then come back to Gloobal.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* The passkey route. Present whenever the device can do it,
                whether or not the automatic attempt already ran — a
                cancelled prompt has to be retryable. */}
            {canUseBiometric && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28 }}>
                <BiometricButton
                  icon={<ScanFace size={44} />}
                  label="Face ID"
                  ariaLabel="Verify with Face ID"
                  disabled={scanning}
                  onClick={() => onBiometric("face")}
                />
                <BiometricButton
                  icon={<Fingerprint size={44} />}
                  label="Fingerprint"
                  ariaLabel="Verify with fingerprint"
                  disabled={scanning}
                  onClick={() => onBiometric("fingerprint")}
                />
              </div>
            )}

            {/* The PIN route. Never hidden behind the biometric one: if the
                passkey prompt is dismissed there has to be something already
                on screen to fall back to. */}
            {hasPin && (
              <>
                {canUseBiometric && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint }}>or enter your PIN</span>
                )}
                <PinChipCard
                  length={PIN_LENGTH}
                  value={pin}
                  revealed={revealed}
                  onToggleReveal={() => setRevealed((v) => !v)}
                />
                <PhoneDialPad
                  value={pin}
                  onChange={onPinChange}
                  minLength={PIN_LENGTH}
                  maxLength={PIN_LENGTH}
                  onSubmit={onSubmitPin}
                />
              </>
            )}
          </>
        )}

        {status && !error && (
          <p style={{ margin: 0, textAlign: "center", color: T.inkFaint, fontSize: 12, fontWeight: 600 }}>{status}</p>
        )}
        {error && (
          <p style={{ margin: 0, textAlign: "center", color: "#dc2626", fontSize: 12, fontWeight: 700 }}>{error}</p>
        )}

        <button
          type="button"
          onClick={onDifferentAccount}
          className="v2-tap"
          style={{
            border: "none",
            background: "none",
            color: T.inkFaint,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            padding: "6px 8px",
            textDecoration: "underline",
            marginTop: "auto",
          }}
        >
          Sign in with a different account
        </button>
      </div>
    </div>
  );
}

// Same 88px target the post-PIN setup screen uses, so the two biometric
// screens in the app are visibly the same control.
function BiometricButton({ icon, label, ariaLabel, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="v2-tap"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        border: "none",
        background: "none",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <span
        style={{
          width: 88,
          height: 88,
          borderRadius: "50%",
          border: `1.5px solid ${T.line}`,
          background: T.surface,
          boxShadow: T.shadowCard,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: T.accent,
          animation: disabled ? "iconAttention 0.7s ease-in-out infinite" : "none",
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkFaint }}>{label}</span>
    </button>
  );
}
