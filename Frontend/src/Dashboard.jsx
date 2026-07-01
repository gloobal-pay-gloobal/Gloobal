import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './Dashboard.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gloobal-pay.onrender.com';

const BILL_SERVICES = [
  { icon: 'MOB', title: 'Mobile Recharge', status: 'Coming soon' },
  { icon: 'CARD', title: 'Credit Card Bill', status: 'Coming soon' },
  { icon: 'ELEC', title: 'Electricity Bill', status: 'Coming soon' },
  { icon: 'EMI', title: 'Loan EMI', status: 'Coming soon' },
  { icon: 'H2O', title: 'Water Bill', status: 'Coming soon' },
  { icon: 'GAS', title: 'Gas Booking', status: 'Coming soon' },
  { icon: 'DTH', title: 'DTH Recharge', status: 'Coming soon' },
  { icon: 'TAG', title: 'FASTag', status: 'Coming soon' }
];

const TOOL_CARDS = [
  { title: 'Check Your Credit Score', hint: 'Free tool', tone: 'mint' },
  { title: 'Set Gold Price Alerts', hint: 'Smart alerts', tone: 'gold' },
  { title: 'Split Bills Easily', hint: 'Group payments', tone: 'blue' }
];

const MORE_SERVICES = [
  { icon: 'DEAL', title: 'Free Deals & Offers' },
  { icon: 'GIFT', title: 'Gift Vouchers' },
  { icon: 'CASH', title: 'Cashback & Offers' },
  { icon: 'ALL', title: 'See All Services' }
];

const PROMOTED_SERVICES = [
  { title: 'Term Plan', hint: 'Rs. 595/month' },
  { title: 'Fixed Returns', hint: '14.5% demo' },
  { title: 'RuPay Cashback', hint: 'Placeholder' },
  { title: 'Unlimited Data', hint: 'Future offer' }
];

const DUMMY_BANKS = [
  'HDFC Bank',
  'State Bank of India',
  'ICICI Bank',
  'Axis Bank',
  'Punjab National Bank',
  'Kotak Mahindra Bank'
];

function formatDateTime(value) {
  if (!value) return 'Just now';

  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return 'Recent';
  }
}

function formatMoney(value) {
  const amount = Number(value || 0);

  return `INR ${amount.toFixed(2)}`;
}

function displayName(user) {
  const name = String(user?.fullName || '').trim();
  const symbol = String(user?.symbolId || '').trim();

  if (name) return name;
  if (symbol) return symbol;
  return 'Gloobal user';
}

function getInitials(user) {
  const name = displayName(user);
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function safeHandle(value) {
  return String(value || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 18) || 'user';
}

function scoreString(value) {
  return String(value || '')
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0);
}

// TODO: Replace this dummy UPI generator with real linked-bank UPI data later.
function getDummyUpiId(user) {
  const mobileDigits = onlyDigits(user?.mobileNumber);

  if (mobileDigits.length >= 7) {
    return `${mobileDigits.slice(-10)}@gloobalupi`;
  }

  return `${safeHandle(user?.symbolId || user?.fullName)}@gloobalupi`;
}

// TODO: Replace this dummy bank/account data with real bank account data later.
function getDummyBankAccount(user) {
  const key = user?.symbolId || user?.mobileNumber || user?.fullName || 'gloobal';
  const bankName = DUMMY_BANKS[scoreString(key) % DUMMY_BANKS.length];
  const accountSeed = onlyDigits(user?.mobileNumber || user?.symbolId || key);
  const maskedAccount = accountSeed.slice(-4) || '3401';

  return {
    bankName,
    maskedAccount,
    label: `${bankName} - ${maskedAccount}`
  };
}

function createIdempotencyKey(senderSymbolId, receiverIdentifier) {
  return [
    'gloobal',
    Date.now(),
    safeHandle(senderSymbolId),
    safeHandle(receiverIdentifier),
    Math.random().toString(36).slice(2, 10)
  ].join('-');
}

function playSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.connect(context.destination);

    const tones = [
      { frequency: 660, start: 0, duration: 0.12 },
      { frequency: 880, start: 0.11, duration: 0.14 },
      { frequency: 1175, start: 0.25, duration: 0.22 }
    ];

    tones.forEach((tone) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(tone.frequency, context.currentTime + tone.start);
      oscillator.connect(gain);
      oscillator.start(context.currentTime + tone.start);
      oscillator.stop(context.currentTime + tone.start + tone.duration);
    });

    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);

    window.setTimeout(() => {
      context.close?.();
    }, 800);
  } catch (error) {
    console.warn('Success sound could not play:', error);
  }
}

