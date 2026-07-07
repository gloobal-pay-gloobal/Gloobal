import React, { useState, useEffect, useRef, useMemo } from "react";
import { Flag } from "../../components/common/Flag";
import { CURRENCIES, convert, fmt, type CurrencyCode } from "../../lib/currency";
import { resolveUser, sendTransaction, type BackendUser } from "../../services/api/authApi";
import { ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronUp, Clock, Copy, CreditCard, Delete, Lock, Phone, Search, Send as SendMoneyLucideIcon, User, X, Zap } from "lucide-react";
import type { SenderProfile } from "../../types";

// Maps a country's ISO-2 code to one of the currencies this screen supports.
// Falls back to USD for any country outside that demo currency set — the
// person can always change it from the currency dropdown.
export const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  ES: "EUR", FR: "EUR", DE: "EUR", IT: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR",
  GB: "GBP",
  IN: "INR",
  JP: "JPY",
  US: "USD",
};

/** Shape of each "party" (sender/recipient) card on this screen. */
export interface SendMoneyParty {
  country: string;
  flag: string;
  phone: string;
  id: string;
  currency: CurrencyCode;
}

// Builds the "sending from" side of the screen out of the country the
// person actually verified with during onboarding, instead of a fixed
// placeholder — so the flag/currency here always matches their Global ID.
export function buildSenderProfile(sender?: SenderProfile | null): SendMoneyParty {
  const s = sender || { name: "United States", iso: "US", dialCode: "+1", flag: "🇺🇸", phoneNumber: "" };
  const digits = (s.phoneNumber || "").trim();
  return {
    country: s.name,
    flag: s.flag,
    phone: digits ? `${s.dialCode} ${digits}` : `${s.dialCode} •••• •• ••`,
    id: `${s.iso}${s.dialCode.replace("+", "")}••••••`,
    currency: COUNTRY_CURRENCY[s.iso] || "USD",
  };
}

export const INITIAL_BOTTOM: SendMoneyParty = {
  country: "India",
  flag: "🇮🇳",
  phone: "+91 98765 43210",
  id: "IN0987654321",
  currency: "INR",
};

interface SendMoneyScreenProps {
  onClose: () => void;
  sender?: SenderProfile | null;
}

