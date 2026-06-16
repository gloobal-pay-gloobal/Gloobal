import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gloobal-pay.onrender.com';

export default function GloobalAuth({ symbolId, onSuccess }) {
  const initialSymbols = symbolId ? Array.from(symbolId).slice(0, 12) : [];

  const [step, setStep] = useState(initialSymbols.length === 12 ? 'pin' : 'id');
  const [enteredSymbols, setEnteredSymbols] = useState(initialSymbols);
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState('');
  const [isHidden, setIsHidden] = useState(false);

  const symbolKeys = ['+', '-', '×', '=', '□', '■', '○', '●'];

  const secureId = enteredSymbols.join('');

  const handleSymbolPress = (char) => {
    if (enteredSymbols.length >= 12) {
      setStatus('Secure ID is complete. Proceed to PIN.');
      return;
    }

    const newSymbols = [...enteredSymbols, char];
    setEnteredSymbols(newSymbols);

    if (newSymbols.length === 12) {
      setStatus('Secure ID complete. Proceed to PIN.');
    } else {
      setStatus('');
    }
  };

  const handlePinPress = (num) => {
    if (pin.length >= 4) {
      return;
    }

    const newPin = pin + num;
    setPin(newPin);
    setStatus('');

    if (newPin.length === 4) {
      verifyCredentials(newPin);
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

  const verifyCredentials = async (completedPin) => {
    setStatus('Verifying Secure ID and PIN...');

    try {
      const response = await axios.post(API_BASE + '/api/login', {
        secureId,
        pin: completedPin
      });

      if (response.status === 200) {
        const user = response.data?.user || {
          fullName: 'User',
          symbolId: secureId
        };

        setStatus(`Access granted. Welcome back, ${user.fullName || 'User'}.`);

        setTimeout(() => {
          if (typeof onSuccess === 'function') {
            onSuccess(user);
          }
        }, 900);
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

  const renderSymbolSlots = () => {
    const slots = [];

    for (let i = 0; i < 12; i += 1) {
      if (i < enteredSymbols.length) {
        slots.push(isHidden ? '*' : enteredSymbols[i]);
      } else {
        slots.push('·');
      }
    }

    return slots.join(' ');
  };

  const isErrorStatus =
    status.toLowerCase().includes('failed') ||
    status.toLowerCase().includes('invalid') ||
    status.toLowerCase().includes('not found') ||
    status.toLowerCase().includes('required') ||
    status.toLowerCase().includes('check');

  const roundBtnStyle = {
    width: '65px',
    height: '65px',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#0f172a',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    outline: 'none'
  };

  const disabledRoundBtnStyle = {
    ...roundBtnStyle,
    opacity: 0.45,
    cursor: 'not-allowed'
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f5f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 18px 55px rgba(15,23,42,0.12)',
        textAlign: 'center',
        padding: '30px'
      }}>
        <h2 style={{
          color: '#0f172a',
          margin: '0 0 10px 0',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          fontSize: '22px',
          fontWeight: '800'
        }}>
          Secure Login
        </h2>

        <p style={{
          color: '#64748b',
          fontSize: '14px',
          lineHeight: 1.6,
          margin: '0 0 24px'
        }}>
          {step === 'id'
            ? 'Enter your 12-symbol Secure ID.'
            : 'Enter prototype PIN to continue.'}
        </p>

        <div style={{
          marginBottom: '20px',
          padding: '14px',
          borderRadius: '16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            fontSize: '13px',
            color: '#64748b',
            fontWeight: '700',
            marginBottom: '8px'
          }}>
            Secure ID
          </div>

          <div style={{
            fontSize: '17px',
            fontWeight: '800',
            color: '#334155',
            letterSpacing: '1px',
            wordBreak: 'break-all',
            minHeight: '24px'
          }}>
            {renderSymbolSlots()}
          </div>

          {step === 'id' && enteredSymbols.length > 0 && (
            <button
              type="button"
              onClick={() => setIsHidden(!isHidden)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                marginTop: '8px',
                color: '#2563eb',
                fontWeight: '700'
              }}
            >
              {isHidden ? 'Show Secure ID' : 'Hide Secure ID'}
            </button>
          )}
        </div>

        {step === 'pin' && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '15px',
            margin: '20px 0 30px 0'
          }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: i < pin.length ? '#0f172a' : '#cbd5e1'
                }}
              />
            ))}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '18px',
          maxWidth: '260px',
          margin: '0 auto'
        }}>
          {step === 'id' && (
            <>
              {symbolKeys.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => handleSymbolPress(char)}
                  disabled={enteredSymbols.length >= 12}
                  style={enteredSymbols.length >= 12 ? disabledRoundBtnStyle : roundBtnStyle}
                >
                  {char}
                </button>
              ))}

              <button
                type="button"
                onClick={clearSecureId}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                style={roundBtnStyle}
              >
                ⌫
              </button>

              <button
                type="button"
                onClick={goToPin}
                style={{
                  ...roundBtnStyle,
                  gridColumn: 'span 3',
                  width: '100%',
                  borderRadius: '14px',
                  height: '52px',
                  marginTop: '10px',
                  background: enteredSymbols.length === 12 ? '#0f172a' : '#94a3b8',
                  color: '#ffffff',
                  cursor: enteredSymbols.length === 12 ? 'pointer' : 'not-allowed'
                }}
              >
                Proceed to PIN
              </button>
            </>
          )}

          {step === 'pin' && (
            <>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinPress(num.toString())}
                  style={roundBtnStyle}
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                onClick={goBackToId}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => handlePinPress('0')}
                style={roundBtnStyle}
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                style={roundBtnStyle}
              >
                ⌫
              </button>
            </>
          )}
        </div>

        {status && (
          <p style={{
            marginTop: '25px',
            fontWeight: 'bold',
            color: isErrorStatus ? '#dc2626' : '#16a34a',
            fontSize: '15px',
            lineHeight: 1.5
          }}>
            {status}
          </p>
        )}

        {step === 'pin' && (
          <p style={{
            marginTop: '18px',
            color: '#94a3b8',
            fontSize: '12px',
            fontWeight: '700'
          }}>
            Prototype PIN: 1234
          </p>
        )}
      </div>
    </div>
  );
}