import React, { useEffect, useState } from 'react';
import GloobalAccess from './GloobalAccess';
import GloobalAuth from './GloobalAuth';
import Dashboard from './Dashboard';
import DeviceAuth from './DeviceAuth';

const SESSION_KEY = 'gloobal.session.v1';

function readSavedSession() {
  try {
    const saved = window.localStorage.getItem(SESSION_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    const symbolId = String(parsed?.symbolId || '').trim();

    if (!symbolId) return null;

    return {
      symbolId,
      fullName: String(parsed?.fullName || ''),
    };
  } catch {
    return null;
  }
}

function saveSession(userData) {
  const nextSession = {
    symbolId: String(userData?.symbolId || userData?.secureId || '').trim(),
    fullName: String(userData?.fullName || userData?.name || ''),
  };

  if (!nextSession.symbolId) {
    return null;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  return nextSession;
}

function clearSavedSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export default function App() {
  const savedSession = readSavedSession();

  const [currentPage, setCurrentPage] = useState(savedSession ? 'dashboard' : 'home');
  const [session, setSession] = useState(savedSession || { symbolId: '', fullName: '' });

  useEffect(() => {
    if (session.symbolId) {
      saveSession(session);
    }
  }, [session]);

  const goHome = () => {
    clearSavedSession();
    setSession({ symbolId: '', fullName: '' });
    setCurrentPage('home');
  };

  const handleRegistered = (userData) => {
    const nextSession = saveSession(userData);
    if (!nextSession) {
      setCurrentPage('home');
      return;
    }

    setSession(nextSession);
    setCurrentPage('login');
  };

  const handleLoginSuccess = (userData) => {
    const nextSession = saveSession(userData || session);
    if (!nextSession) {
      setCurrentPage('home');
      return;
    }

    setSession(nextSession);
    setCurrentPage('device-auth');
  };

  const handleDeviceSuccess = () => {
    if (session.symbolId) {
      saveSession(session);
    }
    setCurrentPage('dashboard');
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      {currentPage === 'home' && (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f4f5f7',
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <div style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 28,
            padding: 24,
            background: '#ffffff',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
            textAlign: 'center',
          }}>
            <div style={{
              width: 76,
              height: 76,
              margin: '0 auto 16px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(145deg, #eef4ff, #dbe7ff)',
              color: '#2563eb',
              fontWeight: 800,
              fontSize: 24,
            }}>
              G
            </div>

            <h1 style={{ margin: 0, fontSize: 28, color: '#111827' }}>
              Gloobal Access
            </h1>

            <p style={{ margin: '10px 0 24px', color: '#6b7280', lineHeight: 1.5 }}>
              Create a new Secure ID or login with your existing Symbol ID.
            </p>

            <button
              type="button"
              onClick={() => setCurrentPage('register')}
              style={{
                width: '100%',
                border: 0,
                borderRadius: 16,
                padding: '15px 18px',
                marginBottom: 12,
                background: '#2563eb',
                color: '#ffffff',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Create New Secure ID
            </button>

            <button
              type="button"
              onClick={() => {
                clearSavedSession();
                setSession({ symbolId: '', fullName: '' });
                setCurrentPage('login');
              }}
              style={{
                width: '100%',
                border: '1px solid #dbeafe',
                borderRadius: 16,
                padding: '15px 18px',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Existing User Login
            </button>

            <p style={{ margin: '18px 0 0', color: '#94a3b8', fontSize: 13 }}>
              ?? from ????
            </p>
          </div>
        </div>
      )}

      {currentPage === 'register' && (
        <GloobalAccess onComplete={handleRegistered} />
      )}

      {currentPage === 'login' && (
        <GloobalAuth
          symbolId={session.symbolId}
          onSuccess={handleLoginSuccess}
        />
      )}

      {currentPage === 'device-auth' && (
        <DeviceAuth
          symbolId={session.symbolId}
          onSuccess={handleDeviceSuccess}
        />
      )}

      {currentPage === 'dashboard' && (
        <Dashboard symbolId={session.symbolId} onLogout={goHome} />
      )}
    </div>
  );
}
