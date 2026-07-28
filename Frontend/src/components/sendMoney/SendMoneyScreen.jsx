import React, { useEffect, useMemo, useRef, useState } from "react";
import globalIdLogo from "../../assets/globalid-logo.png";
import {
  ChevronLeft,
  Search,
  Phone,
  CreditCard,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Zap,
  Lock,
  X,
  Delete,
  RefreshCw,
  Send as SendMoneyLucideIcon,
} from "lucide-react";
import { SendMoneyAmbientBg } from "../backgrounds/FinancialAmbient";
import { SubmitButton, SymbolChipRow } from "../common/CodeEntry";
import { PhoneDialPad, SymbolDialPad } from "../common/DialPads";
import { Flag, FlagEmoji, countryGlowStyle } from "../common/FlagComponents";
import { ALL_COUNTRIES, countryFromNumber, countryMatches, mobileDigitRange } from "../../constants/countries";
import { ACTIVE_ISO_SET } from "../../constants/coverage";
import { COUNTRY_CURRENCY, CURRENCIES, convert, fmt } from "../../constants/finance";
import { getHistory, resolveUser, sendTransaction } from "../../services/api/authApi";
import { nextIdentityMode, IDENTITY_DISPLAY_LABEL, identityDisplayValue } from "../../constants/identity";
import { History, Coins, Landmark, ChevronRight } from "lucide-react";

// The transfer confirmation PIN is the account's real login PIN and is
// verified server-side by POST /api/transactions/send — this is only how
// many digits the pad collects before that call fires.
const PIN_LENGTH = 6;

// Combines a country's dial code with typed digits into the string the
// backend's normalizeMobileNumber helper expects — same rule App.jsx uses
// for the sender's own number.
function normalizeMobileForApi(country, digits) {
  if (country.iso === "IN" && digits.length === 10) return `+91${digits}`;
  return `${country.dialCode}${digits}`;
}

