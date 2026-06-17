import React, { useState } from 'react';
import axios from 'axios';
import './GloobalAuth.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gloobal-pay.onrender.com';

const SYMBOL_KEYS = ['+', '-', '\u00D7', '=', '\u25A1', '\u25A0', '\u25CB', '\u25CF'];

export default function GloobalAuth({ symbolId, onSuccess }) {
  const initialSymbols = symbolId ? Array.from(symbolId).slice(0, 12) : [];

  const [step, setStep] = useState(initialSymbols.length === 12 ? 'pin' : 'id');
  const [enteredSymbols, setEnteredSymbols] = useState(initialSymbols);
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState('');
  const [isHidden, setIsHidden] = useState(true);

  const secureId = enteredSymbols.join('');

  const isErrorStatus =
    status.toLowerCase().includes('failed') ||
    status.toLowerCase().includes('invalid') ||
    status.toLowerCase().includes('not found') ||
    status.toLowerCase().includes('required') ||
    status.toLowerCase().includes('check') ||
    status.toLowerCase().includes('wrong');

  const handleSymbolPress = (symbol) => {
    if (enteredSymbols.length >= 12) {
      setStatus('Secure ID is complete.');
      return;
    }

    const nextSymbols = [...enteredSymbols, symbol];
    setEnteredSymbols(nextSymbols);
    setStatus('');

    if (nextSymbols.length === 12) {
      setTimeout(() => {
        setPin('');
        setStatus('');
        setStep('pin');
      }, 250);
    }
  };

  const handlePinPress = (number) => {
    if (pin.length >= 4) return;

    const nextPin = pin + number;
    setPin(nextPin);
    setStatus('');

    if (nextPin.length === 4) {
      verifyCredentials(nextPin);
    }
  };

  const handleBackspace = () => {
    if (step === 'id') {
      setEnteredSymbols(enteredSymbols.slice(0, -1));
      setStatus('');
      return;
    }

    setPin(pin.slice(0, -1));
    setStatus('');
  };

  const clearSecureId = () => {
    setEnteredSymbols([]);
    setPin('');
    setStatus('');
    setStep('id');
  };

  const goToPin = () => {
    if (enteredSymbols.length !== 12) {
      setStatus('Please enter all 12 symbols.');
      return;
    }

    setPin('');
    setStatus('');
    setStep('pin');
  };

  const goBackToId = () => {
    setPin('');
    setStatus('');
    setStep('id');
  };

  const verifyCredentials = async (completedPin) => {
    setStatus('Verifying...');

    try {
      const response = await axios.post(`${API_BASE}/api/login`, {
        secureId,
        pin: completedPin
      });

      if (response.status === 200) {
        const user = response.data?.user || {
          fullName: 'User',
          symbolId: secureId
        };

        setStatus('Access granted.');

        setTimeout(() => {
          if (typeof onSuccess === 'function') {
            onSuccess(user);
          }
        }, 800);
      }
    } catch (error) {
      console.error('Login failed:', error);

      const message =
        error.response?.data?.message ||
        'Login failed. Please check Secure ID and PIN.';

      setStatus(message);
      setPin('');
    }
  };

  const renderSymbolSlots = () => {
    const slots = [];

    for (let i = 0; i < 12; i += 1) {
      slots.push(
        <span
          key={`slot-${i}`}
          className={i < enteredSymbols.length ? 'auth-slot auth-slot-filled' : 'auth-slot auth-slot-empty'}
        >
          {i < enteredSymbols.length ? (isHidden ? '\u2022' : enteredSymbols[i]) : '\u00B7'}
        </span>
      );

      if (i === 5) {
        slots.push(<span key="divider" className="auth-slot-divider" />);
      }
    }

    return slots;
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-shell">
        <div className="auth-step-bar">
          <div className="auth-segment auth-active" />
          <div className={`auth-segment ${step === 'pin' ? 'auth-active' : ''}`} />
        </div>

        <div className="auth-brand">
          <div className="auth-logo-circle">
            <img
              src="/pwa-512x512.jpeg"
              alt="Gloobal logo"
              className="auth-logo-img"
            />
          </div>

          <div className="auth-brand-text">Gloobal Access</div>
        </div>

        <div className="auth-step-view">
          <div className="auth-eyebrow">
            <span className="auth-eyebrow-dot" />
            {step === 'id' ? 'Secure ID' : 'Secure Login'}
          </div>

          <h1 className="auth-heading">
            {step === 'id' ? (
              <>
                Enter your
                <br />
                <strong>Symbol ID</strong>
              </>
            ) : (
              <>
                Enter your
                <br />
                <strong>secure PIN</strong>
              </>
            )}
          </h1>

          <div className="auth-id-box">
            <div className="auth-id-top">
              <span>Secure ID</span>
              <small>{enteredSymbols.length} / 12</small>
            </div>

            <div className="auth-slots">
              {renderSymbolSlots()}
            </div>

            <button
              type="button"
              className="auth-mini-action"
              onClick={() => setIsHidden(!isHidden)}
            >
              {isHidden ? 'Show' : 'Hide'}
            </button>
          </div>

          {step === 'pin' && (
            <div className="auth-pin-dots" aria-label="PIN progress">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={index < pin.length ? 'auth-pin-dot auth-pin-dot-filled' : 'auth-pin-dot'}
                />
              ))}
            </div>
          )}

          {step === 'id' && (
            <>
              <div className="auth-editing-row">
                <span>Tap 12 symbols</span>

                <button type="button" onClick={clearSecureId}>
                  Clear
                </button>
              </div>

              <div className="auth-dial" aria-label="Symbol dialpad">
                {SYMBOL_KEYS.map((symbol, index) => (
                  <button
                    key={symbol}
                    type="button"
                    className={`auth-dial-key auth-dial-key-${index}`}
                    onClick={() => handleSymbolPress(symbol)}
                    disabled={enteredSymbols.length >= 12}
                  >
                    {symbol}
                  </button>
                ))}

                <button
                  type="button"
                  className="auth-dial-center"
                  onClick={handleBackspace}
                  aria-label="Delete last symbol"
                >
                  {'\u232B'}
                </button>
              </div>

              <button
                type="button"
                className="auth-main-cta"
                disabled={enteredSymbols.length !== 12}
                onClick={goToPin}
              >
                Continue
              </button>
            </>
          )}

          {step === 'pin' && (
            <>
              <div className="auth-pin-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
                  <button
                    key={number}
                    type="button"
                    className="auth-pin-key"
                    onClick={() => handlePinPress(number.toString())}
                  >
                    {number}
                  </button>
                ))}

                <button
                  type="button"
                  className="auth-pin-text"
                  onClick={goBackToId}
                >
                  Back
                </button>

                <button
                  type="button"
                  className="auth-pin-key"
                  onClick={() => handlePinPress('0')}
                >
                  0
                </button>

                <button
                  type="button"
                  className="auth-pin-key"
                  onClick={handleBackspace}
                >
                  {'\u232B'}
                </button>
              </div>

              <p className="auth-prototype-note">
                Prototype PIN: 1234
              </p>
            </>
          )}

          {status && (
            <p className={isErrorStatus ? 'auth-status auth-status-error' : 'auth-status auth-status-good'}>
              {status}
            </p>
          )}

          <div className="auth-footer">
            {'\u2764\uFE0F'} from {'\u092D\u093E\u0930\u0924'}
          </div>
        </div>
      </div>
    </div>
  );
}