export default function Dashboard({ symbolId, onLogout }) {
  const [showBalance, setShowBalance] = useState(false);
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dashboardMessage, setDashboardMessage] = useState('');

  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  const [receiverSymbolId, setReceiverSymbolId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [recipientPreview, setRecipientPreview] = useState(null);
  const [recipientLookupLoading, setRecipientLookupLoading] = useState(false);
  const [recipientLookupMessage, setRecipientLookupMessage] = useState('');

  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentPin, setPaymentPin] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const [successOverlayOpen, setSuccessOverlayOpen] = useState(false);

  const cleanSymbolId = String(symbolId || '').trim();

  const currentUser = useMemo(() => {
    return profile || {
      fullName: 'Gloobal user',
      symbolId: cleanSymbolId,
      mobileNumber: ''
    };
  }, [profile, cleanSymbolId]);

  const senderBank = useMemo(() => getDummyBankAccount(currentUser), [currentUser]);
  const senderUpiId = useMemo(() => getDummyUpiId(currentUser), [currentUser]);

  const receiverBank = useMemo(() => {
    if (!recipientPreview) return null;
    return getDummyBankAccount(recipientPreview);
  }, [recipientPreview]);

  const receiverUpiId = useMemo(() => {
    if (!recipientPreview) return '';
    return getDummyUpiId(recipientPreview);
  }, [recipientPreview]);

  const sentTransactions = useMemo(() => {
    return transactions.filter((transaction) => transaction.direction === 'sent');
  }, [transactions]);

  const receivedTransactions = useMemo(() => {
    return transactions.filter((transaction) => transaction.direction === 'received');
  }, [transactions]);

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
            identifier: cleanReceiver
          }
        });

        if (cancelled) return;

        setRecipientPreview(response.data.user || null);
        setRecipientLookupMessage('');
      } catch (error) {
        if (cancelled) return;

        const status = error.response?.status;
        setRecipientPreview(null);

        if (status === 404) {
          setRecipientLookupMessage('No registered user found for this Secure ID or mobile number.');
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
        fullName: editName
      });

      const updatedUser = response.data?.user;
      setProfile(updatedUser);
      setEditName(updatedUser?.fullName || '');
      setProfileMessage('Profile updated. Transaction names will use the updated profile name.');
      await loadDashboard();
    } catch (error) {
      console.error('Profile update failed:', error);
      setProfileMessage(error.response?.data?.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenPaymentSheet = (event) => {
    event.preventDefault();

    setSendMessage('');
    setPaymentError('');

    const cleanReceiver = receiverSymbolId.trim();
    const numericAmount = Number(amount);

    if (!cleanSymbolId) {
      setSendMessage('Secure ID missing. Please login again.');
      return;
    }

    if (!cleanReceiver) {
      setSendMessage('Receiver Secure ID or mobile number is required.');
      return;
    }

    if (cleanReceiver.toLowerCase() === cleanSymbolId.toLowerCase()) {
      setSendMessage('Self-transfer is not allowed.');
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSendMessage('Valid amount greater than 0 is required.');
      return;
    }

    if (numericAmount > 5000) {
      setSendMessage('Prototype transaction limit is Rs. 5000.');
      return;
    }

    if (recipientLookupLoading) {
      setSendMessage('Please wait while receiver is being checked.');
      return;
    }

    if (!recipientPreview) {
      setSendMessage(recipientLookupMessage || 'Please enter a valid registered receiver first.');
      return;
    }

    setPaymentPin('');
    setPaymentSheetOpen(true);
  };

  const closePaymentSheet = () => {
    if (paymentProcessing) return;

    setPaymentSheetOpen(false);
    setPaymentPin('');
    setPaymentError('');
  };

  const addPinDigit = (digit) => {
    if (paymentProcessing) return;

    setPaymentError('');
    setPaymentPin((current) => {
      if (current.length >= 6) return current;
      return `${current}${digit}`;
    });
  };

  const removePinDigit = () => {
    if (paymentProcessing) return;
    setPaymentPin((current) => current.slice(0, -1));
  };

  const handleConfirmPayment = async () => {
    if (!recipientPreview) {
      setPaymentError('Receiver details missing. Please close and try again.');
      return;
    }

    if (paymentPin.length < 4) {
      setPaymentError('Enter 4 to 6 digit PIN.');
      return;
    }

    setPaymentProcessing(true);
    setPaymentError('');
    setSendMessage('');

    try {
      const idempotencyKey = createIdempotencyKey(cleanSymbolId, receiverSymbolId);

      const response = await axios.post(`${API_BASE}/api/transactions/send`, {
        senderSymbolId: cleanSymbolId,
        receiverSymbolId: receiverSymbolId.trim(),
        amount: Number(amount),
        note,
        pin: paymentPin,
        idempotencyKey
      });

      const transaction = response.data?.transaction || {};

      setPaymentReceipt({
        transaction,
        sender: currentUser,
        receiver: recipientPreview,
        senderUpiId,
        receiverUpiId,
        senderBank,
        receiverBank,
        amount: Number(amount),
        note,
        createdAt: transaction.createdAt || new Date().toISOString(),
        referenceId: transaction.referenceId || 'GLOOBAL-PENDING'
      });

      setPaymentSheetOpen(false);
      setPaymentPin('');
      setReceiverSymbolId('');
      setAmount('');
      setNote('');
      setRecipientPreview(null);
      setSendMessage(response.data?.message || 'Payment completed successfully.');
      setSuccessOverlayOpen(true);

      playSuccessChime();

      window.setTimeout(() => {
        setSuccessOverlayOpen(false);
      }, 1800);

      await loadDashboard();
    } catch (error) {
      console.error('Transaction send failed:', error);
      setPaymentError(error.response?.data?.message || 'Could not complete payment.');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleLogout = () => {
    if (typeof onLogout === 'function') {
      onLogout();
      return;
    }

    try {
      window.localStorage.removeItem('gloobal.session.v1');
    } catch (error) {
      console.warn('Could not clear saved session:', error);
    }

    window.location.reload();
  };

  const greetingName = profile?.fullName && profile.fullName !== profile.mobileNumber
    ? profile.fullName
    : 'Gloobal user';

  return (
    <div className="dash-body">
      <div className="dash-app-container">
        <div className="dash-scroll-area">
          <header className="dash-topbar">
            <div className="dash-avatar">{getInitials(currentUser)}</div>

            <div className="dash-reward-strip">
              <strong>Gloobal Rewards</strong>
              <span>Secure prototype payments</span>
            </div>

            <div className="dash-top-actions">
              <button type="button" aria-label="Search" className="dash-icon-button">⌕</button>
              <button type="button" aria-label="Notifications" className="dash-icon-button">!</button>
            </div>
          </header>

          {dashboardMessage && (
            <div className="dash-alert">{dashboardMessage}</div>
          )}

          <section className="dash-profile-hero">
            <div className="dash-profile-main">
              <div>
                <span>Welcome back</span>
                <h1>{greetingName}</h1>
                <p>{todayText}</p>
              </div>
              <button type="button" className="dash-logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>

            <div className="dash-identity-grid">
              <div>
                <span>Secure ID</span>
                <strong>{profile?.symbolId || cleanSymbolId || 'Missing'}</strong>
              </div>
              <div>
                <span>Mobile</span>
                <strong>{profile?.mobileNumber || 'Not loaded'}</strong>
              </div>
              <div>
                <span>Dummy UPI ID</span>
                <strong>{senderUpiId}</strong>
              </div>
              <div>
                <span>Dummy bank</span>
                <strong>{senderBank.label}</strong>
              </div>
            </div>
          </section>

          <section className="dash-transfer-section">
            <div className="dash-section-row">
              <h2>UPI Money Transfer</h2>
              <span className="dash-live-pill">Prototype</span>
            </div>

            <div className="dash-upi-actions">
              <button type="button" className="dash-upi-action">
                <span>QR</span>
                <strong>Scan any QR</strong>
              </button>
              <button type="button" className="dash-upi-action">
                <span>PAY</span>
                <strong>Pay Anyone</strong>
              </button>
              <button type="button" className="dash-upi-action">
                <span>BANK</span>
                <strong>To Bank & Self A/C</strong>
              </button>
              <button type="button" className="dash-upi-action" onClick={loadDashboard}>
                <span>HIST</span>
                <strong>Balance & History</strong>
              </button>
            </div>
          </section>

          <section className="dash-send-card">
            <div className="dash-panel-head">
              <h3>Send Money</h3>
              <p>Enter receiver Secure ID or mobile number. PIN is required before payment.</p>
            </div>

            <form onSubmit={handleOpenPaymentSheet} className="dash-form">
              <label className="dash-field">
                <span>Receiver Secure ID or Mobile Number</span>
                <input
                  value={receiverSymbolId}
                  onChange={(event) => setReceiverSymbolId(event.target.value)}
                  placeholder="Secure ID or +91 mobile"
                  autoComplete="off"
                />
              </label>

              {recipientLookupLoading && (
                <div className="dash-recipient-hint">Checking receiver...</div>
              )}

              {recipientPreview && (
                <div className="dash-recipient-preview">
                  <div className="dash-mini-avatar">{getInitials(recipientPreview)}</div>
                  <div>
                    <span>Receiver found</span>
                    <strong>{displayName(recipientPreview)}</strong>
                    <small>{receiverUpiId} · {receiverBank?.label}</small>
                  </div>
                </div>
              )}

              {recipientLookupMessage && (
                <div className="dash-recipient-error">{recipientLookupMessage}</div>
              )}

              <label className="dash-field">
                <span>Amount</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Enter amount"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </label>

              <div className="dash-note-chips">
                {['Testing', 'Money Transfer', 'Personal', 'Bills'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={note === chip ? 'active' : ''}
                    onClick={() => setNote(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <label className="dash-field">
                <span>Note</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional payment note"
                  maxLength={140}
                />
              </label>

              <button
                type="submit"
                className="dash-secure-pay-btn"
                disabled={paymentProcessing || loading || !cleanSymbolId}
              >
                Proceed Securely
              </button>
            </form>

            {sendMessage && <p className="dash-form-message">{sendMessage}</p>}
          </section>

          {paymentReceipt && (
            <section className="dash-receipt-card">
              <div className="dash-receipt-top">
                <span>Payment Successful</span>
                <strong>{formatMoney(paymentReceipt.amount)}</strong>
              </div>

              <div className="dash-receipt-line">
                <span>From</span>
                <div>
                  <strong>{displayName(paymentReceipt.sender)}</strong>
                  <p>{paymentReceipt.senderUpiId}</p>
                  <p>{paymentReceipt.senderBank?.label}</p>
                </div>
              </div>

              <div className="dash-receipt-line">
                <span>To</span>
                <div>
                  <strong>{displayName(paymentReceipt.receiver)}</strong>
                  <p>{paymentReceipt.receiverUpiId}</p>
                  <p>{paymentReceipt.receiverBank?.label}</p>
                </div>
              </div>

              <div className="dash-receipt-meta">
                <p>Paid at {formatDateTime(paymentReceipt.createdAt)}</p>
                <p>Gloobal Ref No: {paymentReceipt.referenceId}</p>
              </div>
            </section>
          )}

          <section className="dash-balance-card">
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
              <span>No real money movement</span>
            </div>
          </section>

          <section className="dash-service-card">
            <div className="dash-section-row">
              <h2>Recharge & Bills</h2>
              <button type="button" className="dash-link-btn">View All</button>
            </div>

            <div className="dash-service-grid">
              {BILL_SERVICES.map((service) => (
                <button type="button" className="dash-service-item" key={service.title}>
                  <span>{service.icon}</span>
                  <strong>{service.title}</strong>
                  <small>{service.status}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="dash-feature-grid">
            <div className="dash-large-feature">
              <span>Demo Credit</span>
              <strong>Unlock Gloobal Postpaid</strong>
              <p>Future credit feature placeholder</p>
            </div>
            <div className="dash-small-feature">
              <strong>Loan Upto</strong>
              <span>Rs. 10 Lakh</span>
            </div>
            <div className="dash-small-feature">
              <strong>Save in Gold</strong>
              <span>Coming soon</span>
            </div>
          </section>

          <section className="dash-tools-card">
            <h2>Free Tools</h2>
            <div className="dash-tool-row">
              {TOOL_CARDS.map((tool) => (
                <div className={`dash-tool-card ${tool.tone}`} key={tool.title}>
                  <strong>{tool.title}</strong>
                  <span>{tool.hint}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="dash-simple-card">
            <h2>Do More with Gloobal</h2>
            <div className="dash-more-grid">
              {MORE_SERVICES.map((service) => (
                <button type="button" className="dash-more-item" key={service.title}>
                  <span>{service.icon}</span>
                  <strong>{service.title}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="dash-simple-card">
            <h2>Promoted</h2>
            <div className="dash-promoted-grid">
              {PROMOTED_SERVICES.map((service) => (
                <div className="dash-promoted-item" key={service.title}>
                  <strong>{service.title}</strong>
                  <span>{service.hint}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="dash-panel dash-profile-edit">
            <div className="dash-panel-head">
              <h3>Profile Settings</h3>
              <p>Name can be updated. Mobile, Secure ID and dummy UPI stay locked for now.</p>
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

              <button type="submit" className="dash-primary-btn" disabled={savingProfile || !cleanSymbolId}>
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </form>

            {profileMessage && <p className="dash-form-message">{profileMessage}</p>}
          </section>

          <section className="dash-history-section">
            <div className="dash-section-row">
              <h2>Sending History</h2>
              <button type="button" className="dash-refresh-btn" onClick={loadDashboard} disabled={loading}>
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="dash-tx-list">
              {sentTransactions.length === 0 ? (
                <div className="dash-empty-state">No sent prototype transactions yet.</div>
              ) : (
                sentTransactions.map((transaction) => {
                  const counterparty = displayName(transaction.counterparty);
                  const bank = getDummyBankAccount(transaction.counterparty);

                  return (
                    <div className="dash-tx-item" key={String(transaction.id || transaction.referenceId)}>
                      <div className="dash-mini-avatar">{getInitials(transaction.counterparty)}</div>
                      <div className="dash-tx-info">
                        <h4>{counterparty}</h4>
                        <p>Sent · {transaction.status} · {formatDateTime(transaction.createdAt)}</p>
                        <p>{getDummyUpiId(transaction.counterparty)} · {bank.label}</p>
                        <p className="dash-tx-ref">{transaction.referenceId}</p>
                      </div>
                      <div className="dash-tx-amount dash-tx-minus">
                        - {formatMoney(transaction.amount)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="dash-history-section">
            <div className="dash-section-row">
              <h2>Receiving History</h2>
            </div>

            <div className="dash-tx-list">
              {receivedTransactions.length === 0 ? (
                <div className="dash-empty-state">No received prototype transactions yet.</div>
              ) : (
                receivedTransactions.map((transaction) => {
                  const counterparty = displayName(transaction.counterparty);
                  const bank = getDummyBankAccount(transaction.counterparty);

                  return (
                    <div className="dash-tx-item" key={String(transaction.id || transaction.referenceId)}>
                      <div className="dash-mini-avatar">{getInitials(transaction.counterparty)}</div>
                      <div className="dash-tx-info">
                        <h4>{counterparty}</h4>
                        <p>Received · {transaction.status} · {formatDateTime(transaction.createdAt)}</p>
                        <p>{getDummyUpiId(transaction.counterparty)} · {bank.label}</p>
                        <p className="dash-tx-ref">{transaction.referenceId}</p>
                      </div>
                      <div className="dash-tx-amount dash-tx-plus">
                        + {formatMoney(transaction.amount)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <button type="button" className="dash-floating-scan">
          <span>QR</span>
          Scan QR
        </button>

        <nav className="dash-bottom-nav">
          <button type="button" className="dash-nav-item active">Home</button>
          <button type="button" className="dash-nav-item">Cards</button>
          <button type="button" className="dash-nav-gap" aria-label="Scan QR placeholder" />
          <button type="button" className="dash-nav-item">Activity</button>
          <button type="button" className="dash-nav-item">Profile</button>
        </nav>

        {paymentSheetOpen && (
          <div className="dash-payment-overlay" role="dialog" aria-modal="true">
            <div className="dash-payment-sheet">
              <div className="dash-upi-sheet-head">
                <div>
                  <strong>Gloobal UPI</strong>
                  <span>{senderBank.label}</span>
                </div>
                <button type="button" onClick={closePaymentSheet} disabled={paymentProcessing}>
                  ×
                </button>
              </div>

              <div className="dash-payment-summary">
                <div>
                  <span>Pay {formatMoney(amount)}</span>
                  <strong>To {displayName(recipientPreview)}</strong>
                </div>
                <div className="dash-mini-avatar">{getInitials(recipientPreview)}</div>
              </div>

              <div className="dash-pin-area">
                <h3>Enter your PIN</h3>
                <div className="dash-pin-dots">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <span key={index} className={index < paymentPin.length ? 'filled' : ''} />
                  ))}
                </div>
                <p>Never enter your UPI PIN to receive money.</p>
                {paymentError && <div className="dash-payment-error">{paymentError}</div>}
              </div>

              <div className="dash-keypad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                  <button type="button" key={digit} onClick={() => addPinDigit(digit)}>
                    {digit}
                  </button>
                ))}

                <button type="button" className="muted" onClick={removePinDigit}>
                  Delete
                </button>
                <button type="button" onClick={() => addPinDigit(0)}>
                  0
                </button>
                <button
                  type="button"
                  className="pay"
                  onClick={handleConfirmPayment}
                  disabled={paymentProcessing || paymentPin.length < 4}
                >
                  {paymentProcessing ? 'Paying...' : 'Pay'}
                </button>
              </div>
            </div>
          </div>
        )}

        {successOverlayOpen && (
          <div className="dash-success-overlay">
            <div className="dash-success-card">
              <div className="dash-success-tick">✓</div>
              <h2>Payment Successful</h2>
              <p>{paymentReceipt ? formatMoney(paymentReceipt.amount) : 'Payment completed'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}