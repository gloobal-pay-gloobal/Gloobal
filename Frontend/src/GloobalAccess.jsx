import React, { useState } from 'react';
import axios from 'axios';
import './GloobalAccess.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gloobal-pay.onrender.com';

export default function GloobalAccess({ onComplete }) {
  const [name, setName] = useState('');
  const [secureSymbols, setSecureSymbols] = useState([]);
  const [referrerSymbols, setReferrerSymbols] = useState([]);
  const [activeField, setActiveField] = useState('secure');
  const [isHidden, setIsHidden] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const keys = ['+', '-', '×', '=', '□', '■', '○', '●'];

  const secureId = secureSymbols.join('');
  const referredBy = referrerSymbols.join('');

  const getActiveSymbols = () => {
    return activeField === 'secure' ? secureSymbols : referrerSymbols;
  };

  const setActiveSymbols = (newSymbols) => {
    if (activeField === 'secure') {
      setSecureSymbols(newSymbols);
      return;
    }

    setReferrerSymbols(newSymbols);
  };

  const handleKeyPress = (char) => {
    const currentSymbols = getActiveSymbols();

    if (currentSymbols.length >= 12) {
      setStatus(
        activeField === 'secure'
          ? 'Secure ID already has 12 symbols.'
          : 'Referrer Secure ID already has 12 symbols.'
      );
      return;
    }

    setActiveSymbols([...currentSymbols, char]);
    setStatus('');
  };

  const handleDelete = () => {
    const currentSymbols = getActiveSymbols();
    setActiveSymbols(currentSymbols.slice(0, -1));
    setStatus('');
  };

  const handleClearActive = () => {
    setActiveSymbols([]);
    setStatus('');
  };

  const handleSubmit = async () => {
    const cleanName = name.trim();

    if (!cleanName) {
      alert('Please enter your Documented Name.');
      return;
    }

    if (secureSymbols.length !== 12) {
      alert('Please complete all 12 symbols for Secure ID.');
      return;
    }

    if (referrerSymbols.length > 0 && referrerSymbols.length !== 12) {
      alert('Referrer Secure ID is optional, but if entered it must be 12 symbols.');
      return;
    }

    const userData = {
      fullName: cleanName,
      symbolId: secureId,
      referredBy: referredBy || ''
    };

    setBusy(true);
    setStatus('Checking Secure ID...');

    try {
      const response = await axios.post(API_BASE + '/api/register-symbol', userData);
      const savedUser = response.data?.user || userData;

      const nextUser = {
        fullName: savedUser.fullName || cleanName,
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
      }, 1400);
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

  const renderDisplay = (symbols, hideSymbols = false) => {
    const slots = [];

    for (let i = 0; i < 12; i += 1) {
      if (i < symbols.length) {
        slots.push(
          <span key={i}>
            {hideSymbols ? '*' : symbols[i]}
          </span>
        );
      } else {
        slots.push(
          <span key={i} className="ga-empty-slot">
            -
          </span>
        );
      }
    }

    return slots;
  };

  const activeSymbols = getActiveSymbols();

  return (
    <div className="ga-wrapper">
      <div className="ga-card">
        {registeredUser ? (
          <div className="ga-welcome-view">
            <div className="ga-welcome-avatar">👋</div>

            <h2 className="ga-welcome-name">
              Welcome, {registeredUser.fullName}
            </h2>

            <p className="ga-subtitle">
              @{registeredUser.symbolId}
            </p>

            <div className="ga-welcome-status">
              {registeredUser.hasPasskey
                ? 'Secure ID Found'
                : 'Registration Complete'}
            </div>

            <p className="ga-footer ga-welcome-footer">
              Preparing device authentication...
            </p>
          </div>
        ) : (
          <>
            <div className="ga-brand">
              <div className="ga-logo-circle">
                <img
                  src="/pwa-512x512.jpeg"
                  alt="Gloobal logo"
                  className="ga-logo-img"
                />
              </div>

              <h2 className="ga-title">Gloobal Access</h2>
            </div>

            <input
              type="text"
              className="ga-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setStatus('');
              }}
              placeholder="Documented Name"
              disabled={busy}
            />

            <div>
              <div className="ga-id-header">
                <span>12-Symbol Secure ID</span>
                <span>{secureSymbols.length} / 12</span>
              </div>

              <div
                className={`ga-display-box ${activeField === 'secure' ? 'ga-display-active' : ''}`}
                onClick={() => {
                  setActiveField('secure');
                  setShowKeyboard(true);
                }}
                onKeyDown={() => {
                  setActiveField('secure');
                  setShowKeyboard(true);
                }}
                role="button"
                tabIndex={0}
              >
                <div className="ga-symbols">
                  {renderDisplay(secureSymbols, isHidden)}
                </div>

                <button
                  type="button"
                  className="ga-hide-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsHidden(!isHidden);
                  }}
                  disabled={busy}
                >
                  {isHidden ? 'Show' : 'Hide'}
                </button>
              </div>

              {!showKeyboard && (
                <p className="ga-keyboard-hint">
                  Tap Secure ID box to open symbolic keyboard
                </p>
              )}
            </div>

            <div>
              <div className="ga-id-header">
                <span>Referrer Secure ID</span>
                <span>{referrerSymbols.length} / 12 Optional</span>
              </div>

              <div
                className={`ga-display-box ${activeField === 'referrer' ? 'ga-display-active' : ''}`}
                onClick={() => {
                  setActiveField('referrer');
                  setShowKeyboard(true);
                }}
                onKeyDown={() => {
                  setActiveField('referrer');
                  setShowKeyboard(true);
                }}
                role="button"
                tabIndex={0}
              >
                <div className="ga-symbols">
                  {renderDisplay(referrerSymbols, false)}
                </div>

                <button
                  type="button"
                  className="ga-hide-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveField('referrer');
                    setShowKeyboard(true);
                  }}
                  disabled={busy}
                >
                  Add
                </button>
              </div>

              <p className="ga-keyboard-hint">
                Referrer ID uses the same symbolic Secure ID keyboard.
              </p>
            </div>

            {showKeyboard && (
              <div className="ga-keypad-container">
                <div className="ga-id-header">
                  <span>
                    {activeField === 'secure'
                      ? 'Editing Secure ID'
                      : 'Editing Referrer Secure ID'}
                  </span>

                  <span>{activeSymbols.length} / 12</span>
                </div>

                <div className="ga-grid">
                  {keys.map((char) => (
                    <button
                      key={char}
                      type="button"
                      onClick={() => handleKeyPress(char)}
                      className="ga-btn"
                      disabled={busy || activeSymbols.length >= 12}
                    >
                      {char}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleClearActive}
                    className="ga-btn ga-btn-del"
                    disabled={busy}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    className="ga-btn ga-btn-del"
                    disabled={busy}
                  >
                    ⌫
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="ga-btn ga-btn-submit"
                    disabled={busy}
                  >
                    ⇆
                  </button>
                </div>
              </div>
            )}

            {status && (
              <p style={{
                marginTop: '14px',
                color: status.toLowerCase().includes('complete') ||
                  status.toLowerCase().includes('continuing') ||
                  status.toLowerCase().includes('registered')
                  ? '#16a34a'
                  : '#dc2626',
                fontWeight: 700,
                fontSize: '14px',
                lineHeight: 1.5,
                textAlign: 'center'
              }}>
                {status}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy || secureSymbols.length !== 12 || !name.trim()}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '16px',
                padding: '14px',
                marginTop: '16px',
                background: busy || secureSymbols.length !== 12 || !name.trim()
                  ? '#94a3b8'
                  : '#0f172a',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 800,
                cursor: busy || secureSymbols.length !== 12 || !name.trim()
                  ? 'not-allowed'
                  : 'pointer'
              }}
            >
              {busy ? 'Please wait...' : 'Continue'}
            </button>

            <div className="ga-footer">
              <span>❤️</span> from भारत
            </div>
          </>
        )}
      </div>
    </div>
  );
}