import React, { useState } from 'react';
import axios from 'axios';
import { startAuthentication } from '@simplewebauthn/browser';

export default function GloobalAuth({ onAuthenticated }) {
  const [authMethod, setAuthMethod] = useState(null); 
  const [loginId, setLoginId] = useState(""); 
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("");

  // Handle PIN entry
  const handlePinPress = (num) => {
    if (!loginId) {
      setStatus("❌ Please enter your 12-Symbol Secure ID first.");
      return;
    }

    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  // Connect to Live Production Backend for PIN verification
  const verifyPin = async (enteredPin) => {
    setStatus("Verifying PIN with secure node...");
    try {
      // 🟢 PRODUCTION API LINK 
      const response = await axios.post('https://api.gloobal.in/api/login', {
        secureId: loginId,
        pin: enteredPin
      }, { withCredentials: true });

      if (response.status === 200) {
        setStatus(`✅ Access Granted! Welcome back, ${response.data.documentedName}`);
        setTimeout(onAuthenticated, 1000);
      }
    } catch (error) {
      console.error("Backend response error:", error.response?.data);
      setStatus(`❌ ${error.response?.data?.error || "Authentication failed."}`);
      setPin(""); 
    }
  };

  // Connect to Live Production Backend & Hardware for WebAuthn
  const handleBiometricLogin = async (methodName) => {
    if (!loginId) {
      setStatus("❌ Please enter your 12-Symbol Secure ID first.");
      return;
    }

    setAuthMethod('Biometric');
    setStatus(`Waking up ${methodName} hardware...`);
    
    try {
      // 1. Get cryptographic challenge from LIVE backend
      // 🟢 PRODUCTION API LINK 
      const optionsResp = await axios.post('https://api.gloobal.in/api/generate-auth-options', {
        secureId: loginId
      }, { withCredentials: true });
      
      setStatus("Please scan your biometrics...");

      // 2. Trigger native Windows Hello / TouchID / FaceID
      const hardwareResponse = await startAuthentication(optionsResp.data);

      setStatus("Verifying hardware signature...");

      // 3. Send signature to LIVE backend to unlock the node
      // 🟢 PRODUCTION API LINK 
      const verificationResp = await axios.post('https://api.gloobal.in/api/verify-auth', {
        secureId: loginId,
        hardwareResponse: hardwareResponse
      }, { withCredentials: true });

      if (verificationResp.data.verified) {
        setStatus("✅ Hardware Identity Verified!");
        setTimeout(onAuthenticated, 1000);
      } else {
        setStatus("❌ Hardware verification failed.");
        setTimeout(() => { setAuthMethod(null); setStatus(""); }, 2000);
      }

    } catch (error) {
      console.error("Biometric error:", error);
      setStatus("❌ Biometric scan canceled or failed.");
      setTimeout(() => { setAuthMethod(null); setStatus(""); }, 3000);
    }
  };

  return (
    <div style={{ padding: '30px', maxWidth: '400px', margin: '60px auto', fontFamily: 'sans-serif', background: '#fff', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
      
      <h2 style={{ color: '#0f172a', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '2px' }}>Secure Login</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '25px' }}>Enter your Secure ID to access the node.</p>

      {/* NODE ID INPUT */}
      {!authMethod && (
        <div style={{ marginBottom: '25px' }}>
          <input 
            type="text" 
            value={loginId} 
            onChange={e => setLoginId(e.target.value)} 
            placeholder="Enter 12-Symbol Secure ID" 
            style={{ width: '100%', padding: '16px', border: '2px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', color: '#0f172a', fontSize: '18px', textAlign: 'center', letterSpacing: '2px', backgroundColor: '#f8fafc', fontWeight: 'bold' }} 
          />
        </div>
      )}

      {/* METHOD SELECTION MENU */}
      {!authMethod && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <button 
            onClick={() => handleBiometricLogin('Face Recognition')}
            style={{ padding: '20px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <span style={{ fontSize: '24px' }}>👤</span> Face Recognition
          </button>
          
          <button 
            onClick={() => handleBiometricLogin('Fingerprint')}
            style={{ padding: '20px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <span style={{ fontSize: '24px' }}>👆</span> Fingerprint Scan
          </button>

          <button 
            onClick={() => setAuthMethod('pin')}
            style={{ padding: '20px', background: '#2563eb', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <span style={{ fontSize: '24px' }}>🔢</span> Enter 4-Digit PIN
          </button>
        </div>
      )}

      {/* BIOMETRIC SCANNING VIEW */}
      {authMethod === 'Biometric' && (
        <div style={{ padding: '20px 0' }}>
          <div style={{ fontSize: '60px', margin: '20px 0', animation: 'pulse 1.5s infinite' }}>
            🔒
          </div>
          <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{status}</p>
        </div>
      )}

      {/* PIN PAD VIEW */}
      {authMethod === 'pin' && (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b', marginBottom: '10px' }}>
            ID: {loginId}
          </div>
          
          {/* PIN Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', margin: '10px 0 25px 0' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ width: '20px', height: '20px', borderRadius: '50%', background: i < pin.length ? '#2563eb' : '#e2e8f0' }} />
            ))}
          </div>

          {/* Number Pad Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', maxWidth: '250px', margin: '0 auto' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button 
                key={num} 
                onClick={() => handlePinPress(num.toString())}
                style={{ padding: '15px', fontSize: '24px', fontWeight: 'bold', color: '#0f172a', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '50%', cursor: 'pointer' }}
              >
                {num}
              </button>
            ))}
            <button onClick={() => { setAuthMethod(null); setPin(""); setStatus(""); }} style={{ padding: '15px', fontSize: '14px', fontWeight: 'bold', color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer' }}>Back</button>
            <button onClick={() => handlePinPress('0')} style={{ padding: '15px', fontSize: '24px', fontWeight: 'bold', color: '#0f172a', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '50%', cursor: 'pointer' }}>0</button>
            <button onClick={() => setPin(pin.slice(0, -1))} style={{ padding: '15px', fontSize: '24px', fontWeight: 'bold', color: '#0f172a', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '50%', cursor: 'pointer' }}>⌫</button>
          </div>

        </div>
      )}
      
      {status && authMethod !== 'Biometric' && (
        <p style={{ marginTop: '20px', fontWeight: 'bold', color: status.includes('❌') ? '#ef4444' : '#0f172a', minHeight: '24px' }}>
          {status}
        </p>
      )}

    </div>
  );
}