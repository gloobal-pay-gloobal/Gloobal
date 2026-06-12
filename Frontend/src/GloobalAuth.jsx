import React, { useState } from 'react';
import axios from 'axios';

export default function GloobalAuth({ symbolId, onSuccess }) {
  const [step, setStep] = useState('id'); // 'id' or 'pin'
  const [enteredSymbols, setEnteredSymbols] = useState([]); 
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("");
  const [isHidden, setIsHidden] = useState(false);

  const symbolKeys = ['+', '-', '×', '=', '□', '■', '○', '●'];

  // Handle Symbol Keypad Press
  const handleSymbolPress = (char) => {
    if (enteredSymbols.length < 12) {
      const newSymbols = [...enteredSymbols, char];
      setEnteredSymbols(newSymbols);
      if (newSymbols.length === 12) {
        setStatus("ID Complete. Tap ⇆ to proceed to PIN.");
      }
    }
  };

  // Handle Numeric Keypad Press
  const handlePinPress = (num) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        verifyCredentials(newPin);
      }
    }
  };

  // Backspace Logic
  const handleBackspace = () => {
    if (step === 'id') {
      setEnteredSymbols(enteredSymbols.slice(0, -1));
      setStatus("");
    } else {
      setPin(pin.slice(0, -1));
      setStatus("");
    }
  };

  // Final Verification with Local Server (WITH DEVELOPMENT BYPASS)
  const verifyCredentials = async (completedPin) => {
    setStatus("Verifying security matrix...");
    try {
      // 1. Try to talk to your local backend server
      const response = await axios.post('https://gloobal-pay.onrender.com/api/login', {
        secureId: enteredSymbols.join(''),
        pin: completedPin
      });

      if (response.status === 200) {
        setStatus(`✅ Access Granted! Welcome back, ${response.data.documentedName}`);
        setTimeout(onSuccess, 1200);
      }
    } catch (error) {
      console.error("Database connection issue:", error);
      
      // ➔ DEVELOPMENT BYPASS: If the server is offline or the ID isn't found, 
      // we print a warning but STILL let you see your dashboard!
      setStatus("⚠️ Database offline. Bypassing login for testing...");
      
      setTimeout(() => {
        onSuccess(); // This forces App.jsx to load your Dashboard!
      }, 1500);
    }
  };

  // Layout rendering helpers
  const renderSymbolSlots = () => {
    const slots = [];
    for (let i = 0; i < 12; i++) {
      if (i < enteredSymbols.length) {
        slots.push(isHidden ? '*' : enteredSymbols[i]);
      } else {
        slots.push('+');
      }
    }
    return slots.join('');
  };

  // Common Button Style from your screenshot (Fixed Syntax)
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

  return (
    <div style={{ padding: '30px', maxWidth: '400px', margin: '60px auto', fontFamily: 'sans-serif', background: '#fff', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
      
      <h2 style={{ color: '#0f172a', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '22px', fontWeight: '700' }}>
        Secure Login
      </h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '25px' }}>
        {step === 'id' ? 'Enter your Secure ID to access the node.' : 'Enter your 4-Digit PIN to unlock.'}
      </p>

      {/* --- DISPLAY SECTION --- */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#334155', letterSpacing: '1px' }}>
          ID: {renderSymbolSlots()}
        </div>
        
        {/* Toggle View Button for symbols */}
        {step === 'id' && enteredSymbols.length > 0 && (
          <button onClick={() => setIsHidden(!isHidden)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}>
            {isHidden ? '🙈 Show' : '🐵 Hide'}
          </button>
        )}
      </div>

      {/* --- PIN DOTS (Only shows up during Step 2) --- */}
      {step === 'pin' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', margin: '20px 0 30px 0' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ width: '16px', height: '16px', borderRadius: '50%', background: i < pin.length ? '#1e3a8a' : '#cbd5e1' }} />
          ))}
        </div>
      )}

      {/* --- KEYPAD GRID CONTAINER --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px', maxWidth: '260px', margin: '0 auto' }}>
        
        {/* VIEW A: Custom Symbol Keyboard (Step 1) */}
        {step === 'id' && (
          <>
            {symbolKeys.map((char) => (
              <button key={char} onClick={() => handleSymbolPress(char)} style={roundBtnStyle}>
                {char}
              </button>
            ))}
            <button onClick={() => handleSymbolPress('Φ')} style={roundBtnStyle}>Φ</button>
            
            {/* Back/Reset Option */}
            <button onClick={() => setEnteredSymbols([])} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>
              Clear
            </button>
            <button onClick={handleBackspace} style={roundBtnStyle}>⌫</button>
            
            {/* Submit Arrow to move to PIN entry */}
            <button 
              onClick={() => enteredSymbols.length === 12 ? setStep('pin') : alert('Please enter all 12 symbols')} 
              style={{ ...roundBtnStyle, gridColumn: 'span 3', width: '100%', borderRadius: '12px', height: '50px', marginTop: '10px', background: '#0f172a', color: '#fff' }}
            >
              Proceed to PIN ⇆
            </button>
          </>
        )}

        {/* VIEW B: Exact Numeric Keypad from your image (Step 2) */}
        {step === 'pin' && (
          <>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button key={num} onClick={() => handlePinPress(num.toString())} style={roundBtnStyle}>
                {num}
              </button>
            ))}
            
            {/* Back Button to return to symbol tuning */}
            <button 
              onClick={() => { setStep('id'); setPin(""); setStatus(""); }} 
              style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}
            >
              Back
            </button>
            
            <button onClick={() => handlePinPress('0')} style={roundBtnStyle}>0</button>
            
            <button onClick={handleBackspace} style={roundBtnStyle}>
              ☒
            </button>
          </>
        )}
      </div>
      
      {/* --- STATUS MESSAGE FOOTER --- */}
      {status && (
        <p style={{ marginTop: '25px', fontWeight: 'bold', color: status.includes('❌') ? '#ef4444' : (status.includes('⚠️') ? '#d97706' : '#10b981'), fontSize: '15px' }}>
          {status}
        </p>
      )}

    </div>
  );
}