export function SendMoneyScreen({ onClose, sender }: SendMoneyScreenProps) {
  const [top, setTop] = useState<SendMoneyParty>(() => buildSenderProfile(sender));
  const [bottom, setBottom] = useState<SendMoneyParty>({ ...INITIAL_BOTTOM, country: "Search receiver", phone: "Enter ID or mobile", id: "" });
  const [amount, setAmount] = useState("250.00");
  const [topOpen, setTopOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [dropdown, setDropdown] = useState<"top" | "bottom" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pinErrorMessage, setPinErrorMessage] = useState<string | null>(null);
  const [receiverQuery, setReceiverQuery] = useState("");
  const [receiver, setReceiver] = useState<BackendUser | null>(null);
  const [receiverLoading, setReceiverLoading] = useState(false);
  const [receiverError, setReceiverError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const senderSymbolId = sender?.symbolId || "";

  const convertedAmount = useMemo(
    () => convert(amount, top.currency, bottom.currency),
    [amount, top.currency, bottom.currency]
  );

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
      if (pinErrorTimer.current !== null) clearTimeout(pinErrorTimer.current);
    };
  }, []);

  // Real GET /api/users/resolve?identifier=... — replaces the fixed
  // INITIAL_BOTTOM placeholder recipient with an actual account lookup by
  // mobile number or Gloobal ID.
  async function handleResolveReceiver() {
    const identifier = receiverQuery.trim();
    if (!identifier) {
      setReceiverError("Enter receiver mobile number or Gloobal ID.");
      return;
    }
    if (identifier === senderSymbolId) {
      setReceiverError("Self-transfer is not allowed.");
      return;
    }
    setReceiverLoading(true);
    setReceiverError(null);
    try {
      const user = await resolveUser(identifier);
      setReceiver(user);
      setBottom((b) => ({
        ...b,
        country: user.fullName || "Gloobal User",
        phone: user.mobileNumber || user.symbolId,
        id: user.symbolId,
      }));
    } catch (err) {
      setReceiver(null);
      setReceiverError(err instanceof Error ? err.message : "No user found.");
    } finally {
      setReceiverLoading(false);
    }
  }

  // Real POST /api/transactions/send — PIN-verified server-side; there is
  // no separate client-side PIN check to bypass, unlike the old
  // hardcoded-PIN version of this screen.
  useEffect(() => {
    if (pin.length < 4) return;
    if (!receiver || !senderSymbolId) return;
    let cancelled = false;
    setSending(true);
    (async () => {
      try {
        const amountNumber = parseFloat(amount) || 0;
        const idempotencyKey = `gloobal-${senderSymbolId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await sendTransaction({
          senderSymbolId,
          receiverSymbolId: receiver.symbolId,
          amount: amountNumber,
          pin,
          idempotencyKey,
        });
        if (cancelled) return;
        pinErrorTimer.current = setTimeout(() => {
          setPinOpen(false);
          setPin("");
          setSending(false);
          showToast(
            `Sending ${CURRENCIES[top.currency].label} ${fmt(amountNumber)} to ${bottom.country} · ${bottom.phone}`
          );
        }, 280);
      } catch (err) {
        if (cancelled) return;
        setSending(false);
        setPinError(true);
        setPinErrorMessage(err instanceof Error ? err.message : "Payment failed.");
        pinErrorTimer.current = setTimeout(() => {
          setPin("");
          setPinError(false);
        }, 550);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function handleCopy(text: string, key: string) {
    const doSet = () => {
      setCopiedKey(key);
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedKey(null), 1400);
    };
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(doSet).catch(doSet);
      } else {
        doSet();
      }
    } catch {
      doSet();
    }
  }

  function handleSwap() {
    // Only the currencies swap sides — and with them, the exchange rate
    // and converted amount that are derived from currency. The sender is
    // always the logged-in user, so their country, flag, phone, and
    // Global ID (the "top" side) must never change.
    setTop((t) => ({ ...t, currency: bottom.currency }));
    setBottom((b) => ({ ...b, currency: top.currency }));
    setDropdown(null);
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) {
      setAmount(v);
    }
  }

  function selectCurrency(slot: "top" | "bottom", code: CurrencyCode) {
    if (slot === "top") {
      setTop((t) => ({ ...t, currency: code }));
    } else {
      setBottom((b) => ({ ...b, currency: code }));
    }
    setDropdown(null);
  }

  function handleSend() {
    if (!receiver) {
      setReceiverError("Search and select a receiver first.");
      return;
    }
    const amountNumber = parseFloat(amount);
    if (!amountNumber || amountNumber <= 0) {
      showToast("Enter a valid amount.");
      return;
    }
    setPin("");
    setPinError(false);
    setPinErrorMessage(null);
    setPinOpen(true);
  }

  function handlePinDigit(d: string) {
    if (pinError || pin.length >= 4) return;
    setPin((p) => p + d);
  }

  function handlePinBackspace() {
    if (pinError) return;
    setPin((p) => p.slice(0, -1));
  }

  function closePin() {
    if (pinErrorTimer.current !== null) clearTimeout(pinErrorTimer.current);
    setPinOpen(false);
    setPin("");
    setPinError(false);
  }

  return (
    <div className="app-shell">
      <style>{`
        * { box-sizing: border-box; }
        .app-shell {
          max-width: 430px;
          margin: 0 auto;
          background: radial-gradient(120% 60% at 50% -10%, #F8F7FC 0%, #F1F0F7 55%, #ECEAF4 100%);
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          padding: 24px 18px 40px;
          position: relative;
          -webkit-font-smoothing: antialiased;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
        }
        .icon-btn {
          width: 44px;
          height: 44px;
          border-radius: 15px;
          background: #f4f2fb;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4633C7;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 0 1px 2px rgba(20,18,43,0.04);
        }
        .icon-btn:hover { background: #ece6fb; }
        .icon-btn:active { transform: scale(0.92); background: #e0d8f7; }
        .icon-btn.circle {
          border-radius: 50%;
          background: #fff;
          border: 1.6px solid #7c3aed;
          color: #7c3aed;
          width: 40px;
          height: 40px;
          box-shadow: 0 2px 8px rgba(124,58,237,0.14);
        }
        .icon-btn:focus-visible, .collapse-btn:focus-visible, .copy-btn:focus-visible,
        .currency-select:focus-visible, .swap-btn:focus-visible, .send-btn:focus-visible {
          outline: 2px solid #7c3aed; outline-offset: 2px;
        }
        .title { font-size: 21px; font-weight: 700; color: #14122B; letter-spacing: -0.01em; }

        .search-bar {
          display: flex;
          align-items: center;
          background: #fff;
          border-radius: 999px;
          padding: 13px 16px;
          gap: 12px;
          margin-bottom: 18px;
          border: 1px solid #ECECF3;
          box-shadow: 0 2px 10px rgba(20,18,43,0.04);
          transition: box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .search-bar:focus-within { border-color: #d8d2ee; box-shadow: 0 2px 14px rgba(124,58,237,0.12); }
        .search-bar input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 15px;
          color: #14122B;
          background: transparent;
          min-width: 0;
        }
        .search-bar input::placeholder { color: #ADABC2; }
        .search-bar svg:first-child { color: #ADABC2; flex-shrink: 0; }
        .search-avatar { color: #7c3aed; display: flex; flex-shrink: 0; }

        .flag-chip-wrap { position: relative; display: inline-flex; flex-shrink: 0; }
        .flag-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 12px;
          background: #fff;
          box-shadow: inset 0 0 0 1px rgba(20,18,43,0.08), 0 1px 3px rgba(20,18,43,0.08);
          overflow: hidden;
        }
        .flag-chip.lg { width: 52px; height: 40px; font-size: 22px; border-radius: 13px; }
        .flag-chip.md { width: 30px; height: 23px; font-size: 13px; border-radius: 7px; }
        .flag-chip.sm { width: 24px; height: 18px; font-size: 11px; border-radius: 6px; }
        .flag-badge {
          position: absolute; bottom: -5px; right: -6px;
          width: 20px; height: 20px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #fff; border: 2px solid #fff;
          box-shadow: 0 2px 6px rgba(20,18,43,0.18);
        }
        .flag-badge.send { background: #7c3aed; }
        .flag-badge.receive { background: #16A34A; }

        .card {
          background: #fff;
          border-radius: 28px;
          padding: 20px;
          box-shadow: 0 1px 2px rgba(20,18,43,0.03), 0 10px 30px -12px rgba(20,18,43,0.10);
          border: 1px solid rgba(20,18,43,0.03);
          position: relative;
        }
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .collapse-btn {
          background: #F7F6FB;
          border: none;
          color: #7c3aed;
          cursor: pointer;
          display: flex;
          padding: 7px;
          border-radius: 10px;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .collapse-btn:hover { background: #f4f2fb; }
        .collapse-btn:active { transform: scale(0.85); }

        .contact-block { overflow: hidden; transition: max-height 0.25s ease; }
        .contact-row { display: flex; align-items: center; gap: 12px; padding: 9px 2px; }
        .contact-icon {
          width: 36px; height: 36px; border-radius: 11px;
          background: #f4f2fb; color: #7c3aed;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          box-shadow: inset 0 0 0 1px rgba(124,58,237,0.06);
        }
        .contact-icon.green { background: #E1F5E7; color: #16A34A; box-shadow: inset 0 0 0 1px rgba(22,163,74,0.08); }
        .contact-text {
          flex: 1; font-size: 15px; font-weight: 600; color: #14122B;
          letter-spacing: 0.01em; font-variant-numeric: tabular-nums;
        }
        .copy-btn {
          background: transparent; border: none; color: #C2C0D4; cursor: pointer;
          display: flex; padding: 7px; border-radius: 9px;
          transition: color 0.15s ease, transform 0.15s ease, background 0.15s ease;
        }
        .copy-btn:hover { background: #F7F6FB; color: #8B899E; }
        .copy-btn:active { transform: scale(0.85); }
        .copy-btn.copied { color: #16A34A; }
        .copy-btn.copied:hover { background: #E9FBF0; color: #16A34A; }

        .divider { height: 1px; background: #EFEFF5; margin: 6px 0 14px; }

        .rate-row {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px; padding: 0 2px;
        }
        .rate-left {
          display: flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 600;
          color: #14122B; font-variant-numeric: tabular-nums;
        }
        .live-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #22C55E; flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.15);
          animation: live-pulse 2s ease-in-out infinite;
        }
        @keyframes live-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.15); }
          50% { box-shadow: 0 0 0 5px rgba(34,197,94,0.22); }
        }
        .live-text { display: flex; align-items: center; gap: 4px; color: #16A34A; font-size: 14px; font-weight: 700; }
        .live-pill {
          display: flex; align-items: center; gap: 4px; background: #DCFCE7; color: #16A34A;
          font-size: 12.5px; font-weight: 700; padding: 5px 11px; border-radius: 999px; flex-shrink: 0;
        }

        .amount-box { border-radius: 20px; padding: 16px 18px; transition: box-shadow 0.15s ease; }
        .amount-box.indigo { background: linear-gradient(155deg, #EFEDFC, #E7E4FB); box-shadow: inset 0 0 0 1px rgba(124,58,237,0.06); }
        .amount-box.indigo:has(.amount-input:focus) { box-shadow: inset 0 0 0 1.5px rgba(124,58,237,0.35); }
        .amount-box.green { background: linear-gradient(155deg, #EEF9F1, #E5F6EA); box-shadow: inset 0 0 0 1px rgba(22,163,74,0.06); }

        .amount-input {
          border: none; background: transparent; font-size: 27px; font-weight: 800;
          color: #14122B; width: 100%; outline: none; padding: 0; font-family: inherit;
          letter-spacing: -0.01em; font-variant-numeric: tabular-nums;
        }
        .amount-input::placeholder { color: #B9B6D6; }

        .amount-top-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .amount-display {
          font-size: 24px; font-weight: 800; color: #16A34A;
          letter-spacing: -0.01em; font-variant-numeric: tabular-nums;
        }

        .currency-select {
          display: flex; align-items: center; justify-content: center; margin-top: 8px;
          width: 30px; height: 30px;
          background: rgba(255,255,255,0.65); border: none; cursor: pointer;
          color: #14122B; padding: 0;
          border-radius: 50%; transition: background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
          box-shadow: 0 1px 2px rgba(20,18,43,0.05);
        }
        .currency-select:hover { background: rgba(255,255,255,0.95); box-shadow: 0 2px 6px rgba(20,18,43,0.1); }
        .currency-select:active { transform: scale(0.9); }

        .bottom-meta-row { display: flex; align-items: center; justify-content: flex-start; margin-top: 12px; }

        .dropdown-overlay { position: fixed; inset: 0; z-index: 40; }
        .dropdown-menu {
          position: absolute; z-index: 50; top: calc(100% + 8px); left: 0;
          background: #fff; border-radius: 18px; box-shadow: 0 16px 40px -8px rgba(20,18,43,0.22);
          padding: 7px; min-width: 148px; border: 1px solid rgba(20,18,43,0.05);
        }
        .dropdown-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 10px;
          border-radius: 11px; cursor: pointer; font-size: 14.5px; font-weight: 600; color: #14122B;
          background: transparent; border: none; width: 100%; text-align: left;
          transition: background 0.12s ease;
        }
        .dropdown-item:hover { background: #F3F2F8; }
        .dropdown-item.active { color: #7c3aed; background: #f4f2fb; }

        .swap-wrap { display: flex; justify-content: center; margin: -22px 0; position: relative; z-index: 6; }
        .swap-btn {
          width: 46px; height: 46px; border-radius: 50%;
          background: linear-gradient(180deg, #ffffff, #fbfaff);
          border: 1px solid #ECECF3; box-shadow: 0 6px 18px -4px rgba(124,58,237,0.22), 0 1px 2px rgba(20,18,43,0.06);
          display: flex; align-items: center; justify-content: center; color: #7c3aed;
          cursor: pointer; transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.15s ease;
        }
        .swap-btn:hover { box-shadow: 0 8px 22px -4px rgba(124,58,237,0.3), 0 1px 2px rgba(20,18,43,0.06); }
        .swap-btn:active { transform: scale(0.88) rotate(180deg); }

        .send-btn {
          width: 100%; margin-top: 22px; border: none; border-radius: 999px; padding: 18px;
          font-size: 16.5px; font-weight: 700; color: #fff; letter-spacing: 0.01em;
          background: linear-gradient(100deg, #3b6ef5, #7b5bf0, #7c3aed);
          display: flex; align-items: center; justify-content: center; gap: 10px;
          cursor: pointer; box-shadow: 0 12px 28px -6px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
          transition: transform 0.12s ease, box-shadow 0.15s ease;
        }
        .send-btn:hover { box-shadow: 0 14px 32px -6px rgba(124,58,237,0.46), inset 0 1px 0 rgba(255,255,255,0.15); }
        .send-btn:active { transform: scale(0.98); }

        .toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          background: #14122B; color: #fff; padding: 12px 18px; border-radius: 14px;
          font-size: 13.5px; font-weight: 600; max-width: 90%; text-align: left;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25); z-index: 100;
          animation: toast-in 0.2s ease;
          display: flex; align-items: center; gap: 9px;
        }
        .toast-icon {
          width: 20px; height: 20px; border-radius: 50%; background: rgba(34,197,94,0.18);
          color: #4ADE80; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        @keyframes toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

        .pin-overlay {
          position: fixed; inset: 0; background: rgba(20,18,43,0.55);
          display: flex; align-items: flex-end; justify-content: center;
          z-index: 200; animation: overlay-in 0.2s ease;
        }
        @keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }
        .pin-modal {
          width: 100%; max-width: 430px; background: #fff;
          border-radius: 28px 28px 0 0; padding: 28px 24px 36px;
          position: relative; animation: sheet-up 0.28s cubic-bezier(.32,.72,0,1);
        }
        @keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .pin-close {
          position: absolute; top: 16px; right: 16px; width: 34px; height: 34px;
          border-radius: 50%; background: #F7F6FB; border: none; color: #8B899E;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: background 0.15s ease;
        }
        .pin-close:hover { background: #EFEDF6; }
        .pin-lock-icon {
          width: 52px; height: 52px; border-radius: 16px; background: #f4f2fb; color: #7c3aed;
          display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
        }
        .pin-title { text-align: center; font-size: 18px; font-weight: 700; color: #14122B; margin: 0 0 6px; }
        .pin-sub { text-align: center; font-size: 13.5px; color: #8B899E; margin: 0 0 28px; font-weight: 500; line-height: 1.4; }
        .pin-dots { display: flex; justify-content: center; gap: 18px; margin-bottom: 32px; }
        .pin-dots.shake { animation: pin-shake 0.4s ease; }
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .pin-dot { width: 14px; height: 14px; border-radius: 50%; background: #E4E1F0; transition: background 0.15s ease, transform 0.15s ease; }
        .pin-dot.filled { background: #7c3aed; transform: scale(1.1); }
        .pin-dot.filled.error { background: #EF4444; }
        .pin-keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 280px; margin: 0 auto; }
        .pin-key {
          aspect-ratio: 1; border-radius: 50%; border: none; background: #F7F6FB;
          font-size: 22px; font-weight: 600; color: #14122B; font-variant-numeric: tabular-nums;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: background 0.12s ease, transform 0.1s ease;
        }
        .pin-key:hover { background: #f4f2fb; }
        .pin-key:active { transform: scale(0.9); background: #ece6fb; }
        .pin-key.empty { background: transparent; cursor: default; }
        .pin-key.empty:hover, .pin-key.empty:active { background: transparent; transform: none; }

        @media (prefers-reduced-motion: reduce) {
          .icon-btn, .collapse-btn, .copy-btn, .swap-btn, .send-btn, .toast, .live-dot,
          .pin-overlay, .pin-modal, .pin-dots, .pin-key { transition: none; animation: none; }
        }
      `}</style>

      {/* Header */}
      <div className="header">
        <button className="icon-btn" onClick={onClose} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <span className="title">Send Money</span>
        <button
          className="icon-btn circle"
          onClick={() => showToast("Recent transfers")}
          aria-label="Transaction history"
        >
          <Clock size={19} />
        </button>
      </div>

      {/* Search — real GET /api/users/resolve?identifier=... lookup */}
      <div className="search-bar">
        <Search size={19} />
        <input
          type="text"
          placeholder="Search by ID or mobile number"
          value={receiverQuery}
          onChange={(e) => { setReceiverQuery(e.target.value); setReceiverError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleResolveReceiver(); }}
        />
        <button
          type="button"
          className="search-avatar"
          onClick={handleResolveReceiver}
          disabled={receiverLoading}
          aria-label="Find receiver"
          style={{ border: "none", background: "none", cursor: receiverLoading ? "default" : "pointer" }}
        >
          <User size={22} />
        </button>
      </div>
      {receiverError && (
        <div style={{ margin: "-10px 0 12px", fontSize: 12.5, fontWeight: 600, color: "#EF4444", textAlign: "center" }}>
          {receiverError}
        </div>
      )}

      {/* TOP CARD */}
      <div className="card">
        <div className="card-header">
          <Flag emoji={top.flag} size="lg" badge="send" />
          <button className="collapse-btn" onClick={() => setTopOpen((o) => !o)} aria-label="Toggle details">
            {topOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {topOpen && (
          <>
            <div className="contact-block">
              <div className="contact-row">
                <div className="contact-icon"><Phone size={16} /></div>
                <span className="contact-text">{top.phone}</span>
                <button
                  className={`copy-btn ${copiedKey === "top-phone" ? "copied" : ""}`}
                  onClick={() => handleCopy(top.phone, "top-phone")}
                  aria-label="Copy phone"
                >
                  {copiedKey === "top-phone" ? <Check size={17} /> : <Copy size={17} />}
                </button>
              </div>
              <div className="contact-row">
                <div className="contact-icon"><CreditCard size={16} /></div>
                <span className="contact-text">{top.id}</span>
                <button
                  className={`copy-btn ${copiedKey === "top-id" ? "copied" : ""}`}
                  onClick={() => handleCopy(top.id, "top-id")}
                  aria-label="Copy ID"
                >
                  {copiedKey === "top-id" ? <Check size={17} /> : <Copy size={17} />}
                </button>
              </div>
            </div>
            <div className="divider" />
          </>
        )}

        <div className="rate-row">
          <div className="rate-left">
            <span className="live-dot" />
            <span>
              1 {top.currency} = {fmt(convert("1", top.currency, bottom.currency))} {bottom.currency}
            </span>
          </div>
          <span className="live-text"><Zap size={14} fill="currentColor" /> Live</span>
        </div>

        <div className="amount-box indigo">
          <input
            className="amount-input"
            value={amount}
            onChange={handleAmountChange}
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Amount to send"
          />
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              className="currency-select"
              onClick={() => setDropdown(dropdown === "top" ? null : "top")}
              aria-label={`Change currency, currently ${top.currency}`}
            >
              <ChevronDown size={16} />
            </button>
            {dropdown === "top" && (
              <>
                <div className="dropdown-overlay" onClick={() => setDropdown(null)} />
                <div className="dropdown-menu">
                  {(Object.entries(CURRENCIES) as [CurrencyCode, typeof CURRENCIES[CurrencyCode]][]).map(([code, c]) => (
                    <button
                      key={code}
                      className={`dropdown-item ${code === top.currency ? "active" : ""}`}
                      onClick={() => selectCurrency("top", code)}
                    >
                      <Flag emoji={c.flag} size="sm" />
                      {code}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SWAP */}
      <div className="swap-wrap">
        <button className="swap-btn" onClick={handleSwap} aria-label="Swap countries">
          <ArrowUpDown size={20} />
        </button>
      </div>

      {/* BOTTOM CARD */}
      <div className="card">
        <div className="card-header">
          <Flag emoji={bottom.flag} size="lg" badge="receive" />
          <button className="collapse-btn" onClick={() => setBottomOpen((o) => !o)} aria-label="Toggle details">
            {bottomOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {bottomOpen && (
          <div className="contact-block">
            <div className="contact-row">
              <div className="contact-icon green"><Phone size={16} /></div>
              <span className="contact-text">{bottom.phone}</span>
              <button
                className={`copy-btn ${copiedKey === "bottom-phone" ? "copied" : ""}`}
                onClick={() => handleCopy(bottom.phone, "bottom-phone")}
                aria-label="Copy phone"
              >
                {copiedKey === "bottom-phone" ? <Check size={17} /> : <Copy size={17} />}
              </button>
            </div>
            <div className="contact-row">
              <div className="contact-icon green"><CreditCard size={16} /></div>
              <span className="contact-text">{bottom.id}</span>
              <button
                className={`copy-btn ${copiedKey === "bottom-id" ? "copied" : ""}`}
                onClick={() => handleCopy(bottom.id, "bottom-id")}
                aria-label="Copy ID"
              >
                {copiedKey === "bottom-id" ? <Check size={17} /> : <Copy size={17} />}
              </button>
            </div>
          </div>
        )}

        <div className="amount-box green" style={{ marginTop: bottomOpen ? 4 : 0 }}>
          <div className="amount-top-row">
            <span className="amount-display">{fmt(convertedAmount)}</span>
            <span className="live-pill"><Zap size={12} fill="currentColor" /> Live</span>
          </div>
          <div className="bottom-meta-row">
            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                className="currency-select"
                style={{ marginTop: 0 }}
                onClick={() => setDropdown(dropdown === "bottom" ? null : "bottom")}
                aria-label={`Change currency, currently ${bottom.currency}`}
              >
                <ChevronDown size={14} />
              </button>
              {dropdown === "bottom" && (
                <>
                  <div className="dropdown-overlay" onClick={() => setDropdown(null)} />
                  <div className="dropdown-menu">
                    {(Object.entries(CURRENCIES) as [CurrencyCode, typeof CURRENCIES[CurrencyCode]][]).map(([code, c]) => (
                      <button
                        key={code}
                        className={`dropdown-item ${code === bottom.currency ? "active" : ""}`}
                        onClick={() => selectCurrency("bottom", code)}
                      >
                        <Flag emoji={c.flag} size="sm" />
                        {code}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SEND BUTTON */}
      <button className="send-btn" onClick={handleSend} disabled={receiverLoading}>
        <SendMoneyLucideIcon size={18} />
        Send
      </button>

      {pinOpen && (
        <div className="pin-overlay" role="dialog" aria-modal="true" aria-label="Enter PIN to confirm transfer">
          <div className="pin-modal">
            <button className="pin-close" onClick={closePin} aria-label="Cancel">
              <X size={18} />
            </button>
            <div className="pin-lock-icon">
              <Lock size={22} />
            </div>
            <h3 className="pin-title">Enter PIN</h3>
            <p className="pin-sub">
              {sending
                ? "Sending…"
                : `Confirm sending ${CURRENCIES[top.currency].label} ${fmt(parseFloat(amount) || 0)} to ${bottom.phone}`}
            </p>
            {pinErrorMessage && (
              <p style={{ textAlign: "center", color: "#EF4444", fontSize: 12.5, fontWeight: 600, margin: "-16px 0 16px" }}>
                {pinErrorMessage}
              </p>
            )}
            <div className={`pin-dots ${pinError ? "shake" : ""}`}>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`pin-dot ${i < pin.length ? "filled" : ""} ${pinError ? "error" : ""}`}
                />
              ))}
            </div>
            <div className="pin-keypad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((k, i) =>
                k === "" ? (
                  <span key={i} className="pin-key empty" />
                ) : k === "back" ? (
                  <button key={i} className="pin-key" onClick={handlePinBackspace} aria-label="Backspace">
                    <Delete size={19} />
                  </button>
                ) : (
                  <button key={i} className="pin-key" onClick={() => handlePinDigit(k)} aria-label={`Digit ${k}`}>
                    {k}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          {toast.startsWith("Sending") && (
            <span className="toast-icon"><Check size={12} strokeWidth={3} /></span>
          )}
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
