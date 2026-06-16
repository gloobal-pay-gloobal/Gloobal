import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gloobal-pay.onrender.com';

export default function DeviceAuth({ symbolId, onSuccess }) {
  const [status, setStatus] = useState('Checking device authentication status...');
  const [busy, setBusy] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(null);
  const [profileName, setProfileName] = useState('');

  const cleanSymbolId = String(symbolId || '').trim();

  const checkPasskeyStatus = async () => {
    if (!cleanSymbolId) {
      setStatus('Secure ID is missing.');
      setHasPasskey(false);
      return;
    }

    setBusy(true);
    setStatus('Checking device authentication status...');

    try {
      const response = await axios.post(API_BASE + '/api/passkey/status', {
        symbolId: cleanSymbolId
      });

      const alreadyHasPasskey = Boolean(response.data?.hasPasskey);

      setHasPasskey(alreadyHasPasskey);
      setProfileName(response.data?.user?.fullName || '');

      if (alreadyHasPasskey) {
        setStatus('Device already registered. Verify existing device to continue.');
      } else {
        setStatus('No device registered yet. Set up device authentication once.');
      }
    } catch (error) {
      console.error('Could not check passkey status:', error);

      setStatus(
        error.response?.data?.message ||
        'Could not check device authentication status.'
      );

      setHasPasskey(false);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    checkPasskeyStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanSymbolId]);

  const setupDeviceAuth = async () => {
    setBusy(true);
    setStatus('Starting first-time device authentication setup...');

    try {
      const optionsResponse = await axios.post(API_BASE + '/api/passkey/register/options', {
        symbolId: cleanSymbolId
      });

      const registrationResponse = await startRegistration({
        optionsJSON: optionsResponse.data
      });

      const verifyResponse = await axios.post(API_BASE + '/api/passkey/register/verify', {
        symbolId: cleanSymbolId,
        response: registrationResponse
      });

      if (verifyResponse.data?.verified) {
        setHasPasskey(true);
        setStatus('Device authentication enabled.');
        setTimeout(onSuccess, 900);
      } else {
        setStatus(
          verifyResponse.data?.message ||
          'Device authentication setup failed.'
        );
      }
    } catch (error) {
      console.error('Device authentication setup failed:', error);

      const message =
        error.response?.data?.message ||
        error.message ||
        'Device authentication setup failed.';

      setStatus(message);

      if (
        error.response?.status === 409 ||
        message.toLowerCase().includes('already')
      ) {
        setHasPasskey(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const verifyDeviceAuth = async () => {
    setBusy(true);
    setStatus('Requesting device authentication...');

    try {
      const optionsResponse = await axios.post(API_BASE + '/api/passkey/auth/options', {
        symbolId: cleanSymbolId
      });

      const authenticationResponse = await startAuthentication({
        optionsJSON: optionsResponse.data
      });

      const verifyResponse = await axios.post(API_BASE + '/api/passkey/auth/verify', {
        symbolId: cleanSymbolId,
        response: authenticationResponse
      });

      if (verifyResponse.data?.verified) {
        setStatus('Device authentication successful.');
        setTimeout(onSuccess, 700);
      } else {
        setStatus(
          verifyResponse.data?.message ||
          'Device authentication failed.'
        );
      }
    } catch (error) {
      console.error('Device authentication failed:', error);

      setStatus(
        error.response?.data?.message ||
        error.message ||
        'Device authentication failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const statusLower = status.toLowerCase();

  const isError =
    statusLower.includes('failed') ||
    statusLower.includes('not found') ||
    statusLower.includes('could not') ||
    statusLower.includes('missing') ||
    statusLower.includes('required');

  const primaryButtonStyle = {
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
          Passkey uses this phone/browser security. It may use fingerprint,
          face unlock, screen lock, or device PIN depending on the device.
        </p>

        {profileName && (
          <p style={{
            margin: '0 0 12px',
            color: '#0f172a',
            fontWeight: 800
          }}>
            {profileName}
          </p>
        )}

        <div style={{
          padding: '12px',
          borderRadius: '14px',
          background: '#f8fafc',
          color: '#334155',
          fontSize: '13px',
          marginBottom: '18px',
          wordBreak: 'break-all'
        }}>
          Secure ID: {cleanSymbolId}
        </div>

        {hasPasskey === false && (
          <button
            type="button"
            onClick={setupDeviceAuth}
            disabled={busy}
            style={primaryButtonStyle}
          >
            Set up face / fingerprint
          </button>
        )}

        {hasPasskey === true && (
          <button
            type="button"
            onClick={verifyDeviceAuth}
            disabled={busy}
            style={primaryButtonStyle}
          >
            Verify existing device
          </button>
        )}

        {hasPasskey === null && (
          <button
            type="button"
            disabled
            style={{
              ...primaryButtonStyle,
              background: '#94a3b8',
              cursor: 'not-allowed'
            }}
          >
            Checking device...
          </button>
        )}

        <button
          type="button"
          onClick={checkPasskeyStatus}
          disabled={busy}
          style={{
            width: '100%',
            border: '1px solid #cbd5e1',
            borderRadius: '14px',
            padding: '13px',
            background: '#ffffff',
            color: '#0f172a',
            fontSize: '14px',
            fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer'
          }}
        >
          Refresh status
        </button>

        {status && (
          <p style={{
            marginTop: '18px',
            color: isError ? '#dc2626' : '#16a34a',
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