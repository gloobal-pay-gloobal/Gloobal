import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import './GloobalAccess.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gloobal-pay.onrender.com';

const SYMBOL_KEYS = ['+', '-', '\u00D7', '=', '\u25A1', '\u25A0', '\u25CB', '\u25CF'];
const PROTOTYPE_OTP = '0000';
const HEART_COLORS = ['💜', '💛', '💚', '💙', '🩷', '🩵', '❤️', '🤎'];

// 12 distinct vibrant colors for boxes
const BOX_COLORS = [
  '#FF4757', '#FF6B35', '#FFA502', '#ECCC68',
  '#2ED573', '#1E90FF', '#5352ED', '#A55EEA',
  '#FF6B81', '#00D2D3', '#54A0FF', '#5F27CD',
];

// Mobile digit colors
const MOBILE_COLORS = [
  '#FF4757', '#FF6B35', '#FFA502', '#2ED573',
  '#1E90FF', '#5352ED', '#A55EEA', '#FF6B81',
  '#00D2D3', '#54A0FF',
];

function formatMobileIdentity(digits) {
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
}

function OpenEyeIcon() {
  return (
    <svg className="ga-eye-svg ga-eye-svg-open" width="30" height="30" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.8 12s3.8-7 10.2-7 10.2 7 10.2 7-3.8 7-10.2 7-10.2-7-10.2-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ClosedEyeIcon() {
  return (
    <svg className="ga-eye-svg ga-eye-svg-closed" width="34" height="34" viewBox="0 0 64 64"
      fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 30C19 44 45 44 56 30" />
      <path d="M16 38L10 46" />
      <path d="M28 43L27 52" />
      <path d="M40 43L41 52" />
      <path d="M50 38L56 46" />
    </svg>
  );
}

// Symbol slots: white boxes colored text | gap | X(bigger) | gap | Verify(biggest) — one line
function ColorSymbolSlots({ symbols, shouldHide, isComplete, onDelete, isBusy }) {
  return (
    <div className="ga-color-slots-row">
      {/* 12 white boxes with colored symbols */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="ga-color-box ga-white-box"
          style={{
            boxShadow: i < symbols.length ? '0 2px 8px rgba(67,97,238,0.18)' : '0 1px 3px rgba(0,0,0,0.07)',
            border: i < symbols.length ? '1.5px solid rgba(67,97,238,0.25)' : '1.5px dashed rgba(67,97,238,0.18)',
          }}
        >
          <span className="ga-color-box-char" style={{ color: i < symbols.length ? BOX_COLORS[i] : '#c5cde8', fontWeight: 800 }}>
            {i < symbols.length ? (shouldHide ? '•' : symbols[i]) : '·'}
          </span>
        </div>
      ))}

      {/* Gap */}
      <div style={{ width: '5px', flexShrink: 0 }} />

      {/* Cross — thoda bada than boxes */}
      <button
        type="button"
        className="ga-action-btn ga-action-delete ga-action-md"
        onClick={onDelete}
        disabled={isBusy || symbols.length === 0}
        title="Delete last"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Gap */}
      <div style={{ width: '4px', flexShrink: 0 }} />

      {/* Verify — sabse bada */}
      <button
        type="button"
        className={`ga-action-btn ga-action-verify ga-action-lg ${isComplete ? 'ga-action-verify-done' : ''}`}
        disabled
        title={isComplete ? 'Complete!' : 'Fill all 12'}
      >
        {isComplete ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3.5" />
          </svg>
        )}
      </button>
    </div>
  );
}

