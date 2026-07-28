import React, { useState } from "react";
import { ArrowLeft, Sprout } from "lucide-react";
import { T } from "../../styles/theme";
import { setCashbackRate } from "../../services/api/creatorApi";

// ---------------------------------------------------------------------------
// "Share with Gloobal users" — the Creator side of cashback sharing.
//
// A Gloobal Creator (a business or merchant) picks for themselves what share
// of every payment they hand back to whoever paid them. Gloobal does not set
// this rate; each Creator chooses their own, anywhere from 0% to 7%.
//
// Whatever they pick is what gets applied when a user pays them: that
// percentage is planted as an asset seed for the payer, which is also that
// payer's PayLater limit. A Creator who shares nothing (0%) simply plants no
// seed — which is exactly what a plain person-to-person send does too.
//
// Shown after tapping Receive, before the receive/QR sheet, and editable any
// time by going through Receive again.
// ---------------------------------------------------------------------------

// The picker steps: whole percents 0 through 7. Stored as decimals
// (1% = 0.01) so the rate can be multiplied against an amount directly.
export const CASHBACK_STEPS = [0, 1, 2, 3, 4, 5, 6, 7];

// The worked example is always quoted against a round 1,000 of the person's
// own currency, so the same number reads sensibly whatever ccy is.
const EXAMPLE_AMOUNT = 1000;

export function CreatorCashbackScreen({ ccy = "₹", symbolId, initialRate = 0, onSaved, onSkip, onClose, onOpenAssets }) {
  const [percent, setPercent] = useState(() => {
    const p = Math.round((Number(initialRate) || 0) * 100);
    return CASHBACK_STEPS.includes(p) ? p : 0;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const savedPercent = Math.round((Number(initialRate) || 0) * 100);

  const rate = percent / 100;
  const money = (n) => `${ccy}${(Number(n) || 0).toFixed(2)}`;

  const save = async (nextPercent) => {
    if (saving) return;
    const nextRate = nextPercent / 100;
    setError(null);
    setSaving(true);
    try {
      if (symbolId) await setCashbackRate(symbolId, nextRate);
      setSaving(false);
      onSaved?.(nextRate);
    } catch (err) {
      // The rate is what a payer's cashback is calculated from, so an
      // unsaved one must not be reported as saved. The screen says so and
      // stays put; Skip for now is still there for anyone who would rather
      // carry on to Receive at their current rate.
      setSaving(false);
      setError(err instanceof Error ? err.message : "Couldn't save your rate. Try again.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: T.fontBody }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
        <button
          onClick={onClose}
          aria-label="Back"
          className="v2-tap"
          style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <ArrowLeft size={18} color={T.ink} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Share with Gloobal users</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 18px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ margin: "0 2px", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5 }}>
          Choose the % you share with users who pay you (0–7%). You set this yourself, and you can
          change it any time.
        </p>

        {savedPercent > 0 && (
          <div style={{ alignSelf: "flex-start", borderRadius: 999, background: T.accentSoft, color: T.accent, padding: "7px 14px", fontSize: 11.5, fontWeight: 800 }}>
            Keep current: {savedPercent}% · pick another below to change
          </div>
        )}

        {/* Selected value, front and centre */}
        <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "22px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: T.inkFaint }}>
            Your cashback contribution
          </div>
          <div data-testid="creator-rate-value" style={{ fontSize: 46, fontWeight: 800, color: T.accent, fontFamily: T.fontDisplay, lineHeight: 1.1, marginTop: 6 }}>
            {percent}%
          </div>
          <div data-testid="creator-rate-example" style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 600, marginTop: 8, lineHeight: 1.5 }}>
            A user paying {money(EXAMPLE_AMOUNT)} gets back {money(EXAMPLE_AMOUNT * rate)} as an asset
          </div>
        </div>

        {/* Picker — same rounded, tokenised control style as the rest of the app */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: T.inkSoft, margin: "2px 2px 8px" }}>
            Pick your rate
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {CASHBACK_STEPS.map((step) => {
              const active = step === percent;
              return (
                <button
                  key={step}
                  onClick={() => setPercent(step)}
                  data-testid={`creator-rate-${step}`}
                  aria-pressed={active}
                  className="v2-tap"
                  style={{
                    border: active ? "none" : `1px solid ${T.line}`,
                    borderRadius: T.radiusMd,
                    padding: "14px 0",
                    fontSize: 14,
                    fontWeight: 800,
                    color: active ? "#fff" : T.inkSoft,
                    background: active ? T.gradButton : T.surface,
                    boxShadow: active ? "0 6px 16px rgba(124,58,237,0.28)" : T.shadowCard,
                    cursor: "pointer",
                  }}
                >
                  {step}%
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div data-testid="creator-rate-error" style={{ fontSize: 12, fontWeight: 700, color: T.negative, textAlign: "center" }}>
            {error}
          </div>
        )}

        <button
          onClick={() => save(percent)}
          disabled={saving}
          data-testid="creator-save"
          className="v2-tap"
          style={{ border: "none", borderRadius: T.radiusMd, padding: "15px 0", color: "#fff", fontSize: 14, fontWeight: 800, background: T.gradButton, boxShadow: "0 8px 20px rgba(124,58,237,0.32)", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Save & Continue"}
        </button>

        <button
          onClick={() => onSkip?.()}
          disabled={saving}
          className="v2-tap"
          style={{ border: "none", background: "none", color: T.inkFaint, fontSize: 12.5, fontWeight: 700, padding: "4px 8px", textDecoration: "underline", cursor: saving ? "default" : "pointer" }}
        >
          Skip for now
        </button>

        <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sprout size={16} color={T.accent} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12, color: T.inkSoft, fontWeight: 600, lineHeight: 1.5 }}>
              This becomes the user&apos;s PayLater limit and asset value.
            </span>
            <button
              onClick={() => onOpenAssets?.()}
              className="v2-tap"
              style={{ border: "none", background: "none", padding: "6px 0 0", color: T.accent, fontSize: 12, fontWeight: 800, cursor: "pointer" }}
            >
              Learn more about Assets {"→"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
