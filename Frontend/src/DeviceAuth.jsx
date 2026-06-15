import React, { useState } from 'react';
import axios from 'axios';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gloobal-pay.onrender.com';

export default function DeviceAuth({ symbolId, onSuccess }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const setupDeviceAuth = async () => {
    setBusy(true);
    setStatus('Starting device authentication setup...');

    try {
      const optionsResponse = await axios.post(API_BASE + '/api/passkey/register/options', {
        symbolId
      });

      const registrationResponse = await startRegistration({
        optionsJSON: optionsResponse.data
      });

      const verifyResponse = await axios.post(API_BASE + '/api/passkey/register/verify', {
        symbolId,
        response: registrationResponse
      });

      if (verifyResponse.data?.verified) {
        setStatus('Device authentication enabled.');
        setTimeout(onSuccess, 900);
      } else {
        setStatus(verifyResponse.data?.message || 'Device authentication setup failed.');
      }
    } catch (error) {
      console.error('Device authentication setup failed:', error);
      setStatus(error.response?.data?.message || error.message || 'Device authentication setup failed.');
    } finally {
      setBusy(false);
    }
  };

  const verifyDeviceAuth = async () => {
    setBusy(true);
    setStatus('Requesting device authentication...');

    try {
      const optionsResponse = await axios.post(API_BASE + '/api/passkey/auth/options', {
        symbolId
      });

      const authenticationResponse = await startAuthentication({
        optionsJSON: optionsResponse.data
      });

      const verifyResponse = await axios.post(API_BASE + '/api/passkey/auth/verify', {
        symbolId,
        response: authenticationResponse
      });

      if (verifyResponse.data?.verified) {
        setStatus('Device authentication successful.');
        setTimeout(onSuccess, 700);
      } else {
        setStatus(verifyResponse.data?.message || 'Device authentication failed.');
      }
    } catch (error) {
      console.error('Device authentication failed:', error);
      setStatus(error.response?.data?.message || error.message || 'Device authentication failed.');
    } finally {
      setBusy(false);
    }
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
        maxWidth: '420px',
        background: '#ffffff',
        borderRadius: '26px',
        padding: '28px',
        boxShadow: '0 18px 55px rgba(15,23,42,0.12)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          margin: '0 auto 18px',
          background: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '30px',
          fontWeight: '800'
        }}>
          G
        </div>

        <h2 style={{
          margin: '0 0 8px',
          color: '#0f172a',
          fontSize: '24px'
        }}>
          Device Authentication
        </h2>

        <p style={{
          margin: '0 0 20px',
          color: '#64748b',
          fontSize: '14px',
          lineHeight: 1.6
        }}>
          Use your device security such as fingerprint, face unlock, screen lock, or passkey to protect your Gloobal profile.
        </p>

        <div style={{
          padding: '12px',
          borderRadius: '14px',
          background: '#f8fafc',
          color: '#334155',
          fontSize: '13px',
          marginBottom: '18px',
          wordBreak: 'break-all'
        }}>
          Secure ID: {symbolId}
        </div>

        <button
          type="button"
          onClick={setupDeviceAuth}
          disabled={busy}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: '14px',
            padding: '14px',
            background: '#0f172a',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
            marginBottom: '12px'
          }}
        >
          Set up face / fingerprint
        </button>

        <button
          type="button"
          onClick={verifyDeviceAuth}
          disabled={busy}
          style={{
            width: '100%',
            border: '1px solid #cbd5e1',
            borderRadius: '14px',
            padding: '14px',
            background: '#ffffff',
            color: '#0f172a',
            fontSize: '15px',
            fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer'
          }}
        >
          Verify existing device
        </button>

        {status && (
          <p style={{
            marginTop: '18px',
            color: status.toLowerCase().includes('failed') || status.toLowerCase().includes('not') || status.toLowerCase().includes('could not')
              ? '#dc2626'
              : '#16a34a',
            fontWeight: 700,
            fontSize: '14px',
            lineHeight: 1.5
          }}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