// Mobile number boxes with flag/code toggle, white boxes, colored digits, verify at end
function ColorMobileBoxes({ digits, onRef }) {
  const [showFlag, setShowFlag] = React.useState(true);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  return (
    <div className="ga-mobile-boxes-row" style={{ position: 'relative' }}>
      {/* Country selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, position: 'relative' }}>
        {/* Flag box — full cover */}
        <div className="ga-flag-box" onClick={() => setDropdownOpen((v) => !v)}>
          {showFlag ? (
            <img
              src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f1ee-1f1f3.svg"
              alt="IN"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#4361ee' }}>+91</span>
          )}
        </div>

        {/* Chevron — just floating beside, no box */}
        <svg
          onClick={() => setDropdownOpen((v) => !v)}
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="#4361ee" strokeWidth="2.5" strokeLinecap="round"
          style={{ cursor: 'pointer', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="ga-country-dropdown">
            <div className="ga-country-option" onClick={(e) => { e.stopPropagation(); setShowFlag(true); setDropdownOpen(false); }}>
              <img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f1ee-1f1f3.svg" alt="IN" style={{ width: '22px', height: '22px', objectFit: 'cover', borderRadius: '4px' }} />
              {showFlag && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <div className="ga-country-option" onClick={(e) => { e.stopPropagation(); setShowFlag(false); setDropdownOpen(false); }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#4361ee' }}>+91</span>
              {!showFlag && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
          </div>
        )}
      </div>

      {/* Gap */}
      <div style={{ width: '6px', flexShrink: 0 }} />

      {/* Digit boxes + verify icon — wrapped so the invisible input only covers THIS area, not the flag/dropdown */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
        {/* 10 digit boxes — white, colored text */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="ga-color-box ga-white-box"
            style={{
              boxShadow: i < digits.length ? `0 2px 8px rgba(67,97,238,0.18)` : '0 1px 4px rgba(0,0,0,0.07)',
              border: i < digits.length ? '1.5px solid rgba(67,97,238,0.25)' : '1.5px dashed rgba(67,97,238,0.18)',
            }}
          >
            <span className="ga-color-box-char" style={{ color: i < digits.length ? MOBILE_COLORS[i] : '#c5cde8', fontWeight: 800 }}>
              {i < digits.length ? digits[i] : '·'}
            </span>
          </div>
        ))}

        {/* Verify box — bigger */}
        <div className={`ga-verify-mobile ${digits.length === 10 ? 'ga-verify-mobile-done' : ''}`}>
          {digits.length === 10 ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3" />
            </svg>
          )}
        </div>

        {/* Hidden real input — covers ONLY the digit-boxes + verify area, never the flag/chevron */}
        <input
          ref={onRef}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'text', zIndex: 10, fontSize: '16px',
          }}
        />
      </div>
    </div>
  );
}

