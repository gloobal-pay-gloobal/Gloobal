import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './Dashboard.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gloobal-pay.onrender.com';

function formatDateTime(value) {
  if (!value) return 'Just now';

  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return 'Recent';
  }
}

function displayName(user) {
  const name = String(user?.fullName || '').trim();
  const symbol = String(user?.symbolId || '').trim();

  if (name) return name;
  if (symbol) return symbol;
  return 'Gloobal user';
}

export default function Dashboard({ symbolId }) {
  const [showBalance, setShowBalance] = useState(false);
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dashboardMessage, setDashboardMessage] = useState('');

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  const [receiverSymbolId, setReceiverSymbolId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [recipientPreview, setRecipientPreview] = useState(null);
  const [recipientLookupLoading, setRecipientLookupLoading] = useState(false);
  const [recipientLookupMessage, setRecipientLookupMessage] = useState('');

  const cleanSymbolId = String(symbolId || '').trim();

  const todayText = useMemo(() => {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'long'
    }).format(new Date());
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!cleanSymbolId) {
      setDashboardMessage('Secure ID missing. Please login again.');
      return;
    }

    setLoading(true);
    setDashboardMessage('');

    try {
      const [profileResponse, historyResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/profile/${encodeURIComponent(cleanSymbolId)}`),
        axios.get(`${API_BASE}/api/transactions/history/${encodeURIComponent(cleanSymbolId)}`)
      ]);

      const nextProfile = profileResponse.data?.user || null;
      const nextTransactions = historyResponse.data?.transactions || [];

      setProfile(nextProfile);
      setTransactions(nextTransactions);
      setEditName(nextProfile?.fullName || '');
      setEditEmail(nextProfile?.email || '');
    } catch (error) {
      console.error('Dashboard load error:', error);
      setDashboardMessage(error.response?.data?.message || 'Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [cleanSymbolId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const cleanReceiver = receiverSymbolId.trim();

    setRecipientPreview(null);
    setRecipientLookupMessage('');

    if (!cleanReceiver || cleanReceiver.length < 4) {
      setRecipientLookupLoading(false);
      return undefined;
    }

    let cancelled = false;
    setRecipientLookupLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/users/resolve`, {
          params: {
            identifier: cleanReceiver,
          },
        });

        if (cancelled) {
          return;
        }

        setRecipientPreview(response.data.user || null);
        setRecipientLookupMessage('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        const status = error.response?.status;

        setRecipientPreview(null);

        if (status === 404) {
          setRecipientLookupMessage('No registered user found for this ID or mobile number.');
        } else {
          setRecipientLookupMessage('Could not check receiver right now.');
        }
      } finally {
        if (!cancelled) {
          setRecipientLookupLoading(false);
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [receiverSymbolId]);
  const handleSaveProfile = async (event) => {
    event.preventDefault();

    if (!cleanSymbolId) return;

    setSavingProfile(true);
    setProfileMessage('');

    try {
      const response = await axios.put(`${API_BASE}/api/profile/${encodeURIComponent(cleanSymbolId)}`, {
        fullName: editName,
        email: editEmail
      });

      const updatedUser = response.data?.user;
      setProfile(updatedUser);
      setEditName(updatedUser?.fullName || '');
      setEditEmail(updatedUser?.email || '');
      setProfileMessage('Profile updated. Transaction names will now use the updated profile name.');
      await loadDashboard();
    } catch (error) {
      console.error('Profile update failed:', error);
      setProfileMessage(error.response?.data?.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendTransaction = async (event) => {
    event.preventDefault();

    if (!cleanSymbolId) return;

    setSending(true);
    setSendMessage('');

    try {
      const response = await axios.post(`${API_BASE}/api/transactions/send`, {
        senderSymbolId: cleanSymbolId,
        receiverSymbolId,
        amount: Number(amount),
        note
      });

      setSendMessage(response.data?.message || 'Prototype transaction sent.');
      setReceiverSymbolId('');
      setAmount('');
      setNote('');
      await loadDashboard();
    } catch (error) {
      console.error('Transaction send failed:', error);
      setSendMessage(error.response?.data?.message || 'Could not send prototype transaction.');
    } finally {
      setSending(false);
    }
  };

  const greetingName = profile?.fullName && profile.fullName !== profile.mobileNumber
    ? profile.fullName
    : 'Gloobal user';

  return (
    <div className="dash-body">
      <div className="dash-app-container">
        <div className="dash-scroll-area">
          <div className="dash-header">
            <div className="dash-greeting">
              <div className="dash-rupee-icon">IN</div>
              <div className="dash-user-text">
                <h2>Good morning, {greetingName}</h2>
                <p>{todayText}</p>
              </div>
            </div>
            <div className="dash-header-icons">
              <span className="dash-mini-pill">Live prototype</span>
            </div>
          </div>

          {dashboardMessage && (
            <div className="dash-alert">{dashboardMessage}</div>
          )}

          <div className="dash-profile-card">
            <div>
              <span>Secure ID</span>
              <strong>{profile?.symbolId || cleanSymbolId || 'Missing'}</strong>
            </div>
            <div>
              <span>Mobile</span>
              <strong>{profile?.mobileNumber || 'Not loaded'}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{profile?.email || 'Add email'}</strong>
            </div>
          </div>

          <div className="dash-balance-card">
            <div className="dash-balance-top">
              <span className="dash-balance-label">Prototype Balance</span>
              <button
                type="button"
                className="dash-eye-btn"
                onClick={() => setShowBalance(!showBalance)}
              >
                {showBalance ? 'Hide' : 'Show'}
              </button>
            </div>

            <div className="dash-balance-amount">
              {showBalance ? 'INR 45,230.00' : '********'}
            </div>

            <div className="dash-balance-stats">
              <span className="dash-stat-positive">Prototype only</span>
              <span style={{ color: '#6b7280', fontWeight: '500' }}>No real money movement</span>
            </div>
          </div>

          <div className="dash-actions-grid">
            <div className="dash-action-item">
              <div className="dash-action-btn">QR</div>
              <span className="dash-action-label">Scan QR</span>
            </div>
            <div className="dash-action-item">
              <div className="dash-action-btn">TX</div>
              <span className="dash-action-label">Transfer</span>
            </div>
            <div className="dash-action-item">
              <div className="dash-action-btn">RQ</div>
              <span className="dash-action-label">Request</span>
            </div>
            <div className="dash-action-item">
              <div className="dash-action-btn">UP</div>
              <span className="dash-action-label">UPI Lite</span>
            </div>
          </div>

          <div className="dash-panel">
            <div className="dash-panel-head">
              <h3>Update Profile</h3>
              <p>Name and email can be updated. Mobile and Secure ID stay locked.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="dash-form">
              <label className="dash-field">
                <span>Name</span>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  placeholder="Enter display name"
                  maxLength={80}
                />
              </label>

              <label className="dash-field">
                <span>Email</span>
                <input
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  maxLength={120}
                />
              </label>

              <button type="submit" className="dash-primary-btn" disabled={savingProfile || !cleanSymbolId}>
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </form>

            {profileMessage && <p className="dash-form-message">{profileMessage}</p>}
          </div>

          <div className="dash-panel">
            <div className="dash-panel-head">
              <h3>Send Prototype Transaction</h3>
              <p>Use another Secure ID to test completed transactions on dashboard.</p>
            </div>

            <form onSubmit={handleSendTransaction} className="dash-form">
              <label className="dash-field">
                <span>Receiver Secure ID</span>
                <input
                  value={receiverSymbolId}
                  onChange={(event) => setReceiverSymbolId(event.target.value)}
                  placeholder="Enter receiver Secure ID"
                />
              </label>

              <label className="dash-field">
                <span>Amount</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="25.75"
                  inputMode="decimal"
                />
              </label>

              <label className="dash-field">
                <span>Note</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Prototype payment note"
                  maxLength={200}
                />
              </label>

              <button type="submit" className="dash-primary-btn" disabled={sending || !cleanSymbolId}>
                {sending ? 'Sending...' : 'Send Prototype'}
              </button>
            </form>

            {sendMessage && <p className="dash-form-message">{sendMessage}</p>}
          </div>

          <div className="dash-section-row">
            <h3 className="dash-section-title">Recent Transactions</h3>
            <button type="button" className="dash-refresh-btn" onClick={loadDashboard} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="dash-tx-list">
            {transactions.length === 0 ? (
              <div className="dash-empty-state">
                No prototype transactions yet.
              </div>
            ) : (
              transactions.map((transaction) => {
                const isSent = transaction.direction === 'sent';
                const counterparty = displayName(transaction.counterparty);
                const amountPrefix = isSent ? '-' : '+';

                return (
                  <div className="dash-tx-item" key={String(transaction.id || transaction.referenceId)}>
                    <div className="dash-tx-info">
                      <h4>{counterparty}</h4>
                      <p>
                        {isSent ? 'Sent' : 'Received'} - {transaction.status} - {formatDateTime(transaction.createdAt)}
                      </p>
                      <p className="dash-tx-ref">{transaction.referenceId}</p>
                    </div>
                    <div className={`dash-tx-amount ${isSent ? 'dash-tx-minus' : 'dash-tx-plus'}`}>
                      {amountPrefix} INR {Number(transaction.amount || 0).toFixed(2)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="dash-bottom-nav">
          <div className="dash-nav-item active">
            <span>Home</span>
          </div>
          <div className="dash-nav-item">
            <span>Cards</span>
          </div>

          <div className="dash-nav-scan">
            QR
          </div>

          <div className="dash-nav-item">
            <span>Activity</span>
          </div>
          <div className="dash-nav-item">
            <span>Profile</span>
          </div>
        </div>
      </div>
    </div>
  );
}
