import React, { useState, useEffect, useRef } from "react";
import { FlagEmoji } from "../../components/icons/MiscIcons";
import { QrMatrix } from "../../components/qr/QrMatrix";
import { QR_TTL_SECONDS } from "../../lib/qr";
import { useSessionToken } from "../../api/session";
import { T } from "../../styles/theme";
import { ArrowLeft, Shield, RefreshCw } from "lucide-react";
import type { DialCountry } from "../../types";

interface ReceiveScreenProps {
  onClose: () => void;
  dialCountry: DialCountry;
  secureId: string;
  globalIdTag: string;
}

export function ReceiveScreen({ onClose, dialCountry, secureId, globalIdTag }: ReceiveScreenProps) {
  // `globalIdTag` is the person's one permanent Global ID — it comes in as
  // a prop and is never regenerated here. Only the session token below
  // rotates; every rotation still points at this same value.
  //
  // TanStack Query now owns fetching + refetch-on-interval + refetch-on-
  // focus/reconnect (see src/api/session.ts) — this component only owns
  // the fade transition and the countdown ring, which are pure UI concerns.
  // `isError`/`refetch` matter for real now (not just the mock): once a
  // real backend is configured (see api/session.ts), minting a token is a
  // genuine network call that can genuinely fail.
  const { data: session, isError, refetch, isFetching } = useSessionToken(globalIdTag, Boolean(globalIdTag));
  const [displayedToken, setDisplayedToken] = useState<string | null>(null);
  const [fadeState, setFadeState] = useState<"in" | "out">("in");
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL_SECONDS);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Runs the same fade-out -> swap -> fade-in sequence as before, but now
  // triggered by a new query result landing instead of a manual refresh().
  useEffect(() => {
    if (!session || session.token === lastTokenRef.current) return;
    lastTokenRef.current = session.token;
    if (displayedToken === null) {
      // First token ever shown — no need to fade from nothing.
      setDisplayedToken(session.token);
      return;
    }
    setFadeState("out");
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      setDisplayedToken(session.token);
      setFadeState("in");
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;
    tickRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }, 250);
    return () => {
      if (tickRef.current !== null) clearInterval(tickRef.current);
    };
  }, [session]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const ringPct = secondsLeft / QR_TTL_SECONDS;

  // Bumped from 252 -> 300 and the inner mask changed from a circle to a
  // rounded square (below): a real QR must render as an unclipped square
  // with its finder patterns intact, and needs enough on-screen size for
  // a phone camera to resolve individual modules reliably. `qrPanelSide`
  // is sized to sit fully inside the ring with clearance to spare.
  const ringSize = 300;
  const strokeW = 4;
  const r = (ringSize - strokeW) / 2;
  const circumference = 2 * Math.PI * r;
  const qrPanelSide = 190;

  // The Secure ID doubles as this person's "Symbolic ID" strip — a short
  // preview of the same symbol set used during onboarding, not the full
  // credential, so it's safe to show at a glance here.
  const symbolicPreview = (secureId && secureId.length ? secureId : "＋－×＋－×").slice(0, 6);


  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: T.fontBody,
        animation: "receiveFadeIn 0.35s ease-out both",
      }}
    >
      <style>{`
        @keyframes receiveFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes qrPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.16); } 50% { box-shadow: 0 0 0 14px rgba(124,58,237,0); } }
        .receive-qr-pulse { animation: qrPulse 2.6s ease-out infinite; }
        .receive-qr-fade-in { animation: rqFadeIn 0.28s ease-out both; }
        .receive-qr-fade-out { animation: rqFadeOut 0.2s ease-in both; }
        @keyframes rqFadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes rqFadeOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.97); } }
        @media (prefers-reduced-motion: reduce) {
          .receive-qr-pulse, .receive-qr-fade-in, .receive-qr-fade-out { animation: none !important; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "calc(16px + env(safe-area-inset-top, 0px)) 18px 10px",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Back"
          className="v2-tap"
          style={{
            width: 38,
            height: 38,
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
          <ArrowLeft size={18} color={T.ink} />
        </button>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>
          Receive
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "6px 22px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 22, textAlign: "center" }}>
          Share your Gloobal ID securely
        </div>

        {/* Identity card */}
        <div
          style={{
            width: "100%",
            maxWidth: 340,
            background: T.surface,
            border: `1px solid ${T.line}`,
            borderRadius: T.radiusXl,
            boxShadow: T.shadowCard,
            padding: "26px 22px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* No profile photo is stored yet, so this shows the person's own
              flag inside a soft circular frame rather than inventing a face. */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: T.accentSoft,
              border: `2px solid ${T.surface}`,
              boxShadow: T.shadowCard,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <FlagEmoji flag={dialCountry.flag} size={64} radius={32} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>
              {dialCountry.name} Gloobal ID
            </div>
            <Shield size={14} color={T.accent} fill={T.accentSoft} />
          </div>

          <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 2 }}>
            Global ID:{" "}
            <span style={{ color: T.ink, fontWeight: 700, fontFamily: T.fontDisplay }}>{globalIdTag}</span>
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
            Symbolic ID:
            <span style={{ color: T.accent, fontWeight: 800, letterSpacing: 1, fontFamily: T.fontDisplay }}>
              {symbolicPreview.split("").join(" ")}
            </span>
          </div>

          <div style={{ width: "100%", height: 1, background: T.line, marginBottom: 22 }} />

          {/* QR + countdown ring */}
          <div
            className="receive-qr-pulse"
            style={{
              position: "relative",
              width: ringSize,
              height: ringSize,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <svg
              width={ringSize}
              height={ringSize}
              style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
            >
              <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke={T.line} strokeWidth={strokeW} />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={r}
                fill="none"
                stroke={T.accent}
                strokeWidth={strokeW}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - ringPct)}
                style={{ transition: "stroke-dashoffset 0.25s linear" }}
              />
            </svg>
            <div
              className={fadeState === "in" ? "receive-qr-fade-in" : "receive-qr-fade-out"}
              style={{
                width: qrPanelSide,
                height: qrPanelSide,
                borderRadius: 26,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 12,
              }}
            >
              {displayedToken ? (
                <QrMatrix token={displayedToken} size={qrPanelSide - 24} />
              ) : isError ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: T.inkSoft, textAlign: "center" }}>Couldn't generate your code</div>
                  <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="v2-tap"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      border: "none",
                      borderRadius: 999,
                      padding: "8px 16px",
                      background: T.gradButton,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: isFetching ? "default" : "pointer",
                      opacity: isFetching ? 0.6 : 1,
                    }}
                  >
                    <RefreshCw size={13} />
                    {isFetching ? "Retrying…" : "Retry"}
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: T.inkFaint }}>Generating…</div>
              )}
            </div>
          </div>

          <div style={{ fontSize: 12, color: T.inkFaint, marginBottom: 2 }}>Valid for</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: T.ink,
              fontFamily: T.fontDisplay,
              letterSpacing: 1,
              marginBottom: 8,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {mm}:{ss}
          </div>
          <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center" }}>
            QR refreshes automatically every 2 minutes
          </div>
        </div>

        {/* Security notice */}
        <div
          style={{
            width: "100%",
            maxWidth: 340,
            marginTop: 18,
            padding: "12px 16px",
            background: T.surfaceAlt,
            borderRadius: T.radiusMd,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <Shield size={15} color={T.accent} style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>
            Only the profile information you've chosen to share will be available after this QR is securely verified.
          </div>
        </div>
      </div>
    </div>
  );
}
