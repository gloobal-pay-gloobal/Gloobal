import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import './DeviceAuth.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gloobal-pay.onrender.com';

export default function DeviceAuth({ symbolId, onSuccess }) {
  const [status, setStatus] = useState('Checking device authentication...');
  const [busy, setBusy] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [scanMode, setScanMode] = useState('checking');

  const cleanSymbolId = String(symbolId || '').trim();

  const titleText = useMemo(() => {
    if (hasPasskey === true) return 'Verify existing';
    if (hasPasskey === false) return 'Set up device';
    return 'Checking device';
  }, [hasPasskey]);

  const strongText = useMemo(() => {
    if (hasPasskey === true) return 'authentication';
    if (hasPasskey === false) return 'passkey';
    return 'security';
  }, [hasPasskey]);

  const actionText = useMemo(() => {
    if (busy) return 'Please wait...';
    if (hasPasskey === true) return 'Verify existing device';
    if (hasPasskey === false) return 'Set up face / fingerprint';
    return 'Checking device...';
  }, [busy, hasPasskey]);

  const checkPasskeyStatus = async () => {
    if (!cleanSymbolId) {
      setStatus('Secure ID is missing.');
      setHasPasskey(false);
      setScanMode('error');
      return;
    }

    setBusy(true);
    setScanMode('checking');
    setStatus('Checking device authentication...');

    try {
      const response = await axios.post(`${API_BASE}/api/passkey/status`, {
        symbolId: cleanSymbolId
      });

      const alreadyHasPasskey = Boolean(response.data?.hasPasskey);

      setHasPasskey(alreadyHasPasskey);
      setProfileName(response.data?.user?.fullName || '');
      setScanMode('ready');

      if (alreadyHasPasskey) {
        setStatus('Device is ready for verification.');
      } else {
        setStatus('Set up device authentication once.');
      }
    } catch (error) {
      console.error('Could not check passkey status:', error);

      setStatus(
        error.response?.data?.message ||
        'Could not check device authentication.'
      );

      setHasPasskey(false);
      setScanMode('error');
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
    setScanMode('scanning');
    setStatus('Starting device security prompt...');

    try {
      const optionsResponse = await axios.post(`${API_BASE}/api/passkey/register/options`, {
        symbolId: cleanSymbolId
      });

      const registrationResponse = await startRegistration({
        optionsJSON: optionsResponse.data
      });

      setStatus('Finalizing device authentication...');

      const verifyResponse = await axios.post(`${API_BASE}/api/passkey/register/verify`, {
        symbolId: cleanSymbolId,
        response: registrationResponse
      });

      if (verifyResponse.data?.verified) {
        setHasPasskey(true);
        setScanMode('success');
        setStatus('Device authentication enabled.');

        setTimeout(() => {
          if (typeof onSuccess === 'function') {
            onSuccess();
          }
        }, 900);
      } else {
        setScanMode('ready');
        setStatus(
          verifyResponse.data?.message ||
          'Device authentication setup failed.'
        );
      }
    } catch (error) {
      console.error('Device authentication setup failed:', error);

      const rawMessage =
        error.response?.data?.message ||
        error.message ||
        'Device authentication setup failed.';

      const friendlyMessage =
        rawMessage.toLowerCase().includes('not allowed') ||
        rawMessage.toLowerCase().includes('timed out') ||
        rawMessage.toLowerCase().includes('device')
          ? 'This browser or device cannot create a passkey here. Try live HTTPS or another device.'
          : rawMessage;

      setStatus(friendlyMessage);
      setScanMode('error');

      if (
        error.response?.status === 409 ||
        rawMessage.toLowerCase().includes('already')
      ) {
        setHasPasskey(true);
        setScanMode('ready');
      }
    } finally {
      setBusy(false);
    }
  };

  const verifyDeviceAuth = async () => {
    setBusy(true);
    setScanMode('scanning');
    setStatus('Requesting device authentication...');

    try {
      const optionsResponse = await axios.post(`${API_BASE}/api/passkey/auth/options`, {
        symbolId: cleanSymbolId
      });

      const authenticationResponse = await startAuthentication({
        optionsJSON: optionsResponse.data
      });

      setStatus('Verifying device response...');

      const verifyResponse = await axios.post(`${API_BASE}/api/passkey/auth/verify`, {
        symbolId: cleanSymbolId,
        response: authenticationResponse
      });

      if (verifyResponse.data?.verified) {
        setScanMode('success');
        setStatus('Device authentication successful.');

        setTimeout(() => {
          if (typeof onSuccess === 'function') {
            onSuccess();
          }
        }, 750);
      } else {
        setScanMode('ready');
        setStatus(
          verifyResponse.data?.message ||
          'Device authentication failed.'
        );
      }
    } catch (error) {
      console.error('Device authentication failed:', error);

      const rawMessage =
        error.response?.data?.message ||
        error.message ||
        'Device authentication failed.';

      const friendlyMessage =
        rawMessage.toLowerCase().includes('not allowed') ||
        rawMessage.toLowerCase().includes('timed out') ||
        rawMessage.toLowerCase().includes('device')
          ? 'This browser or device cannot verify passkey here. Try live HTTPS or another device.'
          : rawMessage;

      setStatus(friendlyMessage);
      setScanMode('error');
    } finally {
      setBusy(false);
    }
  };

  const handlePrimaryAction = () => {
    if (busy || hasPasskey === null) return;

    if (hasPasskey) {
      verifyDeviceAuth();
      return;
    }

    setupDeviceAuth();
  };

  return (
    <div className="da-wrapper">
      <div className="da-shell">
        <div className="da-step-bar">
          <div className="da-segment da-done" />
          <div className="da-segment da-done" />
          <div className="da-segment da-done" />
          <div className="da-segment da-active" />
        </div>

        <div className="da-brand">
          <div className="da-logo-circle" aria-label="Gloobal logo">
            <img
              src="/pwa-512x512.jpeg"
              alt="Gloobal logo"
              className="da-logo-img"
            />
          </div>

          <div className="da-brand-text">Gloobal Access</div>
        </div>

        <div className="da-step-view">
          <div className="da-eyebrow">
            <span className="da-eyebrow-dot" />
            Device Authentication
          </div>

          <h1 className="da-heading">
            {titleText}
            <br />
            <strong>{strongText}</strong>
          </h1>

          <div className={`da-bio-scene da-${scanMode}`}>
            <div className="da-bio-stack">
              <div className="da-bio-aura" />
              <div className="da-bio-disk">
                <div className="da-bio-inset-ring" />
                <div className="da-bio-orbit" />
                <div className="da-bio-spin" />
                <div className="da-scan-beam" />

                <div className="da-bio-icon" aria-hidden="true">
                  <svg width="86" height="86" viewBox="0 0 96 96" fill="none">
                    <path d="M20 34V18H36" stroke="#3d5af1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M60 18H76V34" stroke="#3d5af1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 62V78H36" stroke="#3d5af1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M60 78H76V62" stroke="#3d5af1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M31 71C31 71 24 62 24 49C24 36 34 26 48 26C62 26 72 36 72 49C72 58 68 64 66 67" stroke="#3d5af1" strokeWidth="2.1" strokeLinecap="round" />
                    <path d="M39 69C39 69 34 62 34 49C34 41 40 35 48 35C56 35 62 41 62 49C62 55 59 60 59 60" stroke="#3d5af1" strokeWidth="2.1" strokeLinecap="round" />
                    <path d="M48 48V55" stroke="#3d5af1" strokeWidth="2.1" strokeLinecap="round" />
                    <circle cx="48" cy="48" r="3" fill="#3d5af1" />
                  </svg>
                </div>
              </div>
            </div>

            <p className="da-bio-caption">
              {scanMode === 'checking' && 'Checking registered device...'}
              {scanMode === 'ready' && (hasPasskey ? 'Use your device lock to continue' : 'Create a passkey on this device')}
              {scanMode === 'scanning' && 'Waiting for face, fingerprint, PIN, or screen lock...'}
              {scanMode === 'success' && 'Device verified'}
              {scanMode === 'error' && 'Please try again'}
            </p>
          </div>

          {profileName && (
            <div className="da-profile-card">
              <span>Mobile Identity</span>
              <strong>{profileName}</strong>
            </div>
          )}

          <div className="da-profile-card">
            <span>Secure ID</span>
            <strong>{cleanSymbolId || 'Missing'}</strong>
          </div>

          <button
            type="button"
            className="da-main-cta"
            onClick={handlePrimaryAction}
            disabled={busy || hasPasskey === null || !cleanSymbolId}
          >
            {actionText}
          </button>

          <button
            type="button"
            className="da-secondary-cta"
            onClick={checkPasskeyStatus}
            disabled={busy}
          >
            Refresh status
          </button>

          {status && (
            <p className="da-status">
              {status}
            </p>
          )}
        </div>

        <div className="da-footer">
          {'\u2764\uFE0F'} from {'\u092D\u093E\u0930\u0924'}
        </div>
      </div>
    </div>
  );
}