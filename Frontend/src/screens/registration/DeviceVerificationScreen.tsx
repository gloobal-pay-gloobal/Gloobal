import React, { useCallback, useEffect, useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { SubmitButton } from "../../components/common/FormPrimitives";
import { T } from "../../styles/theme";
import { Shield, Fingerprint } from "lucide-react";
import {
  passkeyStatus,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  passkeyAuthOptions,
  passkeyAuthVerify,
} from "../../services/api/authApi";

interface DeviceVerificationScreenProps {
  symbolId: string;
  onVerified: () => void;
  onBack: () => void;
}

// Real WebAuthn device step — ported from the working DeviceAuth.jsx
// reference (checks /api/passkey/status first, then either registers a
// new passkey or verifies an existing one) into this app's card/dial
// design system instead of DeviceAuth.css. Shown after PIN during
// registration, and after PIN during login.
export function DeviceVerificationScreen({ symbolId, onVerified, onBack }: DeviceVerificationScreenProps) {
  const [checking, setChecking] = useState(true);
  const [hasPasskey, setHasPasskey] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Checking device authentication…");
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!symbolId) {
      setStatus("Secure ID is missing.");
      setChecking(false);
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const result = await passkeyStatus(symbolId);
      setHasPasskey(Boolean(result.hasPasskey));
      setStatus(result.hasPasskey ? "Device is ready for verification." : "Set up device authentication once.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check device authentication.");
      setHasPasskey(false);
    } finally {
      setChecking(false);
    }
  }, [symbolId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const friendlyMessage = (raw: string) => {
    const lower = raw.toLowerCase();
    return lower.includes("not allowed") || lower.includes("timed out") || lower.includes("device")
      ? "This browser or device cannot handle a passkey here. Try live HTTPS or another device."
      : raw;
  };

  const setupDevice = async () => {
    setBusy(true);
    setError(null);
    setStatus("Starting device security prompt…");
    try {
      const options = await passkeyRegisterOptions(symbolId);
      const registrationResponse = await startRegistration({ optionsJSON: options as never });
      setStatus("Finalizing device authentication…");
      const verify = await passkeyRegisterVerify(symbolId, registrationResponse);
      if (verify.verified) {
        setStatus("Device authentication enabled.");
        setTimeout(onVerified, 700);
      } else {
        setError("Device authentication setup failed.");
      }
    } catch (err) {
      setError(friendlyMessage(err instanceof Error ? err.message : "Device authentication setup failed."));
    } finally {
      setBusy(false);
    }
  };

  const verifyDevice = async () => {
    setBusy(true);
    setError(null);
    setStatus("Requesting device authentication…");
    try {
      const options = await passkeyAuthOptions(symbolId);
      const authResponse = await startAuthentication({ optionsJSON: options as never });
      setStatus("Verifying device response…");
      const verify = await passkeyAuthVerify(symbolId, authResponse);
      if (verify.verified) {
        setStatus("Device authentication successful.");
        setTimeout(onVerified, 600);
      } else {
        setError("Device authentication failed.");
      }
    } catch (err) {
      setError(friendlyMessage(err instanceof Error ? err.message : "Device authentication failed."));
    } finally {
      setBusy(false);
    }
  };

  const primaryLabel = busy
    ? "Please wait…"
    : hasPasskey
    ? "Verify Face / Fingerprint"
    : "Set up Face / Fingerprint";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 105,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: T.fontBody,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "18px 16px 12px",
          background: T.surface,
          borderBottom: `1px solid ${T.line}`,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "none",
            background: T.surfaceAlt,
            fontSize: 18,
            color: T.ink,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-label="Back"
        >
          ‹
        </button>
        <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Device Verification</span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          padding: "32px 24px 40px",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 118,
            height: 118,
            borderRadius: "50%",
            background: T.gradPrimary,
            boxShadow: T.shadowRaised,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Fingerprint size={40} color="#fff" strokeWidth={2} />
        </div>

        <div>
          <h2 style={{ margin: 0, color: T.ink, fontSize: 24, lineHeight: 1.18, fontWeight: 900, fontFamily: T.fontDisplay }}>
            Verify with Face or Fingerprint
          </h2>
          <p style={{ margin: "12px auto 0", maxWidth: 290, color: T.inkSoft, fontSize: 14, lineHeight: 1.5, fontWeight: 600 }}>
            Complete one final device check before opening your Gloobal dashboard.
          </p>
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 330,
            borderRadius: T.radiusLg,
            background: T.surface,
            border: `1px solid ${T.line}`,
            boxShadow: T.shadowCard,
            padding: 16,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: 12,
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: T.accentSoft,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.accent,
              flexShrink: 0,
            }}
          >
            <Shield size={22} />
          </div>
          <div>
            <strong style={{ display: "block", color: T.ink, fontSize: 14, fontWeight: 900 }}>
              {checking ? "Checking device…" : hasPasskey ? "Passkey found" : "No passkey yet"}
            </strong>
            <small style={{ display: "block", color: T.inkSoft, fontSize: 12, marginTop: 3 }}>{status}</small>
          </div>
        </div>

        {error && <p style={{ margin: 0, color: "#dc2626", fontSize: 13, fontWeight: 700 }}>{error}</p>}

        <SubmitButton
          onClick={hasPasskey ? verifyDevice : setupDevice}
          disabled={checking || busy || !symbolId}
          label={primaryLabel}
        />
      </div>
    </div>
  );
}