// Builds the "sending from" side of the screen out of the country the
// person actually verified with during onboarding, instead of a fixed
// placeholder — so the flag/currency here always matches their Gloobal ID.
export function buildSenderProfile(sender) {
  const s = sender || { name: "United States", iso: "US", dialCode: "+1", flag: "🇺🇸", phoneNumber: "", symbolId: "" };
  const digits = (s.phoneNumber || "").trim();
  return {
    country: s.name,
    flag: s.flag,
    phone: digits ? `${s.dialCode} ${digits}` : `${s.dialCode} •••• •• ••`,
    id: s.symbolId || `${s.iso}${s.dialCode.replace("+", "")}••••••`,
    // The real account this screen sends from — POST /api/transactions/send
    // is keyed on it, so it is never a randomized stand-in.
    symbolId: s.symbolId || "",
    currency: COUNTRY_CURRENCY[s.iso] || "USD",
    dialCode: s.dialCode,
    iso: s.iso,
    name: s.fullName || "Gloobal User",
  };
}
// Most transfers on this screen are domestic, so before anyone's searched
// for anything, the receiver card defaults to the sender's own country and
// currency rather than a random one — it's the far more likely case, and
// it means the card never sits empty/generic while waiting on a search.
export function buildLocalReceiverPlaceholder(senderProfile) {
  return {
    country: senderProfile.country,
    flag: senderProfile.flag,
    phone: "",
    id: "",
    symbolId: "",
    name: "",
    currency: senderProfile.currency,
  };
}
// The inline mobile-search country selector works with the same shape as
// entries in ALL_COUNTRIES ({ name, iso, dialCode, flag }) — this adapts
// the sender's own profile into that shape, so it can be the default.
export function toCountryLike(senderProfile) {
  return {
    name: senderProfile.country,
    iso: senderProfile.iso,
    dialCode: senderProfile.dialCode,
    flag: senderProfile.flag,
  };
}
// How many symbols the Gloobal ID search dial pad requires — a fixed
// 12-symbol code, same length as the account's own Secure ID.
export const ID_SEARCH_LENGTH = 12;
function SendMoneyScreenBase({ onClose, sender, autoOpenHistory = false }) {
  const [top, setTop] = useState(() => buildSenderProfile(sender));
  const [showHistory, setShowHistory] = useState(false);
  // Arriving here from Profile's "View full send history" — open the
  // History sheet immediately on top of the normal Send flow underneath.
  useEffect(() => {
    if (autoOpenHistory) setShowHistory(true);
  }, [autoOpenHistory]);

  const [bottom, setBottom] = useState(() => buildLocalReceiverPlaceholder(buildSenderProfile(sender)));
  const [amount, setAmount] = useState("250.00");
  const [topOpen, setTopOpen] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);
  const [dropdown, setDropdown] = useState(null); // 'top' | 'bottom' | null
  const [toast, setToast] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  // Whatever the backend actually said went wrong — a wrong PIN, a locked
  // account, an amount over the prototype cap — rather than a generic
  // "incorrect PIN", since the PIN is only ever judged server-side.
  const [pinErrorMessage, setPinErrorMessage] = useState(null);
  const [sending, setSending] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searching, setSearching] = useState(false);
  // Real outgoing payments for the History sheet — GET
  // /api/transactions/history already computes `direction` relative to the
  // account that asked, so "sent" is exactly what this screen lists.
  const [history, setHistory] = useState([]);
  const toastTimer = useRef(null);
  const copyTimer = useRef(null);
  const pinErrorTimer = useRef(null);

  // --- Receiver search flow ----------------------------------------------
  // 'dialing' → starting state: cards are up top right away, receiver card
  //             is big and hosts the active Gloobal ID dial pad, sender
  //             card shrinks to a strip. No landing search bar anymore —
  //             this screen opens straight onto Gloobal ID entry.
  // 'found'   → receiver resolved: normal contact/amount/send UI shows.
  const [searchStage, setSearchStage] = useState("dialing");
  const [searchMode, setSearchMode] = useState("id"); // 'id' | 'mobile'
  const [idBuffer, setIdBuffer] = useState("");
  const [mobileBuffer, setMobileBuffer] = useState("");
  // The receiver's region for THIS search — shared by both Gloobal ID and
  // mobile number modes, so switching between them never loses the chosen
  // country. Both default to the sender's own country (most transfers are
  // local), shown as the receiver's flag; tapping that flag drops down
  // every country as a plain flag grid — pick one to search for someone
  // outside your own region. Null here just means "still on the default"
  // — effectiveSearchCountry below always resolves to a real country. A
  // mobile number additionally depends on this for its dial code and
  // digit length; a Gloobal ID doesn't, but still uses it to know which
  // region the flag (and the resolved receiver) should represent.
  const [searchCountry, setSearchCountry] = useState(null);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  // What's shown for BOTH the sender and receiver cards once a receiver's
  // been found — cycles name → Gloobal ID → mobile number → country name →
  // back to name, one shared step at a time, via the single flip icon in
  // the header (top-right, beside the back button). Resets to "name"
  // whenever a fresh search starts.
  const [foundDisplayMode, setFoundDisplayMode] = useState("name"); // 'name' | 'id' | 'mobile' | 'country'
  // What's typed into the country field while searching by mobile number —
  // filters the flag grid by name or dial code, same predicate every other
  // country search box in the app uses (countryMatches).
  const [searchCountryQuery, setSearchCountryQuery] = useState("");
  // --- Gloobal ID lookup preview -----------------------------------------
  // A Gloobal ID carries its own country: the account behind it registered
  // under one. So the moment a complete ID is dialled, the receiver is looked
  // up and the flag follows *them*, not the sender's default region — that
  // was the bug, a UK sender seeing a UK flag over an Indian recipient.
  //
  // The switch is a helpful default, not a lock: selectSearchCountry still
  // overrides it, exactly as it did before. Clearing the ID puts the flag
  // back on the sender's own country.
  const [idPreview, setIdPreview] = useState(null); // { user, country } | null
  const [idPreviewError, setIdPreviewError] = useState(null);
  const [idPreviewLoading, setIdPreviewLoading] = useState(false);
  const effectiveSearchCountry = searchCountry || toCountryLike(top);
  const [minMobileDigits, maxMobileDigits] = mobileDigitRange(effectiveSearchCountry.iso);
  const filteredSearchCountries = useMemo(
    () => ALL_COUNTRIES.filter((c) => countryMatches(c, searchCountryQuery)),
    [searchCountryQuery]
  );

  const convertedAmount = useMemo(
    () => convert(amount, top.currency, bottom.currency),
    [amount, top.currency, bottom.currency]
  );

  useEffect(() => {
    return () => {
      clearTimeout(toastTimer.current);
      clearTimeout(copyTimer.current);
      clearTimeout(pinErrorTimer.current);
    };
  }, []);

  // Real outgoing payments for the History sheet. Reloads whenever a send
  // completes (`toast` flips) so a payment made here shows up without
  // having to reopen the screen.
  useEffect(() => {
    const symbolId = sender?.symbolId;
    if (!symbolId) return;
    let cancelled = false;
    (async () => {
      try {
        const txns = await getHistory(symbolId);
        if (cancelled) return;
        setHistory(
          txns
            .filter((t) => t.direction === "sent")
            .map((t) => ({
              name: t.counterparty?.fullName || t.counterparty?.symbolId || "Gloobal User",
              date: t.createdAt
                ? new Date(t.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : "",
              amount: Number(t.amount) || 0,
              flag: "🌐",
            }))
        );
      } catch {
        // offline or backend waking up — the sheet keeps its empty state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sender?.symbolId, toast]);

  // Real POST /api/transactions/send — PIN-verified server-side. There is
  // no local "correct PIN" to check against here; a wrong PIN, a locked
  // account, or any other failure all come back as a real error from the
  // backend.
  useEffect(() => {
    if (pin.length < PIN_LENGTH) return;
    if (!top.symbolId || !bottom.symbolId) return;
    let cancelled = false;
    setSending(true);
    (async () => {
      try {
        const amountNumber = parseFloat(amount) || 0;
        const idempotencyKey = `gloobal-${top.symbolId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await sendTransaction({
          senderSymbolId: top.symbolId,
          receiverSymbolId: bottom.symbolId,
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
            `Paid ${CURRENCIES[top.currency].label} ${fmt(amountNumber)} to ${bottom.country} · via ${
              payMethod || "Gloobal Bank"
            }`
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

  useEffect(() => {
    if (searchMode !== "id" || searchStage !== "dialing") return;

    // Nothing (or not enough) typed: no recipient, so the flag belongs to the
    // sender's own country again.
    if (idBuffer.length < ID_SEARCH_LENGTH) {
      setIdPreview(null);
      setIdPreviewError(null);
      setIdPreviewLoading(false);
      setSearchCountry(null);
      setBottom((b) => ({ ...b, country: top.country, flag: top.flag }));
      return;
    }

    let cancelled = false;
    setIdPreviewLoading(true);
    setIdPreviewError(null);
    (async () => {
      try {
        const user = await resolveUser(idBuffer);
        if (cancelled) return;
        // Their registered country, read off the dial code of the mobile
        // number the account was created with.
        const country = countryFromNumber(user.mobileNumber) || toCountryLike(top);
        setIdPreview({ user, country });
        setIdPreviewLoading(false);
        setSearchCountry(country);
        setBottom((b) => ({
          ...b,
          country: country.name,
          flag: country.flag,
          currency: COUNTRY_CURRENCY[country.iso] || b.currency,
        }));
      } catch {
        if (cancelled) return;
        // An unknown ID must not move the flag anywhere.
        setIdPreview(null);
        setIdPreviewLoading(false);
        setIdPreviewError("No user found for this ID");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idBuffer, searchMode, searchStage]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function handleCopy(text, key) {
    const doSet = () => {
      setCopiedKey(key);
      clearTimeout(copyTimer.current);
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
    // The currencies swap sides — and with them, the exchange rate and
    // converted amount that are derived from currency. The sender is
    // always the logged-in user, so their country, flag, phone, and
    // Gloobal ID (the "top" side) must never change; only the currency
    // moves.
    setTop((t) => ({ ...t, currency: bottom.currency }));
    setBottom((b) => ({ ...b, currency: top.currency }));
    setDropdown(null);
    // Also flip which card is shown big (expanded) vs a small strip
    // (collapsed) — a purely visual front/back flip. It does not change
    // who the search bar is looking up; that's always the receiver.
    setTopOpen((o) => !o);
    setBottomOpen((o) => !o);
  }

  // Tapping the search bar: first tap opens the dial pad (receiver card
  // goes big, sender collapses to a strip); tapping again after a receiver
  // has already been found starts a fresh search.
  function openSearch() {
    if (searchStage === "dialing") return;
    setSearchStage("dialing");
    setTopOpen(false);
    setBottomOpen(true);
    if (searchStage === "found") {
      setIdBuffer("");
      setMobileBuffer("");
      // Every fresh search starts back on the sender's own local region —
      // whatever country was picked for the last search doesn't carry
      // over — until the person explicitly chooses somewhere else again.
      setSearchCountry(null);
      setSearchCountryQuery("");
      setFoundDisplayMode("name");
      setIdPreview(null);
      setIdPreviewError(null);
      setBottom(buildLocalReceiverPlaceholder(top));
    }
  }

  // The refresher icon on the search bar — flips between looking someone
  // up by Gloobal ID (symbol dial pad) and by mobile number (numeric dial
  // pad). Each mode keeps its own entry buffer, so switching back and
  // forth never loses progress. Both modes share the same searchCountry,
  // though, so the receiver card's flag stays put across the switch
  // instead of resetting.
  function toggleSearchMode(e) {
    e.stopPropagation();
    setSearchMode((m) => (m === "id" ? "mobile" : "id"));
  }

  // Picking a country here — for either a Gloobal ID search or a mobile
  // number search — updates the receiver card's flag right away, so the
  // change is visible before Search is even tapped. For mobile search
  // specifically, it also clears any digits already typed (they were
  // counted against the old country's number length).
  function selectSearchCountry(c) {
    setSearchCountry(c);
    if (searchMode === "mobile") setMobileBuffer("");
    setSearchCountryQuery("");
    setCountryDropdownOpen(false);
    setBottom((b) => ({ ...b, country: c.name, flag: c.flag }));
  }

  // Real GET /api/users/resolve — called once the active dial pad has
  // enough entered and the person taps Search. Gloobal ID search looks up
  // the typed ID directly; mobile search normalizes the typed digits with
  // whichever country is currently selected (the sender's own, unless
  // changed) before resolving. Both modes resolve against the same
  // searchCountry, so switching between them never loses the chosen region.
  async function resolveSearch() {
    if (searching) return;
    const c = effectiveSearchCountry;
    setSearchError(null);
    const identifier = searchMode === "id" ? idBuffer : normalizeMobileForApi(c, mobileBuffer);
    if (identifier === top.symbolId) {
      setSearchError("You can't send money to yourself.");
      return;
    }
    setSearching(true);
    try {
      // The ID lookup already ran while dialling — reuse its answer instead
      // of asking the backend the same question twice.
      const user = searchMode === "id" && idPreview?.user ? idPreview.user : await resolveUser(identifier);
      // For an ID search the receiver's own registered country wins; for a
      // mobile search the selected country *is* how the number was built.
      const receiverCountry = (searchMode === "id" && countryFromNumber(user.mobileNumber)) || c;
      setBottom({
        country: receiverCountry.name,
        flag: receiverCountry.flag,
        phone: user.mobileNumber || "",
        id: user.symbolId,
        symbolId: user.symbolId,
        currency: COUNTRY_CURRENCY[receiverCountry.iso] || "USD",
        name: user.fullName || "Gloobal User",
      });
      setSearchCountry(receiverCountry);
      setSearching(false);
      setSearchStage("found");
      setFoundDisplayMode("name");
      setTopOpen(true);
      setBottomOpen(true);
    } catch (err) {
      setSearching(false);
      setSearchError(
        searchMode === "id"
          ? "No user found for this ID"
          : err instanceof Error
            ? err.message
            : "No Gloobal user found."
      );
    }
  }

  function handleAmountChange(e) {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) {
      setAmount(v);
    }
  }

  function selectCurrency(slot, code) {
    const c = CURRENCIES[code];
    if (slot === "top") {
      setTop((t) => ({ ...t, currency: code }));
    } else {
      setBottom((b) => ({ ...b, currency: code }));
    }
    setDropdown(null);
  }

  // Which of the four funding sources pays this transfer — chosen on the
  // sheet that now opens first when Send is pressed.
  const [payMethodOpen, setPayMethodOpen] = useState(false);
  const [payMethod, setPayMethod] = useState(null);

  function handleSend() {
    setPayMethod(null);
    setPayMethodOpen(true);
  }

  function choosePayMethod(label) {
    setPayMethod(label);
    setPayMethodOpen(false);
    setPin("");
    setPinError(false);
    setPinErrorMessage(null);
    setPinOpen(true);
  }

  // A send is in flight once the last digit lands, so the pad locks until
  // the backend answers — otherwise a stray tap could fire a second call.
  function handlePinDigit(d) {
    if (pinError || sending || pin.length >= PIN_LENGTH) return;
    setPinErrorMessage(null);
    setPin((p) => p + d);
  }

  function handlePinBackspace() {
    if (pinError || sending) return;
    setPin((p) => p.slice(0, -1));
  }

  function closePin() {
    clearTimeout(pinErrorTimer.current);
    setPinOpen(false);
    setPin("");
    setPinError(false);
    setPinErrorMessage(null);
    setSending(false);
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
          gap: 12px;
          margin-bottom: 18px;
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
          padding: 13px 14px 13px 16px;
          gap: 12px;
          margin-bottom: 18px;
          border: 1px solid #ECECF3;
          box-shadow: 0 2px 10px rgba(20,18,43,0.04);
          transition: box-shadow 0.15s ease, border-color 0.15s ease;
          cursor: pointer;
        }
        .search-bar:hover { border-color: #E1DCF2; }
        .search-bar:focus-visible { border-color: #d8d2ee; box-shadow: 0 2px 14px rgba(124,58,237,0.12); }
        .search-bar-active { border-color: #d8d2ee; box-shadow: 0 2px 14px rgba(124,58,237,0.1); }
        .search-bar > svg:first-child { color: #7c3aed; flex-shrink: 0; }
        .search-bar-text {
          flex: 1;
          min-width: 0;
          font-size: 13px;
          font-weight: 600;
          color: #14122B;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
          text-align: center;
        }
        .search-mode-toggle {
          flex-shrink: 0;
          width: 32px; height: 32px; border-radius: 50%;
          background: #f4f2fb; border: none; color: #7c3aed;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: transform 0.15s ease, background 0.15s ease;
        }
        .search-mode-toggle:hover { background: #ece6fb; }
        .search-mode-toggle:active { transform: scale(0.88) rotate(180deg); }

        .dial-entry { display: flex; flex-direction: column; align-items: center; gap: 4px; padding-top: 4px; }
        .dial-entry-label { font-size: 13px; font-weight: 700; color: #6B6580; margin: 0 0 14px; text-align: center; }

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
        .card-header-left { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .card-name {
          font-size: 14.5px;
          font-weight: 700;
          color: #14122B;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
          max-height: 300px; overflow-y: auto;
        }
        .dropdown-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 10px;
          border-radius: 11px; cursor: pointer; font-size: 14.5px; font-weight: 600; color: #14122B;
          background: transparent; border: none; width: 100%; text-align: left;
          transition: background 0.12s ease;
        }
        .dropdown-item:hover { background: #F3F2F8; }
        .dropdown-item.active { color: #7c3aed; background: #f4f2fb; }

        .flag-grid-menu {
          position: absolute; z-index: 50; top: calc(100% + 10px); left: 0;
          background: #fff; border-radius: 16px; box-shadow: 0 16px 40px -8px rgba(20,18,43,0.22);
          padding: 10px; border: 1px solid rgba(20,18,43,0.05);
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px;
          width: 264px; max-height: 240px; overflow-y: auto;
        }
        .flag-grid-item {
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid transparent; border-radius: 8px; background: transparent;
          padding: 4px; cursor: pointer; transition: background 0.12s ease, border-color 0.12s ease;
        }
        .flag-grid-item:hover { background: #F3F2F8; }
        .flag-grid-item.active { border-color: #7c3aed; background: #f4f2fb; }

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

      <SendMoneyAmbientBg />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header — back button on the left, and once a receiver's been
            found, a single flip icon on the right (opposite the
            navigation icon) that cycles BOTH the sender and receiver
            cards together through name → Gloobal ID → mobile number →
            country name. Replaces the old per-card flip button that used
            to sit on the found receiver card's own corner. */}
        <div className="header">
          <button className="icon-btn circle" onClick={onClose} aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {searchStage === "found" && (
              <button
                className="icon-btn circle"
                onClick={() => setFoundDisplayMode((m) => nextIdentityMode(m))}
                aria-label={`Show ${IDENTITY_DISPLAY_LABEL[nextIdentityMode(foundDisplayMode)]}`}
              >
                <RefreshCw size={20} />
              </button>
            )}
            <button className="icon-btn circle" onClick={() => setShowHistory(true)} aria-label="Paid history">
              <History size={20} />
            </button>
          </div>
        </div>

        {showHistory && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(15,12,35,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setShowHistory(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 430, maxHeight: "72vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "26px 26px 0 0", padding: "26px 22px 34px", boxShadow: "0 -10px 40px rgba(20,18,43,0.18)" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#14122B", fontFamily: "inherit" }}>Paid History</span>
                <button
                  onClick={() => setShowHistory(false)}
                  aria-label="Close"
                  style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#F7F6FB", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <X size={15} color="#6b6685" />
                </button>
              </div>
              <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", borderRadius: 18, background: "#F7F6FB", border: "1px solid rgba(20,18,43,0.06)" }}>
                {history.length === 0 ? (
                  <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12.5, color: "#8b86a3" }}>No payments yet</div>
                ) : (
                  history.map((t, i) => (
                    <div
                      key={`${t.name}-${t.date}`}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i === 0 ? "none" : "1px solid rgba(20,18,43,0.06)" }}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{t.flag}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#14122B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                        <span style={{ display: "block", fontSize: 11, color: "#9a95b0", marginTop: 1 }}>{t.date}</span>
                      </span>
                      <span style={{ textAlign: "right", flexShrink: 0 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#14122B" }}>−${fmt(t.amount)}</span>
                        <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#4633C7", marginTop: 1 }}>Paid</span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      {searchStage !== "closed" && (
        <>
          {/* RECEIVER CARD — now shown first/up top, since this is the
              editable side while searching: big by default, hosts the
              active dial pad until resolved, then the normal contact +
              amount UI. */}
          <div className="card">
            {searchStage === "dialing" && (
              <button
                onClick={toggleSearchMode}
                aria-label={`Switch to ${searchMode === "id" ? "mobile number" : "Gloobal ID"} search`}
                className="v2-tap"
                style={{
                  position: "absolute",
                  top: -14,
                  right: -10,
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "1px solid rgba(20,18,43,0.06)",
                  background: "#fff",
                  color: "#7c3aed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(20,18,43,0.12)",
                  zIndex: 3,
                }}
              >
                <RefreshCw size={18} />
              </button>
            )}
            <div className="card-header">
              <div className="card-header-left" style={{ position: "relative", flex: searchStage === "dialing" ? 1 : undefined }}>
                {searchStage === "dialing" ? (
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <button
                      onClick={() => setCountryDropdownOpen((o) => !o)}
                      aria-label={`Country: ${effectiveSearchCountry.name}. Tap to search for someone outside your own country`}
                      data-testid="receiver-country"
                      data-country={effectiveSearchCountry.iso}
                      className="v2-tap"
                      style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex" }}
                    >
                      <Flag emoji={bottom.flag} size="lg" badge="receive" />
                    </button>
                    {/* Dial code tucked behind the flag as a small tag —
                        mobile-only, since a Gloobal ID has no dial code
                        of its own. */}
                    {searchMode === "mobile" && (
                      <span
                        style={{
                          position: "absolute",
                          top: -6,
                          left: -8,
                          background: "#14122B",
                          color: "#fff",
                          fontSize: 9.5,
                          fontWeight: 800,
                          letterSpacing: 0.2,
                          padding: "2px 5px",
                          borderRadius: 999,
                          border: "2px solid #fff",
                          boxShadow: "0 2px 6px rgba(20,18,43,0.18)",
                          pointerEvents: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {effectiveSearchCountry.dialCode}
                      </span>
                    )}
                  </div>
                ) : (
                  <span data-testid="receiver-country" data-country={effectiveSearchCountry.iso} style={{ display: "flex" }}>
                    <Flag emoji={bottom.flag} size="lg" badge="receive" />
                  </span>
                )}
                {searchStage === "found" ? (
                  <span className="card-name">{identityDisplayValue(bottom, foundDisplayMode)}</span>
                ) : (
                  bottom.name && <span className="card-name">{bottom.name}</span>
                )}

                {/* "Gloobal ID" label, aligned with the flag on the header
                    row — the chip row + dial pad below already echo what's
                    typed, so this is just the field label, not an input. */}
                {searchStage === "dialing" && searchMode === "id" && (
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: "#14122B" }}>Gloobal ID</span>
                )}

                {/* Country field beside the flag while dialing in mobile
                    mode — a real typeable search, same country/code
                    matching every other country picker in the app uses,
                    not just a static label. Typing filters the dropdown
                    below live; tapping the flag opens it too. */}
                {searchStage === "dialing" && searchMode === "mobile" && (
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      background: "#fff",
                      border: "1px solid #ECECF3",
                      borderRadius: 999,
                      padding: "9px 13px",
                      boxShadow: "0 2px 10px rgba(20,18,43,0.04)",
                    }}
                  >
                    <input
                      value={searchCountryQuery}
                      onChange={(e) => {
                        setSearchCountryQuery(e.target.value);
                        setCountryDropdownOpen(true);
                      }}
                      onFocus={() => setCountryDropdownOpen(true)}
                      placeholder={effectiveSearchCountry.name}
                      aria-label="Search country or code"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: "none",
                        outline: "none",
                        background: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#14122B",
                      }}
                    />
                    <ChevronDown size={14} style={{ color: "#9C96AF", flexShrink: 0 }} />
                  </div>
                )}

                {countryDropdownOpen && (
                  <>
                    <div className="dropdown-overlay" onClick={() => setCountryDropdownOpen(false)} />
                    <div className="flag-grid-menu">
                      {filteredSearchCountries.length === 0 && (
                        <div style={{ padding: "10px 6px", fontSize: 12.5, color: "#9C96AF", fontWeight: 600 }}>
                          No countries found
                        </div>
                      )}
                      {filteredSearchCountries.map((c) => (
                        <button
                          key={c.iso}
                          className={`flag-grid-item ${c.iso === effectiveSearchCountry.iso ? "active" : ""}`}
                          onClick={() => selectSearchCountry(c)}
                          aria-label={c.name}
                          title={c.name}
                        >
                          <div style={{ position: "relative", width: 26, height: 20, borderRadius: 5, ...countryGlowStyle(ACTIVE_ISO_SET.has(c.iso), true) }}>
                            <div style={{ position: "absolute", inset: 0, borderRadius: 5, overflow: "hidden" }}>
                              <FlagEmoji flag={c.flag} width={26} height={20} />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {searchStage === "found" && (
                <button className="collapse-btn" onClick={() => setBottomOpen((o) => !o)} aria-label="Toggle details">
                  {bottomOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              )}
            </div>

            {searchStage === "dialing" && (
              <div className="dial-entry">
                {searchMode === "id" ? (
                  <>
                    <SymbolChipRow length={ID_SEARCH_LENGTH} value={idBuffer} masked={false} />
                    <div style={{ marginTop: 22, width: "100%" }}>
                      <SymbolDialPad value={idBuffer} onChange={setIdBuffer} length={ID_SEARCH_LENGTH} />
                    </div>
                  </>
                ) : (
                  <PhoneDialPad
                    value={mobileBuffer}
                    onChange={setMobileBuffer}
                    minLength={minMobileDigits}
                    maxLength={maxMobileDigits}
                  />
                )}
                <SubmitButton
                  onClick={resolveSearch}
                  disabled={
                    searching ||
                    (searchMode === "id"
                      ? idBuffer.length < ID_SEARCH_LENGTH
                      : mobileBuffer.length < minMobileDigits)
                  }
                  label={searching ? "Searching…" : "Search"}
                />
                {/* Who this ID actually belongs to — shown as soon as the ID
                    is complete, with the flag above already switched to their
                    country. */}
                {searchMode === "id" && idPreview && (
                  <div
                    data-testid="recipient-found"
                    style={{
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      alignSelf: "stretch",
                      justifyContent: "center",
                      border: "1px solid #0FA372",
                      background: "#E3F8EE",
                      borderRadius: 999,
                      padding: "9px 14px",
                    }}
                  >
                    <FlagEmoji flag={idPreview.country.flag} width={24} height={18} radius={4} />
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: "#14122B",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 130,
                      }}
                    >
                      {idPreview.user.symbolId}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#0FA372", flexShrink: 0 }}>
                      Recipient found ✓
                    </span>
                  </div>
                )}

                {searchMode === "id" && idPreviewLoading && !idPreview && (
                  <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: "#8b86a3", fontWeight: 600 }}>
                    Looking up this Gloobal ID…
                  </div>
                )}

                {searchMode === "id" && idPreviewError && !searchError && (
                  <div
                    data-testid="recipient-not-found"
                    role="alert"
                    style={{ marginTop: 10, textAlign: "center", fontSize: 12.5, color: "#EF4444", fontWeight: 600 }}
                  >
                    {idPreviewError}
                  </div>
                )}

                {searchError && (
                  <div
                    role="alert"
                    style={{ marginTop: 10, textAlign: "center", fontSize: 12.5, color: "#EF4444", fontWeight: 600 }}
                  >
                    {searchError}
                  </div>
                )}
              </div>
            )}

            {searchStage === "found" && bottomOpen && (
              <>
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

                <div className="amount-box green" style={{ marginTop: 4 }}>
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
                            {Object.entries(CURRENCIES).map(([code, c]) => (
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
              </>
            )}
          </div>

          {/* SWAP — only once a receiver's been found. Flips currency
              sides and, with it, which card is shown big vs as a strip.
              The search bar itself always looks up the receiver, no
              matter which card is currently in front. */}
          {searchStage === "found" && (
            <div className="swap-wrap">
              <button className="swap-btn" onClick={handleSwap} aria-label="Flip sender and receiver cards">
                <ArrowUpDown size={20} />
              </button>
            </div>
          )}

          {/* SENDER CARD — now shown second/below the receiver card.
              Big while its own chevron is open, otherwise just the
              header strip. Starts collapsed as soon as search opens,
              since the receiver card is what's active. */}
          <div className="card" style={{ marginTop: searchStage === "dialing" ? 14 : 0 }}>
            <div className="card-header">
              <div className="card-header-left">
                <Flag emoji={top.flag} size="lg" badge="send" />
                <span className="card-name">
                  {searchStage === "found" ? identityDisplayValue(top, foundDisplayMode) : top.name}
                </span>
              </div>
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

                <div className="rate-row">
                  <div className="rate-left">
                    <span className="live-dot" />
                    <span>
                      1 {top.currency} = {fmt(convert(1, top.currency, bottom.currency))} {bottom.currency}
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
                          {Object.entries(CURRENCIES).map(([code, c]) => (
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
              </>
            )}
          </div>

          {/* PAY BUTTON */}
          {searchStage === "found" && (
            <button className="send-btn" onClick={handleSend}>
              <SendMoneyLucideIcon size={18} />
              Pay
            </button>
          )}
        </>
      )}

      {/* Funding source — the four ways a transfer can be paid. Picking
          one moves straight on to the OTP confirmation. */}
      {payMethodOpen && (
        <div
          className="pin-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Choose how to pay"
          onClick={() => setPayMethodOpen(false)}
        >
          <div className="pin-modal" onClick={(e) => e.stopPropagation()}>
            <button className="pin-close" onClick={() => setPayMethodOpen(false)} aria-label="Cancel">
              <X size={18} />
            </button>
            <h3 className="pin-title">Pay with</h3>
            <p className="pin-sub">
              {CURRENCIES[top.currency].label} {fmt(parseFloat(amount) || 0)} to {bottom.phone}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6, textAlign: "left" }}>
              {[
                { key: "gbank", label: "Gloobal Bank" },
                { key: "gpaylater", label: "Gloobal PayLater" },
                { key: "gcoin", label: "Gloobal Coin" },
                { key: "local", label: "Local Banks" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => choosePayMethod(label)}
                  className="v2-tap"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    border: "1px solid #ECECF3",
                    background: "#fff",
                    borderRadius: 16,
                    padding: "12px 14px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 13,
                      flexShrink: 0,
                      background: key === "gbank" ? "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)" : "#F1EDFB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {key === "gbank" ? (
                      <img src={globalIdLogo} alt="" style={{ width: 26, height: 26, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                    ) : key === "gpaylater" ? (
                      <CreditCard size={19} color="#7C3AED" />
                    ) : key === "gcoin" ? (
                      <Coins size={19} color="#7C3AED" />
                    ) : (
                      <Landmark size={19} color="#7C3AED" />
                    )}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: "#14122B" }}>{label}</span>
                  <ChevronRight size={17} color="#B9B3CC" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {pinOpen && (
        <div className="pin-overlay" role="dialog" aria-modal="true" aria-label="Enter OTP to confirm transfer">
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
                ? "Confirming with the server…"
                : pinErrorMessage || (
                    <>
                      Confirm sending {CURRENCIES[top.currency].label} {fmt(parseFloat(amount) || 0)} to{" "}
                      {bottom.phone}
                      {payMethod ? ` · via ${payMethod}` : ""}
                    </>
                  )}
            </p>
            <div className={`pin-dots ${pinError ? "shake" : ""}`}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
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
          {toast.startsWith("Paid") && (
            <span className="toast-icon"><Check size={12} strokeWidth={3} /></span>
          )}
          <span>{toast}</span>
        </div>
      )}
      </div>
    </div>
  );
}

// Memoized for the same reason as DashboardScreen — see that file's note.
export const SendMoneyScreen = React.memo(SendMoneyScreenBase);
