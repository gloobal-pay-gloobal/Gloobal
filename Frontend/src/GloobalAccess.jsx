import React, { useMemo, useState } from 'react';
import axios from 'axios';
import './GloobalAccess.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gloobal-pay.onrender.com';

const SYMBOL_KEYS = ['+', '-', '\u00D7', '=', '\u25A1', '\u25A0', '\u25CB', '\u25CF'];
const PROTOTYPE_OTP = '0000';

function formatMobileIdentity(digits) {
  if (!digits) return '';

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

function OpenEyeIcon() {
  return (
    <svg
      className="ga-eye-svg ga-eye-svg-open"
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.8 12s3.8-7 10.2-7 10.2 7 10.2 7-3.8 7-10.2 7-10.2-7-10.2-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ClosedEyeIcon() {
  return (
    <svg
      className="ga-eye-svg ga-eye-svg-closed"
      width="34"
      height="34"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 30C19 44 45 44 56 30" />
      <path d="M16 38L10 46" />
      <path d="M28 43L27 52" />
      <path d="M40 43L41 52" />
      <path d="M50 38L56 46" />
    </svg>
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

  const mobileDigits = mobile.replace(/\D/g, '');

  const mobileIdentity = useMemo(() => {
    return formatMobileIdentity(mobileDigits);
  }, [mobileDigits]);

  const secureId = secureSymbols.join('');
  const referredBy = referrerSymbols.join('');

  const isMobileValid = mobileDigits.length >= 10 && mobileDigits.length <= 15;
  const isOtpValid = otp === PROTOTYPE_OTP;

  const currentFieldIsSecure = activeField === 'secure';
  const activeSymbols = currentFieldIsSecure ? secureSymbols : referrerSymbols;
  const currentFieldIsHidden = currentFieldIsSecure ? hideSecure : hideReferrer;
  const currentFieldLabel = currentFieldIsSecure ? 'Secure ID' : 'Referral ID';

  const eyeButtonLabel = currentFieldIsHidden
    ? `Show ${currentFieldLabel}`
    : `Hide ${currentFieldLabel}`;

  const updateActiveSymbols = (nextSymbols) => {
    if (currentFieldIsSecure) {
      setSecureSymbols(nextSymbols);
      return;
    }

    setReferrerSymbols(nextSymbols);
  };

  const handleSymbolPress = (symbol) => {
    if (busy) return;

    if (activeSymbols.length >= 12) {
      setStatus(
        currentFieldIsSecure
          ? 'Secure ID already has 12 symbols.'
          : 'Referral ID already has 12 symbols.'
      );
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

    if (activeField === 'secure') {
      setHideSecure((currentValue) => !currentValue);
    }

    if (activeField === 'referrer') {
      setHideReferrer((currentValue) => !currentValue);
    }

    setStatus('');
  };

  const handleMobileChange = (event) => {
    const nextMobile = event.target.value;
    const nextDigits = nextMobile.replace(/\D/g, '');
    const nextMobileValid = nextDigits.length >= 10 && nextDigits.length <= 15;

    setMobile(nextMobile);
    setStatus('');

    if (!nextMobileValid && otp) {
      setOtp('');
    }
  };

  const handleOtpChange = (event) => {
    const nextOtp = event.target.value.replace(/\D/g, '').slice(0, 4);

    setOtp(nextOtp);
    setStatus('');
  };

  const proceedToSecureId = () => {
    if (!isMobileValid) {
      setStatus('Please enter a valid mobile number.');
      return;
    }

    if (!isOtpValid) {
      setStatus('Enter OTP 0000 to verify mobile.');
      return;
    }

    setStatus('');
    setStep(2);
  };

  const deleteLastSecureSymbol = (event) => {
    event.stopPropagation();

    if (busy || secureSymbols.length === 0) return;

    setSecureSymbols((currentSymbols) => currentSymbols.slice(0, -1));
    setStatus('');
  };

  const deleteLastReferralSymbol = (event) => {
    event.stopPropagation();

    if (busy || referrerSymbols.length === 0) return;

    setReferrerSymbols((currentSymbols) => currentSymbols.slice(0, -1));
    setStatus('');
  };

  const handleSubmit = async () => {
    if (secureSymbols.length !== 12) {
      alert('Please complete all 12 symbols for Secure ID.');
      return;
    }

    if (referrerSymbols.length > 0 && referrerSymbols.length !== 12) {
      alert('Referral ID is optional, but if entered it must be 12 symbols.');
      return;
    }

    const userData = {
      fullName: mobileIdentity,
      symbolId: secureId,
      referredBy: referredBy || ''
    };

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

      setTimeout(() => {
        if (typeof onComplete === 'function') {
          onComplete(nextUser);
        }
      }, 1200);
    } catch (err) {
      console.error('Registration saving error:', err);

      const message =
        err.response?.data?.message ||
        'Could not connect to server. Please try again.';

      setStatus(message);
      alert(message);
    } finally {
      setBusy(false);
    }
  };

  const renderSymbolSlots = (symbols, shouldHide = false) => {
    const slots = [];

    for (let i = 0; i < 12; i += 1) {
      slots.push(
        <span
          key={`slot-${i}`}
          className={i < symbols.length ? 'ga-slot ga-slot-filled' : 'ga-slot ga-slot-empty'}
        >
          {i < symbols.length ? (shouldHide ? '\u2022' : symbols[i]) : '\u00B7'}
        </span>
      );

      if (i === 5) {
        slots.push(<span key="divider" className="ga-slot-divider" />);
      }
    }

    return slots;
  };

  const canSubmit = isMobileValid && isOtpValid && secureSymbols.length === 12 && !busy;

  return (
    <div className="ga-wrapper">
      <div className="ga-shell">
        {registeredUser ? (
          <div className="ga-success">
            <div className="ga-step-bar">
              <div className="ga-segment ga-done" />
              <div className="ga-segment ga-done" />
            </div>

            <div className="ga-success-orb">{'\u2713'}</div>

            <h1 className="ga-heading">
              Mobile identity
              <br />
              <strong>connected</strong>
            </h1>

            <div className="ga-summary-card">
              <span>Mobile</span>
              <strong>{registeredUser.mobileNumber || registeredUser.fullName}</strong>
            </div>

            <div className="ga-summary-card">
              <span>Secure ID</span>
              <strong>{registeredUser.symbolId}</strong>
            </div>

            {registeredUser.referredBy && (
              <div className="ga-summary-card">
                <span>Referral ID</span>
                <strong>{registeredUser.referredBy}</strong>
              </div>
            )}

            <p className="ga-status">
              Preparing device authentication...
            </p>
          </div>
        ) : (
          <>
            <div className="ga-step-bar">
              <div className={`ga-segment ${step >= 1 ? 'ga-active' : ''} ${step > 1 ? 'ga-done' : ''}`} />
              <div className={`ga-segment ${step >= 2 ? 'ga-active' : ''}`} />
            </div>

            <div className="ga-brand">
              <div className="ga-logo-circle" aria-label="Gloobal logo">
                <img
                  src="/pwa-512x512.jpeg"
                  alt="Gloobal logo"
                  className="ga-logo-img"
                />
              </div>

              <div className="ga-brand-text">Gloobal Access</div>
            </div>

            {step === 1 && (
              <div className="ga-step-view ga-step-enter">
                <h1 className="ga-heading">
                  Enter your
                  <br />
                  <strong>mobile number</strong>
                </h1>

                <div className="ga-field-block">
                  <label className="ga-label" htmlFor="mobileInput">
                    Mobile Number
                  </label>

                  <input
                    id="mobileInput"
                    type="tel"
                    inputMode="tel"
                    className="ga-input"
                    value={mobile}
                    onChange={handleMobileChange}
                    placeholder="e.g. 9876543210"
                    autoComplete="tel"
                    disabled={busy}
                  />
                </div>

                <div className="ga-field-block">
                  <label className="ga-label" htmlFor="otpInput">
                    OTP Code
                  </label>

                  <input
                    id="otpInput"
                    type="tel"
                    inputMode="numeric"
                    className="ga-input"
                    value={otp}
                    onChange={handleOtpChange}
                    placeholder="0000"
                    autoComplete="one-time-code"
                    disabled={!isMobileValid || busy}
                  />
                </div>

                <button
                  type="button"
                  className="ga-main-cta"
                  disabled={!isMobileValid || !isOtpValid || busy}
                  onClick={proceedToSecureId}
                >
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="ga-step-view ga-step-enter">
                <h1 className="ga-heading">
                  Create your
                  <br />
                  <strong>Symbol ID</strong>
                </h1>

                <div className="ga-id-grid">
                  <div
                    className={`ga-id-box ${activeField === 'secure' ? 'ga-id-box-active' : ''}`}
                    onClick={() => setActiveField('secure')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        setActiveField('secure');
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="ga-id-top">
                      <span>12-Symbol Secure ID</span>
                      <small>{secureSymbols.length} / 12</small>
                    </div>

                    <div className="ga-slots">
                      {renderSymbolSlots(secureSymbols, hideSecure)}
                    </div>

                    <button
                      type="button"
                      className="ga-mini-action ga-mini-delete"
                      onClick={deleteLastSecureSymbol}
                      disabled={busy || secureSymbols.length === 0}
                      aria-label="Delete last Secure ID symbol"
                      title="Delete last Secure ID symbol"
                    >
                      {'\u232B'}
                    </button>
                  </div>

                  <div
                    className={`ga-id-box ${activeField === 'referrer' ? 'ga-id-box-active' : ''}`}
                    onClick={() => setActiveField('referrer')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        setActiveField('referrer');
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="ga-id-top">
                      <span>Referral ID</span>
                      <small>{referrerSymbols.length} / 12 optional</small>
                    </div>

                    <div className="ga-slots">
                      {renderSymbolSlots(referrerSymbols, hideReferrer)}
                    </div>

                    <button
                      type="button"
                      className="ga-mini-action ga-mini-delete"
                      onClick={deleteLastReferralSymbol}
                      disabled={busy || referrerSymbols.length === 0}
                      aria-label="Delete last Referral ID symbol"
                      title="Delete last Referral ID symbol"
                    >
                      {'\u232B'}
                    </button>
                  </div>
                </div>

                <div className="ga-editing-row">
                  <span>
                    Editing: {currentFieldLabel}
                  </span>

                  <button type="button" onClick={handleClear} disabled={busy}>
                    Clear
                  </button>
                </div>

                <div className="ga-dial" aria-label="Symbol dialpad">
                  {SYMBOL_KEYS.map((symbol, index) => (
                    <button
                      key={symbol}
                      type="button"
                      className={`ga-dial-key ga-dial-key-${index}`}
                      onClick={() => handleSymbolPress(symbol)}
                      disabled={busy || activeSymbols.length >= 12}
                    >
                      {symbol}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={`ga-dial-center ga-dial-eye ${currentFieldIsHidden ? 'ga-eye-closed' : 'ga-eye-open'}`}
                    onClick={handleToggleVisibility}
                    disabled={busy}
                    aria-label={eyeButtonLabel}
                    title={eyeButtonLabel}
                  >
                    {currentFieldIsHidden ? <ClosedEyeIcon /> : <OpenEyeIcon />}
                  </button>
                </div>

                <button
                  type="button"
                  className="ga-main-cta"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                >
                  {busy ? 'Please wait...' : 'Register & Continue'}
                </button>

                <button
                  type="button"
                  className="ga-back-btn"
                  onClick={() => {
                    setStep(1);
                    setStatus('');
                  }}
                  disabled={busy}
                >
                  {'\u2190'} Back
                </button>
              </div>
            )}

            {status && (
              <p className="ga-status">
                {status}
              </p>
            )}

            <div className="ga-footer">
              {'\u2764\uFE0F'} from {'\u092D\u093E\u0930\u0924'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}