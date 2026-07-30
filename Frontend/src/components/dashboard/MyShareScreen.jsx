import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, PieChart, ShoppingBag, Sprout, User } from "lucide-react";
import { T } from "../../styles/theme";
import { setCashbackRate } from "../../services/api/creatorApi";
import { symbolFor } from "../../constants/finance";

// ---------------------------------------------------------------------------
// "My Share" — the Creator side of cashback sharing.
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
// Replaces the earlier preset grid of whole percents. The grid could only
// express eight rates, so a business wanting 1.57% had to round to something
// it did not mean. Every control here writes the same free-form `rateText`,
// which is the one source of truth: the large display, the slider and the
// custom field are three ways to set one number, never three numbers.
//
// Shown after tapping Receive, before the receive/QR sheet, and editable any
// time by going through Receive again.
// ---------------------------------------------------------------------------

export const MIN_SHARE_PERCENT = 0;
export const MAX_SHARE_PERCENT = 7;

// The worked example is always quoted against a round 1,000 of the person's
// own currency, so the same number reads sensibly whatever ccy is.
const EXAMPLE_AMOUNT = 1000;

export function MyShareScreen({ ccy = symbolFor("USD"), symbolId, initialRate = 0, onSaved, onSkip, onClose, onOpenAssets }) {
  // Held as text, not as a number. A number state cannot represent "1." or a
  // cleared field mid-edit, so typing a decimal would fight the caret.
  const [rateText, setRateText] = useState(() => {
    const percent = (Number(initialRate) || 0) * 100;
    // Trailing zeros off: 2 rather than 2.00, but 1.57 kept intact.
    return String(Number(percent.toFixed(2)));
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // The saved rate comes off a profile read that may not have landed when
  // this screen was opened. Without this, a Creator on 6.25% who taps Receive
  // during a cold start sees "0", and tapping Continue writes that 0 over the
  // rate they actually chose. Only applied while the field is untouched — a
  // late-arriving read must never overwrite what someone is typing.
  const edited = useRef(false);
  useEffect(() => {
    if (edited.current) return;
    const percent = (Number(initialRate) || 0) * 100;
    setRateText(String(Number(percent.toFixed(2))));
  }, [initialRate]);

  const updateRate = (next) => {
    edited.current = true;
    setRateText(next);
  };

  const parsed = Number.parseFloat(rateText);
  const hasValue = rateText.trim() !== "" && Number.isFinite(parsed);
  const isValid = hasValue && parsed >= MIN_SHARE_PERCENT && parsed <= MAX_SHARE_PERCENT;
  // An empty field is not an error to shout about — it is a field mid-edit.
  // Only a value that is present and out of band gets called wrong.
  const isOutOfRange = hasValue && !isValid;

  // What every live figure is computed from. An empty or invalid field reads
  // as 0 for display purposes only; saving is blocked separately.
  const percent = isValid ? parsed : 0;
  const rate = percent / 100;
  const sliderValue = isValid ? parsed : 0;

  const money = (n) => `${ccy}${(Number(n) || 0).toFixed(2)}`;
  const cashbackOnExample = EXAMPLE_AMOUNT * rate;

  const save = async () => {
    if (saving || !isValid) return;
    // toFixed(4) before Number(): 1.57 / 100 is 0.015700000000000002 in
    // floating point, and that is what would land in the request body.
    const nextRate = Number((parsed / 100).toFixed(4));
    setError(null);
    setSaving(true);
    try {
      if (symbolId) await setCashbackRate(symbolId, nextRate);
      setSaving(false);
      onSaved?.(nextRate);
    } catch (err) {
      // The rate is what a payer's cashback is calculated from, so an unsaved
      // one must not be reported as saved. The screen says so and stays put;
      // "Not now" is still there for anyone who would rather carry on to
      // Receive at their current rate.
      setSaving(false);
      setError(err instanceof Error ? err.message : "Couldn't save your rate. Try again.");
    }
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: T.inkFaint,
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: T.fontBody }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
        <button
          onClick={onClose}
          aria-label="Back"
          className="v2-tap"
          style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <ArrowLeft size={18} color={T.ink} />
        </button>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 20, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>My Share</span>
          <span style={{ display: "block", fontSize: 14, color: T.inkSoft, lineHeight: 1.45, marginTop: 4 }}>
            Choose how much you share with users who pay you. You can change it anytime.
          </span>
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "10px 18px 30px", display: "flex", flexDirection: "column", gap: 22 }}>
        {/* The rate itself — the number is the input, not a read-out above a
            field somewhere else. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ ...labelStyle, textAlign: "center" }}>My Contribution</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="number"
              inputMode="decimal"
              min={MIN_SHARE_PERCENT}
              max={MAX_SHARE_PERCENT}
              step={0.01}
              value={rateText}
              onChange={(e) => updateRate(e.target.value)}
              placeholder="0"
              data-testid="my-share-rate-input"
              aria-label="My contribution percentage"
              style={{
                width: 200,
                textAlign: "center",
                border: `2px solid ${isOutOfRange ? T.negative : T.accent}`,
                borderRadius: T.radiusLg,
                background: T.surface,
                boxShadow: T.shadowCard,
                padding: "10px 12px",
                fontSize: 50,
                fontWeight: 800,
                lineHeight: 1.1,
                color: T.accent,
                fontFamily: T.fontDisplay,
                outline: "none",
              }}
            />
            <span style={{ fontSize: 20, fontWeight: 700, color: T.inkSoft }}>%</span>
          </div>
          <div data-testid="my-share-example" style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 600, textAlign: "center", lineHeight: 1.5 }}>
            For every {money(EXAMPLE_AMOUNT)} payment, user gets{" "}
            <span style={{ color: T.accent, fontWeight: 800 }}>{money(cashbackOnExample)}</span>
          </div>
        </div>

        {/* Same number, dragged instead of typed. */}
        <div>
          <input
            type="range"
            min={MIN_SHARE_PERCENT}
            max={MAX_SHARE_PERCENT}
            step={0.01}
            value={sliderValue}
            onChange={(e) => updateRate(e.target.value)}
            data-testid="my-share-slider"
            aria-label="My contribution slider"
            className="my-share-range"
            style={{ width: "100%", display: "block" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 12, color: T.inkFaint, fontWeight: 700 }}>{MIN_SHARE_PERCENT}%</span>
            <span style={{ fontSize: 12, color: T.inkFaint, fontWeight: 700 }}>{MAX_SHARE_PERCENT}%</span>
          </div>
        </div>

        {/* A plain field for anyone who would rather type an exact figure than
            land on it with a thumb. */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Or enter custom %</div>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              inputMode="decimal"
              value={rateText}
              onChange={(e) => updateRate(e.target.value)}
              placeholder="e.g. 1, 1.57, 6.25"
              data-testid="my-share-custom-input"
              aria-label="Custom contribution percentage"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: `1px solid ${isOutOfRange ? T.negative : T.line}`,
                borderRadius: T.radiusMd,
                background: T.surface,
                padding: "13px 34px 13px 14px",
                fontSize: 14,
                fontWeight: 700,
                color: T.ink,
                outline: "none",
                fontFamily: T.fontBody,
              }}
            />
            <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 700, color: T.inkSoft, pointerEvents: "none" }}>
              %
            </span>
          </div>
          {isOutOfRange ? (
            <div data-testid="my-share-range-error" style={{ fontSize: 11.5, fontWeight: 800, color: T.negative, marginTop: 7 }}>
              Must be between {MIN_SHARE_PERCENT}% and {MAX_SHARE_PERCENT}%
            </div>
          ) : (
            <div style={{ fontSize: 11, color: T.inkFaint, fontWeight: 600, marginTop: 7 }}>
              Minimum {MIN_SHARE_PERCENT}%  ·  Maximum {MAX_SHARE_PERCENT}%
            </div>
          )}
        </div>

        {/* What the choice actually does to one payment, in money rather than
            in percent. */}
        <div data-testid="my-share-preview" style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 10 }}>Preview</div>
          {[
            [User, "Payment amount", money(EXAMPLE_AMOUNT), T.ink],
            [ShoppingBag, "User gets", money(cashbackOnExample), T.accent],
            [PieChart, "My contribution", `${isValid ? parsed : 0}%`, T.accent],
          ].map(([Icon, label, value, color], i) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 0",
                borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
              }}
            >
              <Icon size={16} color={T.inkFaint} aria-hidden="true" />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>{label}</span>
              <span style={{ fontSize: 13.5, fontWeight: 800, color }}>{value}</span>
            </div>
          ))}
        </div>

        {error && (
          <div data-testid="my-share-error" style={{ fontSize: 12, fontWeight: 700, color: T.negative, textAlign: "center" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={save}
            disabled={saving || !isValid}
            data-testid="my-share-continue"
            className="v2-tap"
            style={{
              border: "none",
              borderRadius: T.radiusLg,
              padding: "15px 0",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              background: isValid ? T.gradButton : T.gradButtonDisabled,
              boxShadow: isValid ? "0 8px 20px rgba(124,58,237,0.32)" : "none",
              cursor: saving || !isValid ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Continue"}
          </button>

          <button
            onClick={() => onSkip?.()}
            disabled={saving}
            data-testid="my-share-not-now"
            className="v2-tap"
            style={{ alignSelf: "center", border: "none", background: "none", color: T.inkFaint, fontSize: 13, fontWeight: 700, padding: "4px 8px", textDecoration: "underline", cursor: saving ? "default" : "pointer" }}
          >
            Not now
          </button>
        </div>

        <button
          onClick={() => onOpenAssets?.()}
          data-testid="my-share-assets-link"
          className="v2-tap"
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", border: "none", borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "14px 16px", cursor: "pointer" }}
        >
          <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sprout size={16} color={T.accent} />
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.inkSoft, fontWeight: 600, lineHeight: 1.5 }}>
            This becomes the user&apos;s asset and PayLater limit.
          </span>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.accent, flexShrink: 0 }}>{"›"}</span>
        </button>
      </div>

      <style>{`
        .my-share-range {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(
            to right,
            ${T.accent} 0%,
            ${T.accent} ${(sliderValue / MAX_SHARE_PERCENT) * 100}%,
            ${T.line} ${(sliderValue / MAX_SHARE_PERCENT) * 100}%,
            ${T.line} 100%
          );
          outline: none;
        }
        .my-share-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid ${T.accent};
          box-shadow: ${T.shadowCard};
          cursor: pointer;
        }
        .my-share-range::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid ${T.accent};
          box-shadow: ${T.shadowCard};
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
