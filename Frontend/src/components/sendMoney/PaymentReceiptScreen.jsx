import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, Share2 } from "lucide-react";
import { T } from "../../styles/theme";
import { symbolFor } from "../../constants/finance";

// A payment used to end in a toast: three seconds of text, then nothing to
// go back to. This is the record of it — who it went to, what it cost, what
// it earned, and the reference to quote if it ever needs chasing.

const RECEIPT_STYLE_ID = "gloobal-receipt-keyframes";
const RECEIPT_STYLE = `
  @keyframes gloobalReceiptTick {
    0% { transform: scale(0.4); opacity: 0; }
    60% { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .gloobal-receipt-tick { animation: gloobalReceiptTick 0.42s cubic-bezier(0.2, 0.8, 0.3, 1) both; }
  @media (prefers-reduced-motion: reduce) {
    .gloobal-receipt-tick { animation: none; }
  }
`;

// Date and time are two rows on the receipt, not one line, so each reads
// as its own fact — and the time carries seconds, which is what makes a
// receipt quotable when two payments went out in the same minute.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "30 Jul 2026" — built from parts, not toLocaleDateString, which reorders
 *  to "Jul 30, 2026" under an en-US locale. Every other dated surface in the
 *  app (joined date, ID history) reads day-first; a receipt that alone reads
 *  month-first looks like it came from somewhere else. */
function formatDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "14:58:07" */
function formatTime(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** The tail of the transaction id — long enough to be unique in a support
 *  conversation, short enough to read out loud. */
function shortId(receipt) {
  const raw = String(
    receipt?.transactionId || receipt?.transaction?._id || receipt?.transaction?.id || receipt?.referenceId || ""
  );
  if (!raw) return "";
  return `#${raw.slice(-8).toUpperCase()}`;
}

function Row({ label, value, color, testId }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "11px 0" }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, flexShrink: 0 }}>{label}</span>
      <span
        data-testid={testId}
        style={{
          fontSize: 13, fontWeight: 800, color: color || T.ink, textAlign: "right",
          fontFamily: T.fontDisplay, wordBreak: "break-word", minWidth: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function PaymentReceiptScreen({ receipt, ccy, onDone, onViewAssets }) {
  const [shareNote, setShareNote] = useState(null);

  useEffect(() => {
    if (document.getElementById(RECEIPT_STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = RECEIPT_STYLE_ID;
    el.textContent = RECEIPT_STYLE;
    document.head.appendChild(el);
  }, []);

  if (!receipt) return null;

  const symbol = ccy || symbolFor(receipt.currency || "USD");
  const money = (n) => `${symbol}${(Number(n) || 0).toFixed(2)}`;

  const amount = Number(receipt.amount) || 0;
  const cashback = Number(receipt.cashback) || 0;
  const cashbackRate = Number(receipt.cashbackRate) || 0;
  const amountPaid = Number(receipt.amountPaid ?? receipt.amount) || 0;
  const recipient =
    receipt.recipient ||
    receipt.transaction?.to?.symbolId ||
    receipt.transaction?.to?.fullName ||
    "Gloobal user";
  const when = receipt.timestamp || receipt.transaction?.createdAt;
  const dateText = formatDate(when);
  const timeText = formatTime(when);
  const txnId = shortId(receipt);
  // Money that left a PayLater line is not the same event as money that
  // left the balance, and the receipt is the one place that distinction
  // has to survive.
  const paidWithPayLater =
    (receipt.payMethod || receipt.metadata?.payMethod || receipt.transaction?.metadata?.payMethod) === "paylater";

  const summary =
    `Paid ${money(amount)} to ${recipient} on ${dateText} at ${timeText}.` +
    (txnId ? ` Transaction ${txnId}` : "");

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Gloobal payment receipt", text: summary });
        return;
      }
      await navigator.clipboard.writeText(summary);
      setShareNote("Receipt copied");
    } catch {
      // Cancelled, or neither route is available — say what happened rather
      // than leaving the button looking broken.
      setShareNote("Could not share receipt");
    }
  };

  return (
    <div
      data-testid="payment-receipt"
      style={{
        position: "fixed", inset: 0, zIndex: 320, background: T.bg,
        display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: T.fontBody,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 6px", flexShrink: 0 }}>
        {/* Back goes to the dashboard, not to the form that produced this —
            the payment is done, and there is nothing to go back and edit. */}
        <button
          onClick={onDone}
          aria-label="Back to dashboard"
          className="v2-tap"
          style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <ArrowLeft size={18} color={T.ink} />
        </button>
        <span style={{ fontSize: 20, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Payment Receipt</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "10px 18px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <span
          data-testid="receipt-tick"
          className="gloobal-receipt-tick"
          style={{
            width: 64, height: 64, borderRadius: "50%", background: T.positive,
            display: "flex", alignItems: "center", justifyContent: "center", marginTop: 6,
          }}
        >
          <Check size={32} color="#fff" strokeWidth={3} />
        </span>

        {/* The outcome and the number, before any of the detail. Someone
            checking a payment went through is answering two questions and
            should not have to read a table to answer either. */}
        <span data-testid="receipt-headline" style={{ fontSize: 18, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>
          Payment Successful
        </span>
        <span
          data-testid="receipt-hero-amount"
          style={{ fontSize: 32, fontWeight: 800, color: T.accent, fontFamily: T.fontDisplay, marginTop: -8 }}
        >
          {money(amount)}
        </span>

        <div style={{ width: "100%", maxWidth: 380, borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: 20 }}>
          <Row label="To" value={recipient} testId="receipt-to" />
          <div style={{ height: 1, background: T.line }} />
          <Row label="Amount" value={money(amount)} testId="receipt-amount" />
          {cashback > 0 && (
            <>
              <div style={{ height: 1, background: T.line }} />
              <Row
                label="Cashback earned"
                value={`${money(cashback)} (${Number((cashbackRate * 100).toFixed(2))}%)`}
                color={T.positive}
                testId="receipt-cashback"
              />
            </>
          )}
          <div style={{ height: 1, background: T.line }} />
          <Row label="Via" value="Gloobal Bank" testId="receipt-via" />
          {paidWithPayLater && (
            <>
              <div style={{ height: 1, background: T.line }} />
              <Row label="Paid via" value="PayLater" color={T.accent} testId="receipt-pay-method" />
            </>
          )}
          <div style={{ height: 1, background: T.line }} />
          <Row label="Date" value={dateText} testId="receipt-date" />
          <div style={{ height: 1, background: T.line }} />
          <Row label="Time" value={timeText} testId="receipt-time" />
          {txnId && (
            <>
              <div style={{ height: 1, background: T.line }} />
              <Row label="Transaction ID" value={txnId} testId="receipt-txn-id" />
            </>
          )}
          <div style={{ height: 1, background: T.line }} />
          <Row label="Status" value="✓ Completed" color={T.positive} testId="receipt-status" />
        </div>

        {/* Only when something was actually planted — on a plain person-to-
            person send there is no seed, and claiming one would be a lie. */}
        {cashback > 0 && (
          <div
            data-testid="receipt-asset-note"
            style={{
              width: "100%", maxWidth: 380, borderRadius: T.radiusSm, background: "rgba(15,163,114,0.08)",
              padding: 12, lineHeight: 1.5, display: "flex", gap: 9, alignItems: "flex-start",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1.3 }}>🌱</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.positive }}>
                {money(cashback)} planted as an asset · growing toward {money(amountPaid)}
              </span>
              {/* The seed is only meaningful if it can be found again. */}
              {onViewAssets && (
                <button
                  type="button"
                  onClick={onViewAssets}
                  data-testid="receipt-view-assets"
                  className="v2-tap"
                  style={{
                    border: "none", background: "none", padding: "4px 0 0", cursor: "pointer",
                    fontSize: 11.5, fontWeight: 800, color: T.accent, fontFamily: T.fontBody,
                  }}
                >
                  View in My Assets →
                </button>
              )}
            </span>
          </div>
        )}

        <div style={{ width: "100%", maxWidth: 380, marginTop: 4 }}>
          <button
            onClick={onDone}
            data-testid="receipt-done"
            className="v2-tap"
            style={{
              width: "100%", padding: "14px 18px", borderRadius: T.radiusMd, border: "none",
              background: T.gradButton, color: "#fff", fontSize: 14, fontWeight: 800,
              fontFamily: T.fontDisplay, cursor: "pointer",
            }}
          >
            Done
          </button>
          <button
            onClick={handleShare}
            data-testid="receipt-share"
            style={{
              width: "100%", marginTop: 10, border: "none", background: "none", color: T.accent,
              fontSize: 12.5, fontWeight: 800, padding: "8px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}
          >
            <Share2 size={15} color={T.accent} />
            Share Receipt
          </button>
          {shareNote && (
            <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: T.inkFaint, marginTop: 2 }}>
              {shareNote}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentReceiptScreen;
