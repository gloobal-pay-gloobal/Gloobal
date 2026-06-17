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

export default function GloobalAccess({ onComplete }) {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [secureSymbols, setSecureSymbols] = useState([]);
  const [referrerSymbols, setReferrerSymbols] = useState([]);
  const [activeField, setActiveField] = useState('secure');
  const [hideSecure, setHideSecure] = useState(false);
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
  const activeSymbols = activeField === 'secure' ? secureSymbols : referrerSymbols;

  const updateActiveSymbols = (nextSymbols) => {
    if (activeField === 'secure') {
      setSecureSymbols(nextSymbols);
      return;
    }

    setReferrerSymbols(nextSymbols);
  };

  const handleSymbolPress = (symbol) => {
    if (busy) return;

    if (activeSymbols.length >= 12) {
      setStatus(
        activeField === 'secure'
          ? 'Secure ID already has 12 symbols.'
          : 'Referral ID already has 12 symbols.'
      );
      return;
    }

    updateActiveSymbols([...activeSymbols, symbol]);
    setStatus('');
  };

  const handleDelete = () => {
    if (busy) return;
    updateActiveSymbols(activeSymbols.slice(0, -1));
    setStatus('');
  };

  const handleClear = () => {
    if (busy) return;
    updateActiveSymbols([]);
    setStatus('');
  };

  const goToOtp = () => {
    if (!isMobileValid) {
      setStatus('Please enter a valid mobile number.');
      return;
    }

    setOtp('');
    setStatus('');
    setStep(2);
  };

  const verifyOtp = () => {
    if (!isOtpValid) {
      setStatus('Enter OTP 0000 to verify mobile.');
      return;
    }

    setStatus('');
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!isMobileValid) {
      alert('Please enter a valid mobile number.');
      return;
    }

    if (!isOtpValid) {
      alert('Please verify mobile OTP first.');
      setStep(2);
      return;
    }

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
              <div className="ga-segment ga-done" />
            </div>

            <div className="ga-success-orb">{'\u2713'}</div>

            <div className="ga-eyebrow">
              <span className="ga-eyebrow-dot" />
              Ready
            </div>

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
              <div className={`ga-segment ${step >= 2 ? 'ga-active' : ''} ${step > 2 ? 'ga-done' : ''}`} />
              <div className={`ga-segment ${step >= 3 ? 'ga-active' : ''}`} />
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
                <div className="ga-eyebrow">
                  <span className="ga-eyebrow-dot" />
                  Step 1 of 3
                </div>

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
                    onChange={(event) => {
                      setMobile(event.target.value);
                      setStatus('');
                    }}
                    placeholder="e.g. 9876543210"
                    autoComplete="tel"
                    disabled={busy}
                  />
                </div>

                <button
                  type="button"
                  className="ga-main-cta"
                  disabled={!isMobileValid || busy}
                  onClick={goToOtp}
                >
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="ga-step-view ga-step-enter">
                <div className="ga-eyebrow">
                  <span className="ga-eyebrow-dot" />
                  Step 2 of 3
                </div>

                <h1 className="ga-heading">
                  Verify
                  <br />
                  <strong>mobile OTP</strong>
                </h1>

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
                    onChange={(event) => {
                      const nextOtp = event.target.value.replace(/\D/g, '').slice(0, 4);
                      setOtp(nextOtp);
                      setStatus('');
                    }}
                    placeholder="0000"
                    autoComplete="one-time-code"
                    disabled={busy}
                  />
                </div>

                <button
                  type="button"
                  className="ga-main-cta"
                  disabled={otp.length !== 4 || busy}
                  onClick={verifyOtp}
                >
                  Verify OTP
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

            {step === 3 && (
              <div className="ga-step-view ga-step-enter">
                <div className="ga-eyebrow">
                  <span className="ga-eyebrow-dot" />
                  Step 3 of 3
                </div>

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
                      className="ga-mini-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        setHideSecure(!hideSecure);
                      }}
                      disabled={busy}
                    >
                      {hideSecure ? 'Show' : 'Hide'}
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
                      {renderSymbolSlots(referrerSymbols, false)}
                    </div>

                    <button
                      type="button"
                      className="ga-mini-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveField('referrer');
                      }}
                      disabled={busy}
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="ga-editing-row">
                  <span>
                    Editing: {activeField === 'secure' ? 'Secure ID' : 'Referral ID'}
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
                    className="ga-dial-center"
                    onClick={handleDelete}
                    disabled={busy}
                    aria-label="Delete last symbol"
                  >
                    {'\u232B'}
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
                    setStep(2);
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