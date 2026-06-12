import React, { useState } from 'react';
import { ethers } from 'ethers';
import contractData from './contracts/GloobalReferral.json';
import axios from 'axios';
const CONTRACT_ADDRESS = "0x937Be82736b0DAbC106dAA6A3D49567FFeED8065";

export default function GloobalRegistration() {
  const [documentedName, setDocumentedName] = useState("");
  const [secureId, setSecureId] = useState("");
  const [referrer, setReferrer] = useState("");
  const [status, setStatus] = useState("");
  
  const [showSymbols, setShowSymbols] = useState(false);

  // The 8 unique symbols from your drawing
  const uniqueSymbols = ['+', '-', '×', '=', '□', '■', '○', '●'];

  const handleKeyPress = (symbol) => {
    if (secureId.length < 12) setSecureId(prev => prev + symbol);
  };

  const handleUndo = () => setSecureId(prev => prev.slice(0, -1));
  const handleClear = () => setSecureId("");

 const handleRegister = async () => {
  if (secureId.length !== 12) {
    alert("Secure ID must be exactly 12 symbols.");
    return;
  }

  try {
    // 1. Save data to your secure Web2 Database
    const response = await axios.post('https://gloobal-pay.onrender.com/api/register', {
      secureId: secureId,
      documentedName: "Test User", // Replace with an input field value if you have one
      pin: "1234",                // The PIN configured during setup
      biometricsEnabled: true
    });

    if (response.status === 201) {
      alert("🎉 Step 1 Complete: Secure Node credentials saved to Database!");
      
      // 2. This is where your Web3 Smart Contract transaction will kick in next!
      console.log("Proceeding to broadcast Secure ID to Sepolia contract...");
    }
  } catch (error) {
    console.error("Registration failed:", error);
    alert(error.response?.data?.error || "Connection to secure database failed.");
  }
};

  const renderSecureId = () => {
    if (secureId.length === 0) return "------------";
    if (showSymbols) return secureId;
    return secureId.replace(/./g, '•'); 
  };

  return (
    <div style={{ padding: '30px', maxWidth: '450px', margin: '40px auto', fontFamily: 'sans-serif', background: '#fff', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
      
      {/* HEADER SECTION */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ color: '#0f172a', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Gloobal Access</h2>
      </div>

      {/* DOCUMENTED NAME - Now using a placeholder inside the box! */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          value={documentedName} 
          onChange={e => setDocumentedName(e.target.value)} 
          placeholder="Documented Name" 
          style={{ width: '100%', padding: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', color: '#0f172a', fontSize: '14px', backgroundColor: '#f8fafc' }} 
        />
      </div>

      {/* 12-SYMBOL SECURE ID WITH EYE ICON */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#64748b', marginBottom: '8px' }}>
          <span>12-Symbol Secure ID</span>
          <span style={{ color: secureId.length === 12 ? '#16a34a' : '#94a3b8' }}>{secureId.length} / 12</span>
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1, fontSize: '26px', letterSpacing: '6px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '8px', height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}>
            {renderSecureId()}
          </div>
          {/* THE EYE ICON TOGGLE */}
          <button 
            onClick={() => setShowSymbols(!showSymbols)}
            style={{ width: '55px', height: '55px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={showSymbols ? "Hide Symbols" : "Show Symbols"}
          >
            {showSymbols ? '👁️' : '🙈'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '25px' }}>
        <input type="text" value={referrer} onChange={e => setReferrer(e.target.value)} placeholder="Referrer Wallet (Optional)" style={{ width: '100%', padding: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', color: '#0f172a', backgroundColor: '#f8fafc' }} />
      </div>

      {/* UNIQUE KEYBOARD GRID */}
      <div style={{ padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '20px' }}>
        
        {/* 4x2 Symbol Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '15px' }}>
          {uniqueSymbols.map(symbol => (
            <button 
              key={symbol} 
              onClick={() => handleKeyPress(symbol)} 
              style={{ padding: '15px 0', fontSize: '26px', fontWeight: 'bold', color: '#0f172a', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            >
              {symbol}
            </button>
          ))}
        </div>

        {/* CONTROLS: Clear, Undo, Equilibrium */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '10px' }}>
          <button onClick={handleClear} style={{ padding: '15px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Clear All">
            ⌫
          </button>
          <button onClick={handleUndo} style={{ padding: '15px', background: '#e2e8f0', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Undo Last">
            Φ
          </button>
          {/* EQUILIBRIUM SIGN */}
          <button 
            onClick={handleRegister} 
            disabled={secureId.length !== 12 || !documentedName} 
            style={{ padding: '15px', background: (secureId.length === 12 && documentedName) ? '#2563eb' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '6px', fontSize: '28px', fontWeight: 'bold', cursor: (secureId.length === 12 && documentedName) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Equilibrium (Register)"
          >
            ⇌
          </button>
        </div>
      </div>

      {status && <div style={{ marginTop: '10px', padding: '12px', borderRadius: '6px', fontSize: '13px', background: '#eff6ff', borderLeft: '4px solid #3b82f6', color: '#1e293b' }}>{status}</div>}

      {/* FOOTER SIGNATURE */}
      <div style={{ textAlign: 'center', marginTop: '30px', color: '#64748b', fontSize: '14px', fontWeight: 'bold' }}>
        ❤️ from भारत 
      </div>

    </div>
  );
}


