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
      setTimeout(() => { setPin(''); setStatus(''); setStep('pin'); }, 250);
    }
  };

  const handlePinPress = (number) => {
    if (pin.length >= 4) return;
    const nextPin = pin + number;
    setPin(nextPin);
    setStatus('');
    if (nextPin.length === 4) verifyCredentials(nextPin);
  };

  const handleBackspace = () => {
    if (step === 'id') { setEnteredSymbols(enteredSymbols.slice(0, -1)); setStatus(''); return; }
    setPin(pin.slice(0, -1));
    setStatus('');
  };

  const clearSecureId = () => { setEnteredSymbols([]); setPin(''); setStatus(''); setStep('id'); };

  const goToPin = () => {
    if (enteredSymbols.length !== 12) { setStatus('Please enter all 12 symbols.'); return; }
    setPin(''); setStatus(''); setStep('pin');
  };

  const goBackToId = () => { setPin(''); setStatus(''); setStep('id'); };

  const verifyCredentials = async (completedPin) => {
    setStatus('Verifying...');
    try {
      const response = await axios.post(`${API_BASE}/api/login`, {
        symbolId: secureId,
        secureId,
        pin: completedPin
      });

      if (response.status === 200) {
        const user = response.data?.user || { fullName: 'User', symbolId: secureId };
        setStatus('Access granted.');
        setTimeout(() => { if (typeof onSuccess === 'function') onSuccess(user); }, 800);
      }
    } catch (error) {
      console.error('Login failed:', error);

      const message = error.response?.data?.message || '';
      const lowerMessage = message.toLowerCase();

      const shouldSetPin =
        lowerMessage.includes('pin is not set') ||
        lowerMessage.includes('set your pin') ||
        error.response?.status === 404;

      if (!shouldSetPin) {
        setStatus(message || 'Login failed. Please check Secure ID and PIN.');
        setPin('');
        return;
      }

      setStatus('Setting PIN for this Secure ID...');

      try {
        await axios.post(`${API_BASE}/api/pin/set`, {
          symbolId: secureId,
          secureId,
          pin: completedPin
        });

        const user = { fullName: 'User', symbolId: secureId, hasPasskey: false };
        setStatus('PIN set successfully. Continuing...');
        setTimeout(() => { if (typeof onSuccess === 'function') onSuccess(user); }, 800);
      } catch (pinError) {
        console.error('PIN setup failed:', pinError);
        setStatus(pinError.response?.data?.message || 'Could not set PIN. Please try again.');
        setPin('');
      }
    }
  };

  const renderSymbolSlots = () => {
    const slots = [];
    for (let i = 0; i < 12; i += 1) {
      slots.push(
        <span key={`slot-${i}`} className={i < enteredSymbols.length ? 'auth-slot auth-slot-filled' : 'auth-slot auth-slot-empty'}>
          {i < enteredSymbols.length ? (isHidden ? '\u2022' : enteredSymbols[i]) : '\u00B7'}
        </span>
      );
      if (i === 5) slots.push(<span key="divider" className="auth-slot-divider" />);
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

        {/* Brand/logo REMOVED as requested */}

        <div className="auth-step-view">
          {/* 3D icon + heading */}
          <h1 className="auth-heading">
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 54, height: 54,
              borderRadius: 18,
              background: 'linear-gradient(145deg, #f0f4ff 0%, #dce5ff 60%, #c5d0fa 100%)',
              boxShadow: '4px 4px 10px rgba(67,97,238,0.18), -2px -2px 6px rgba(255,255,255,0.9), inset 0 1px 2px rgba(255,255,255,0.8)',
              margin: '0 auto 10px auto',
            }}>
              {step === 'id' ? (
                /* Safe/vault icon for Secure PIN */
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2" />
                  <path d="M19 4v2M5 4v2" />
                </svg>
              ) : (
                /* Lock/PIN icon for Secure PIN step */
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  <circle cx="12" cy="16" r="1.5" fill="#4361ee" />
                </svg>
              )}
            </span>
            <strong>{step === 'id' ? 'Symbol ID' : 'Secure PIN'}</strong>
          </h1>

          <div className="auth-id-box">
            <div className="auth-id-top">
              <span>Secure ID</span>
              <small>{enteredSymbols.length} / 12</small>
            </div>
            <div className="auth-slots">{renderSymbolSlots()}</div>
            <button type="button" className="auth-mini-action" onClick={() => setIsHidden(!isHidden)}>
              {isHidden ? 'Show' : 'Hide'}
            </button>
          </div>

          {step === 'pin' && (
            <div className="auth-pin-dots" aria-label="PIN progress">
              {[0, 1, 2, 3].map((index) => (
                <span key={index} className={index < pin.length ? 'auth-pin-dot auth-pin-dot-filled' : 'auth-pin-dot'} />
              ))}
            </div>
          )}

          {step === 'id' && (
            <>
              <div className="auth-editing-row">
                <span>Tap 12 symbols</span>
                <button type="button" onClick={clearSecureId}>Clear</button>
              </div>

              <div className="auth-dial" aria-label="Symbol dialpad">
                {SYMBOL_KEYS.map((symbol, index) => (
                  <button key={symbol} type="button"
                    className={`auth-dial-key auth-dial-key-${index}`}
                    onClick={() => handleSymbolPress(symbol)}
                    disabled={enteredSymbols.length >= 12}>
                    {symbol}
                  </button>
                ))}
                <button type="button" className="auth-dial-center" onClick={handleBackspace} aria-label="Delete last symbol">
                  {'\u232B'}
                </button>
              </div>

              <button type="button" className="auth-main-cta" disabled={enteredSymbols.length !== 12} onClick={goToPin}>
                Continue
              </button>
            </>
          )}

          {step === 'pin' && (
            <>
              <div className="auth-pin-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
                  <button key={number} type="button" className="auth-pin-key" onClick={() => handlePinPress(number.toString())}>
                    {number}
                  </button>
                ))}
                <button type="button" className="auth-pin-text" onClick={goBackToId}>Back</button>
                <button type="button" className="auth-pin-key" onClick={() => handlePinPress('0')}>0</button>
                <button type="button" className="auth-pin-key" onClick={handleBackspace}>{'\u232B'}</button>
              </div>
              <p className="auth-prototype-note">Prototype PIN: 1234</p>
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