export default function GloobalAccess({ onComplete }) {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [secureSymbols, setSecureSymbols] = useState([]);
  const [referrerSymbols, setReferrerSymbols] = useState([]);
  const [activeField, setActiveField] = useState('secure');
  const [hideSecure, setHideSecure] = useState(false);
  const [hideReferrer, setHideReferrer] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const mobileInputRef = React.useRef(null);

  const [hearts, setHearts] = useState([]);
  const [isBeating, setIsBeating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now() + Math.random();
      const randomColor = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
      const randomX = (Math.random() * 80 - 40) + 'px';
      setIsBeating(true);
      setTimeout(() => setIsBeating(false), 250);
      setHearts((prev) => [...prev, { id, color: randomColor, randomX }]);
      setTimeout(() => { setHearts((prev) => prev.filter((h) => h.id !== id)); }, 3500);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const mobileDigits = mobile.replace(/\D/g, '').slice(0, 10);
  const mobileIdentity = useMemo(() => formatMobileIdentity(mobileDigits), [mobileDigits]);

  const secureId = secureSymbols.join('');
  const referredBy = referrerSymbols.join('');

  const isMobileValid = mobileDigits.length === 10;
  const isOtpValid = otp === PROTOTYPE_OTP;

  const currentFieldIsSecure = activeField === 'secure';
  const activeSymbols = currentFieldIsSecure ? secureSymbols : referrerSymbols;
  const currentFieldIsHidden = currentFieldIsSecure ? hideSecure : hideReferrer;
  const currentFieldLabel = currentFieldIsSecure ? 'Secure ID' : 'Referral ID';
  const eyeButtonLabel = currentFieldIsHidden ? `Show ${currentFieldLabel}` : `Hide ${currentFieldLabel}`;

  const updateActiveSymbols = (nextSymbols) => {
    if (currentFieldIsSecure) { setSecureSymbols(nextSymbols); return; }
    setReferrerSymbols(nextSymbols);
  };

  const handleSymbolPress = (symbol) => {
    if (busy) return;
    if (activeSymbols.length >= 12) {
      setStatus(currentFieldIsSecure ? 'Secure ID already has 12 symbols.' : 'Referral ID already has 12 symbols.');
      return;
    }
    updateActiveSymbols([...activeSymbols, symbol]);
    setStatus('');
  };

  const handleClear = () => {
    if (busy) return;
    updateActiveSymbols([]);
    setStatus('');
  };

  const handleToggleVisibility = () => {
    if (busy) return;
    if (activeField === 'secure') setHideSecure((v) => !v);
    if (activeField === 'referrer') setHideReferrer((v) => !v);
    setStatus('');
  };

  const handleMobileChange = (event) => {
    const nextMobile = event.target.value;
    const nextDigits = nextMobile.replace(/\D/g, '');
    setMobile(nextMobile);
    setStatus('');
    if (nextDigits.length < 10 && otp) setOtp('');
  };

  const handleOtpChange = (event) => {
    const nextOtp = event.target.value.replace(/\D/g, '').slice(0, 4);
    setOtp(nextOtp);
    setStatus('');
  };

  const proceedToSecureId = () => {
    if (!isMobileValid) { setStatus('Please enter a valid 10-digit mobile number.'); return; }
    if (!isOtpValid) { setStatus('Enter OTP 0000 to verify mobile.'); return; }
    setStatus('');
    setStep(2);
  };

  const deleteLastSecureSymbol = (e) => {
    e && e.stopPropagation();
    if (busy || secureSymbols.length === 0) return;
    setSecureSymbols((s) => s.slice(0, -1));
    setStatus('');
  };

  const deleteLastReferralSymbol = (e) => {
    e && e.stopPropagation();
    if (busy || referrerSymbols.length === 0) return;
    setReferrerSymbols((s) => s.slice(0, -1));
    setStatus('');
  };

  const handleSubmit = async () => {
    if (secureSymbols.length !== 12) { alert('Please complete all 12 symbols for Secure ID.'); return; }
    if (referrerSymbols.length > 0 && referrerSymbols.length !== 12) {
      alert('Referral ID is optional, but if entered it must be 12 symbols.');
      return;
    }
    const userData = { fullName: mobileIdentity, symbolId: secureId, referredBy: referredBy || '' };
    setBusy(true);
    setStatus('Checking Secure ID...');
    try {
      const response = await axios.post(`${API_BASE}/api/register-symbol`, userData);
      const savedUser = response.data?.user || userData;
      const nextUser = {
        fullName: savedUser.fullName || mobileIdentity,
        mobileNumber: mobileIdentity,
        symbolId: savedUser.symbolId || secureId,
        referralCount: savedUser.referralCount || 0,
        referredBy: savedUser.referredBy || referredBy || null,
        hasPasskey: Boolean(savedUser.hasPasskey)
      };
      setRegisteredUser(nextUser);
      if (response.data?.alreadyRegistered) {
        setStatus('Secure ID already registered. Continuing to login...');
      } else {
        setStatus('Registration complete. Continuing...');
      }
      setTimeout(() => { if (typeof onComplete === 'function') onComplete(nextUser); }, 1200);
    } catch (err) {
      console.error('Registration saving error:', err);
      const message = err.response?.data?.message || 'Could not connect to server. Please try again.';
      setStatus(message);
      alert(message);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = isMobileValid && isOtpValid && secureSymbols.length === 12 && !busy;

  return (
    <div className="ga-wrapper">
      <style>{`
        /* ── Force white background everywhere ── */
        .ga-wrapper {
          background: #ffffff !important;
          min-height: 100vh;
        }
        .ga-shell {
          background: #ffffff !important;
        }

        /* ── Color boxes — one line, no scroll ── */
        .ga-color-slots-row {
          display: flex;
          align-items: center;
          gap: 3px;
          width: 100%;
          margin: 8px 0 4px 0;
          flex-wrap: nowrap;
          overflow: hidden;
        }
        .ga-color-box {
          flex: 1 1 0;
          min-width: 0;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, box-shadow 0.2s;
        }
        .ga-color-box-char {
          font-size: 12px;
          font-weight: 800;
          line-height: 1;
          user-select: none;
        }

        /* ── Action buttons inline ── */
        .ga-action-btn {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .ga-action-delete {
          background: linear-gradient(135deg, #ff4757, #ff6b81);
          color: #fff;
          box-shadow: 0 3px 8px rgba(255,71,87,0.4);
        }
        .ga-action-delete:hover:not(:disabled) { transform: scale(1.1); }
        .ga-action-delete:disabled { opacity: 0.35; cursor: not-allowed; }
        .ga-action-verify {
          background: rgba(67,97,238,0.1);
          color: #a0aec0;
          cursor: default;
        }
        .ga-action-verify-done {
          background: linear-gradient(135deg, #2ED573, #1abc9c);
          color: #fff;
          box-shadow: 0 3px 8px rgba(46,213,115,0.45);
          animation: ga-verify-pop 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes ga-verify-pop {
          0% { transform: scale(0.7); }
          100% { transform: scale(1); }
        }

        /* ── Mobile boxes — one line, no scroll ── */
        .ga-mobile-boxes-row {
          display: flex;
          align-items: center;
          gap: 3px;
          width: 100%;
          margin: 8px 0 10px 0;
          flex-wrap: nowrap;
          overflow: visible;
          cursor: text;
        }

        /* ── White shiny box ── */
        .ga-white-box {
          background: #ffffff !important;
        }
        /* ── id-box pure white bg ── */
        .ga-id-box {
          background: #ffffff !important;
        }

        /* ── Country selector ── */
        /* Flag box — pure image, no padding */
        .ga-flag-box {
          width: 44px;
          height: 36px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f3ff;
        }

        .ga-country-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(67,97,238,0.18);
          border: 1px solid rgba(67,97,238,0.12);
          overflow: hidden;
          z-index: 100;
          min-width: 110px;
        }
        .ga-country-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          cursor: pointer;
          font-size: 13px;
          color: #2d3142;
          font-weight: 500;
          transition: background 0.15s;
        }
        .ga-country-option:hover { background: rgba(67,97,238,0.07); }
        .ga-country-option:not(:last-child) { border-bottom: 1px solid rgba(67,97,238,0.08); }

        /* ── Mobile verify box ── */
        .ga-verify-mobile {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: rgba(67,97,238,0.08);
          color: #a0aec0;
          transition: all 0.3s;
        }
        .ga-verify-mobile-done {
          background: linear-gradient(135deg, #2ED573, #1abc9c);
          color: #fff;
          box-shadow: 0 4px 12px rgba(46,213,115,0.4);
          animation: ga-verify-pop 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }

        /* ── Action button size variants ── */
        .ga-action-md {
          width: 28px !important;
          height: 28px !important;
        }
        .ga-action-lg {
          width: 36px !important;
          height: 36px !important;
          border-radius: 11px !important;
        }
        /* ── Mobile verify bigger ── */
        .ga-verify-mobile {
          width: 38px !important;
          height: 38px !important;
          border-radius: 11px !important;
        }

        /* ── id-box stretch ── */
        .ga-id-box {
          width: 100%;
          padding: 14px 16px 12px 16px;
          box-sizing: border-box;
        }

        /* ── OTP hint ── */
        .ga-otp-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #4361ee;
          background: rgba(67,97,238,0.07);
          border-radius: 20px;
          padding: 5px 12px;
          margin-bottom: 16px;
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        /* ── Heading icon ── */
        .ga-heading-icon {
          display: flex;
          margin: 0 auto 10px auto;
          width: 54px;
          height: 54px;
          background: rgba(67,97,238,0.08);
          border-radius: 16px;
          align-items: center;
          justify-content: center;
        }

        /* ── Brand text ── */
        .ga-brand-text {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #1a1f36;
          font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;
        }

        /* ── Page headings ── */
        .ga-heading {
          font-size: 28px;
          font-weight: 400;
          line-height: 1.3;
          color: #2d3142;
          margin: 0 0 24px 0;
          text-align: center;
          font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;
          letter-spacing: -0.01em;
        }
        .ga-heading strong {
          font-weight: 700;
          color: #4361ee;
          display: block;
          font-size: 32px;
          letter-spacing: -0.02em;
        }

        /* ── Brand block spacing ── */
        .ga-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 28px;
          padding: 0 4px;
        }

        /* ── Step view ── */
        .ga-step-view {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }

        /* ── Arrow CTA (slide to continue) ── */
        .ga-arrow-cta {
          position: relative;
          background: linear-gradient(135deg, #4361ee, #5352ED) !important;
          border-radius: 50px !important;
          height: 56px !important;
          overflow: hidden !important;
          cursor: pointer;
          padding: 0 !important;
        }
        .ga-arrow-cta:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ga-arrow-track {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          position: relative;
        }
        .ga-arrow-thumb {
          width: 44px;
          height: 44px;
          background: rgba(255,255,255,0.22);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          animation: ga-arrow-pulse 1.5s ease-in-out infinite;
        }
        .ga-arrow-cta:not(:disabled):hover .ga-arrow-thumb {
          background: rgba(255,255,255,0.35);
          transform: scale(1.1);
          transition: all 0.2s;
        }
        @keyframes ga-arrow-pulse {
          0%, 100% { transform: translateX(0); opacity: 1; }
          50% { transform: translateX(6px); opacity: 0.85; }
        }

        /* ── Hearts ── */
        .static-footer-master-heart {
          position: relative;
          display: inline-block;
          font-size: 26px;
          z-index: 40;
          transition: transform 0.2s ease;
        }
        .static-footer-master-heart.beating { transform: scale(1.3); }
        .ga-automatic-colored-heart {
          position: absolute;
          left: 50%;
          top: 50%;
          font-size: 13px;
          pointer-events: none;
          z-index: 10;
          animation: ga-heart-shoot-up 3.5s cubic-bezier(0.1,0.65,0.25,1) forwards;
        }
        @keyframes ga-heart-shoot-up {
          0%   { transform: translate(-50%,-50%) scale(0.3); opacity: 0; }
          12%  { opacity: 1; transform: translate(-50%,-35px) scale(1.1); }
          100% { transform: translate(calc(-50% + var(--drift-x,0px)),-120vh) scale(0.75) rotate(20deg); opacity: 0; }
        }
      `}</style>

      <div className="ga-shell">
        {registeredUser ? (
          <div className="ga-success">
            <div className="ga-step-bar">
              <div className="ga-segment ga-done" />
              <div className="ga-segment ga-done" />
            </div>
            <div className="ga-success-orb">{'\u2713'}</div>
            <h1 className="ga-heading">
              Mobile identity<br />
              <strong>connected</strong>
            </h1>
            <div className="ga-summary-card"><span>Mobile</span><strong>{registeredUser.mobileNumber || registeredUser.fullName}</strong></div>
            <div className="ga-summary-card"><span>Secure ID</span><strong>{registeredUser.symbolId}</strong></div>
            {registeredUser.referredBy && (
              <div className="ga-summary-card"><span>Referral ID</span><strong>{registeredUser.referredBy}</strong></div>
            )}
            <p className="ga-status">Preparing device authentication...</p>
          </div>
        ) : (
          <>
            <div className="ga-step-bar">
              <div className={`ga-segment ${step >= 1 ? 'ga-active' : ''} ${step > 1 ? 'ga-done' : ''}`} />
              <div className={`ga-segment ${step >= 2 ? 'ga-active' : ''}`} />
            </div>

            <div className="ga-brand">
              <div className="ga-logo-circle" aria-label="Gloobal logo">
                <img src="/pwa-512x512.jpeg" alt="Gloobal logo" className="ga-logo-img" />
              </div>
              <div className="ga-brand-text">Gloobal Access</div>
            </div>

            {step === 1 && (
              <div className="ga-step-view ga-step-enter">
                <h1 className="ga-heading">
                  <span className="ga-heading-icon">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" />
                      <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="3" />
                    </svg>
                  </span>
                  Enter 
                  <br />
                  <strong>mobile number</strong>
                </h1>

                {/* Mobile color boxes — click anywhere on box to type */}
                <div className="ga-id-box" style={{ marginBottom: '12px' }} onClick={() => mobileInputRef.current && mobileInputRef.current.focus()}>
                  <div className="ga-id-top">
                    <span>Mobile Number</span>
                    <small>{mobileDigits.length} / 10</small>
                  </div>
                  <ColorMobileBoxes
                    digits={mobileDigits}
                    onRef={(el) => { mobileInputRef.current = el; if (el) { el.value = mobile; el.oninput = (ev) => handleMobileChange({ target: { value: ev.target.value } }); } }}
                  />
                </div>

                <div className="ga-otp-hint">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <circle cx="9" cy="10" r="1" fill="#4361ee" />
                    <circle cx="12" cy="10" r="1" fill="#4361ee" />
                    <circle cx="15" cy="10" r="1" fill="#4361ee" />
                  </svg>
                  <span>OTP sent via SMS</span>
                </div>

                <div className="ga-field-block">
                  <label className="ga-label" htmlFor="otpInput">OTP Code</label>
                  <input
                    id="otpInput" type="tel" inputMode="numeric" className="ga-input"
                    value={otp} onChange={handleOtpChange}
                    placeholder="0000" autoComplete="one-time-code"
                    disabled={!isMobileValid || busy}
                  />
                </div>

                <button type="button" className="ga-main-cta ga-arrow-cta"
                  disabled={!isMobileValid || !isOtpValid || busy} onClick={proceedToSecureId}
                  aria-label="Continue">
                  <span className="ga-arrow-track">
                    <span className="ga-arrow-thumb">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </span>
                  </span>
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="ga-step-view ga-step-enter">
                <h1 className="ga-heading">
                  <span className="ga-heading-icon">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      <circle cx="12" cy="16" r="1.5" fill="#4361ee" />
                    </svg>
                  </span>
                  Choose 
                  <br />
                  <strong>Symbolic ID</strong>
                </h1>

                {/* Secure ID box */}
                <div
                  className={`ga-id-box ${activeField === 'secure' ? 'ga-id-box-active' : ''}`}
                  onClick={() => setActiveField('secure')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveField('secure'); }}
                  role="button" tabIndex={0}
                >
                  <div className="ga-id-top">
                    <span>12-Symbol Secure ID</span>
                    <small>{secureSymbols.length} / 12</small>
                  </div>
                  <ColorSymbolSlots
                    symbols={secureSymbols}
                    shouldHide={hideSecure}
                    isComplete={secureSymbols.length === 12}
                    onDelete={deleteLastSecureSymbol}
                    isBusy={busy}
                  />
                </div>

                {/* Referral ID box */}
                <div
                  className={`ga-id-box ${activeField === 'referrer' ? 'ga-id-box-active' : ''}`}
                  onClick={() => setActiveField('referrer')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveField('referrer'); }}
                  role="button" tabIndex={0}
                  style={{ marginTop: '10px' }}
                >
                  <div className="ga-id-top">
                    <span>Referral ID</span>
                    <small>{referrerSymbols.length} / 12 optional</small>
                  </div>
                  <ColorSymbolSlots
                    symbols={referrerSymbols}
                    shouldHide={hideReferrer}
                    isComplete={referrerSymbols.length === 12}
                    onDelete={deleteLastReferralSymbol}
                    isBusy={busy}
                  />
                </div>

                <div className="ga-editing-row">
                  <span>Editing: {currentFieldLabel}</span>
                  <button type="button" onClick={handleClear} disabled={busy}>Clear</button>
                </div>

                <div className="ga-dial" aria-label="Symbol dialpad">
                  {SYMBOL_KEYS.map((symbol, index) => (
                    <button key={symbol} type="button"
                      className={`ga-dial-key ga-dial-key-${index}`}
                      onClick={() => handleSymbolPress(symbol)}
                      disabled={busy || activeSymbols.length >= 12}>
                      {symbol}
                    </button>
                  ))}
                  <button type="button"
                    className={`ga-dial-center ga-dial-eye ${currentFieldIsHidden ? 'ga-eye-closed' : 'ga-eye-open'}`}
                    onClick={handleToggleVisibility} disabled={busy}
                    aria-label={eyeButtonLabel} title={eyeButtonLabel}>
                    {currentFieldIsHidden ? <ClosedEyeIcon /> : <OpenEyeIcon />}
                  </button>
                </div>

                <button type="button" className="ga-main-cta" disabled={!canSubmit} onClick={handleSubmit}>
                  {busy ? 'Please wait...' : 'Register & Continue'}
                </button>

                <button type="button" className="ga-back-btn"
                  onClick={() => { setStep(1); setStatus(''); }} disabled={busy}>
                  {'\u2190'} Back
                </button>
              </div>
            )}

            {status && <p className="ga-status">{status}</p>}

            <div className="ga-footer">
              <span className={`static-footer-master-heart ${isBeating ? 'beating' : ''}`}>
                ❤️
                {hearts.map((h) => (
                  <span key={h.id} className="ga-automatic-colored-heart" style={{ '--drift-x': h.randomX }}>
                    {h.color}
                  </span>
                ))}
              </span>{' '}
              from भारत
            </div>
          </>
        )}
      </div>
    </div>
  );
}