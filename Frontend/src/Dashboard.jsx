import React, { useEffect, useMemo, useState } from 'react';
import './Dashboard.css';

const RAW_API_BASE = import.meta.env.VITE_API_URL || 'https://gloobal-pay.onrender.com';
const API_BASE = RAW_API_BASE.replace(/\/+$/, '').replace(/\/api$/i, '');

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function formatMoney(amount) {
  const value = Number(amount || 0);
  return `\u20b9${value.toLocaleString('en-IN')}`;
}

function makeDummyUpiId(profile, symbolId) {
  const mobile = profile?.mobileNumber || '';
  const digits = mobile.replace(/\D/g, '');

  if (digits.length >= 10) {
    return `${digits.slice(-10)}@gloobalupi`;
  }

  const fallback = String(symbolId || profile?.fullName || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 18);

  return `${fallback || 'user'}@gloobalupi`;
}

function getTransactionAmount(tx) {
  return tx?.amount || tx?.transactionAmount || tx?.value || 0;
}

function getTransactionTitle(tx) {
  if (tx?.note) return tx.note;
  if (tx?.receiverName) return `Paid to ${tx.receiverName}`;
  if (tx?.senderName) return `Received from ${tx.senderName}`;
  if (tx?.receiverSymbolId) return `Paid to ${tx.receiverSymbolId}`;
  if (tx?.senderSymbolId) return `Received from ${tx.senderSymbolId}`;
  return 'Gloobal payment';
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10H12a4 4 0 0 0-4 4v8" />
      <path d="M44 10h8a4 4 0 0 1 4 4v8" />
      <path d="M20 54H12a4 4 0 0 1-4-4v-8" />
      <path d="M44 54h8a4 4 0 0 0 4-4v-8" />
      <path d="M18 32h28" />
      <path d="M24 24h16v16H24z" />
    </svg>
  );
}

function BankAddIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M26 10 48 22H4L26 10Z" />
      <path d="M10 22v24" />
      <path d="M24 22v24" />
      <path d="M38 22v20" />
      <path d="M6 46h38" />
      <circle cx="49" cy="43" r="10" />
      <path d="M49 37v12" />
      <path d="M43 43h12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="60" height="60" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 44 44 20" />
      <path d="M24 20h20v20" />
    </svg>
  );
}

function ReceiveIcon() {
  return (
    <svg width="60" height="60" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M44 20 20 44" />
      <path d="M44 44H20V20" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function Dashboard({ symbolId, onLogout }) {
  const [activeView, setActiveView] = useState('home');
  const [showBalance, setShowBalance] = useState(true);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchMessage, setSearchMessage] = useState('');

  const [sendForm, setSendForm] = useState({
    receiver: '',
    amount: '',
    note: '',
  });
  const [receiverPreview, setReceiverPreview] = useState(null);
  const [receiverLoading, setReceiverLoading] = useState(false);
  const [sendMessage, setSendMessage] = useState('');

  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMessage, setHistoryMessage] = useState('');

  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifsc: '',
  });
  const [bankMessage, setBankMessage] = useState('');

  const dummyUpiId = useMemo(() => makeDummyUpiId(profile, symbolId), [profile, symbolId]);

  const profileName = profile?.fullName || profile?.name || 'Gloobal User';
  const profileMobile = profile?.mobileNumber || '+91 mobile not available';
  const referralId = profile?.referredBy || profile?.referralId || 'Not added';

  useEffect(() => {
    async function loadProfile() {
      if (!symbolId) return;

      setProfileLoading(true);

      try {
        const res = await fetch(apiUrl(`/api/profile/${encodeURIComponent(symbolId)}`));
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          setProfile(data.user || data.profile || data);
        }
      } catch (error) {
        console.warn('Profile load failed', error);
      } finally {
        setProfileLoading(false);
      }
    }

    loadProfile();
  }, [symbolId]);

  useEffect(() => {
    const savedBank = localStorage.getItem(`gloobal.bank.${symbolId || 'guest'}`);

    if (!savedBank) return;

    try {
      setBankForm(JSON.parse(savedBank));
    } catch {
      localStorage.removeItem(`gloobal.bank.${symbolId || 'guest'}`);
    }
  }, [symbolId]);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolId]);

  async function loadHistory() {
    if (!symbolId) return;

    setHistoryLoading(true);
    setHistoryMessage('');

    try {
      const res = await fetch(apiUrl(`/api/transactions/history/${encodeURIComponent(symbolId)}`));
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Unable to load history.');
      }

      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (error) {
      setHistoryMessage(error.message || 'Unable to load history.');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function resolveUser(identifier, mode = 'search') {
    const clean = String(identifier || '').trim();

    if (!clean) {
      const message = mode === 'send'
        ? 'Enter receiver mobile number or Gloobal ID.'
        : 'Enter mobile number or Gloobal ID.';

      if (mode === 'send') setSendMessage(message);
      if (mode === 'search') setSearchMessage(message);

      return null;
    }

    if (mode === 'search') {
      setSearchLoading(true);
      setSearchMessage('');
      setSearchResult(null);
    }

    if (mode === 'send') {
      setReceiverLoading(true);
      setSendMessage('');
      setReceiverPreview(null);
    }

    try {
      const res = await fetch(apiUrl(`/api/users/resolve?identifier=${encodeURIComponent(clean)}`));
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'No user found.');
      }

      const user = data.user || data.profile || data;

      if (mode === 'search') {
        setSearchResult(user);
        setActiveView('search');
      }

      if (mode === 'send') {
        setReceiverPreview(user);
      }

      return user;
    } catch (error) {
      const message = error.message || 'No user found.';

      if (mode === 'search') setSearchMessage(message);
      if (mode === 'send') setSendMessage(message);

      return null;
    } finally {
      if (mode === 'search') setSearchLoading(false);
      if (mode === 'send') setReceiverLoading(false);
    }
  }

  async function handleSearchSubmit(event) {
    event.preventDefault();
    await resolveUser(searchTerm, 'search');
  }

  async function handleProceedToPin() {
    setSendMessage('');
    setReceipt(null);

    const amount = Number(sendForm.amount);

    if (!sendForm.receiver.trim()) {
      setSendMessage('Enter receiver mobile number or Gloobal ID.');
      return;
    }

    if (!amount || amount <= 0) {
      setSendMessage('Enter a valid amount.');
      return;
    }

    const receiver = receiverPreview || (await resolveUser(sendForm.receiver, 'send'));

    if (!receiver) return;

    if ((receiver.symbolId || '').trim() === (symbolId || '').trim()) {
      setSendMessage('Self-transfer is not allowed.');
      return;
    }

    setPin('');
    setPinOpen(true);
  }

  async function handlePayNow() {
    if (pin.length < 4) {
      setSendMessage('Enter 4 to 6 digit PIN.');
      return;
    }

    if (!receiverPreview) {
      setSendMessage('Receiver not verified.');
      return;
    }

    setPaymentLoading(true);
    setSendMessage('');

    try {
      const amount = Number(sendForm.amount);
      const idempotencyKey = `gloobal-${symbolId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const res = await fetch(apiUrl('/api/transactions/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderSymbolId: symbolId,
          receiverSymbolId: receiverPreview.symbolId || sendForm.receiver.trim(),
          amount,
          note: sendForm.note || 'Gloobal payment',
          pin,
          idempotencyKey,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Payment failed.');
      }

      const tx = data.transaction || data;

      setReceipt({
        amount,
        note: sendForm.note || 'Gloobal payment',
        receiverName: receiverPreview.fullName || receiverPreview.name || 'Receiver',
        receiverSymbolId: receiverPreview.symbolId || sendForm.receiver.trim(),
        referenceId: tx.referenceId || tx._id || idempotencyKey,
        createdAt: tx.createdAt || new Date().toISOString(),
      });

      setPin('');
      setPinOpen(false);
      setSendForm({ receiver: '', amount: '', note: '' });
      setReceiverPreview(null);

      await loadHistory();
    } catch (error) {
      setSendMessage(error.message || 'Payment failed.');
    } finally {
      setPaymentLoading(false);
    }
  }

  function handlePinKey(value) {
    setPin((current) => {
      if (current.length >= 6) return current;
      return `${current}${value}`;
    });
  }

  function handleSaveBank(event) {
    event.preventDefault();

    if (!bankForm.bankName || !bankForm.accountName || !bankForm.accountNumber || !bankForm.ifsc) {
      setBankMessage('Fill all bank account details.');
      return;
    }

    localStorage.setItem(`gloobal.bank.${symbolId || 'guest'}`, JSON.stringify(bankForm));
    setBankMessage('Prototype bank account saved on this device.');
  }

  function goHome() {
    setActiveView('home');
    setSearchMessage('');
    setSendMessage('');
  }

  return (
    <div className="dash-body">
      <div className="dash-app-container">
        <div className="header-row">
          <form className="search-bar" onSubmit={handleSearchSubmit}>
            <button type="button" className="globe-icon" onClick={goHome} aria-label="Home">
              <GlobeIcon />
            </button>

            <input
              type="text"
              placeholder="Search Mobile No. or Gloobal ID"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />

            <button className="bell-inside" type="submit" disabled={searchLoading} aria-label="Search">
              <div className="bell-dot-inside" />
              <SearchIcon />
            </button>
          </form>
        </div>

        {activeView === 'home' && (
          <>
            <div className="hero-card">
              <div className="flag-wrapper">
                <div className="indian-flag-large">
                  <div className="saffron" />
                  <div className="white">
                    <div className="chakra-large" />
                  </div>
                  <div className="green" />
                </div>
              </div>

              <div className="hero-details">
                <span className="hero-small-title">Gloobal Balance</span>

                <div className="detail-row">
                  <span className="detail-value">
                    {showBalance ? formatMoney(45250) : '********'}
                  </span>

                  <button className="eye-btn-small" onClick={() => setShowBalance(!showBalance)} aria-label="Show balance">
                    <EyeIcon />
                  </button>
                </div>
              </div>
            </div>

            <div className="actions-grid">
              <button className="action-card card-purple" onClick={() => setActiveView('scan')} aria-label="Scan QR">
                <div className="icon-sign text-purple">
                  <ScanIcon />
                </div>
              </button>

              <button className="action-card card-blue" onClick={() => setActiveView('addBank')} aria-label="Add bank account">
                <div className="icon-sign text-blue">
                  <BankAddIcon />
                </div>
              </button>

              <button className="action-card card-orange" onClick={() => setActiveView('send')} aria-label="Send money">
                <div className="icon-sign text-orange">
                  <SendIcon />
                </div>
              </button>

              <button className="action-card card-green" onClick={() => setActiveView('receive')} aria-label="Receive money">
                <div className="icon-sign text-green">
                  <ReceiveIcon />
                </div>
              </button>
            </div>
          </>
        )}

        {activeView === 'search' && (
          <section className="dash-panel">
            <div className="panel-head">
              <button onClick={goHome}>Back</button>
              <h2>Search Result</h2>
            </div>

            {searchMessage && <p className="dash-message">{searchMessage}</p>}

            {searchResult && (
              <div className="user-preview-card">
                <strong>{searchResult.fullName || searchResult.name || 'Gloobal User'}</strong>
                <span>{searchResult.symbolId || 'Gloobal ID not available'}</span>

                <button
                  className="dash-primary-btn"
                  onClick={() => {
                    setSendForm((current) => ({
                      ...current,
                      receiver: searchResult.symbolId || searchTerm,
                    }));
                    setReceiverPreview(searchResult);
                    setActiveView('send');
                  }}
                >
                  Send Money
                </button>
              </div>
            )}
          </section>
        )}

        {activeView === 'scan' && (
          <section className="dash-panel">
            <div className="panel-head">
              <button onClick={goHome}>Back</button>
              <h2>Scan QR</h2>
            </div>

            <div className="qr-placeholder">
              <span />
              <p>Scanner UI ready. Camera QR payment will be connected later.</p>
            </div>
          </section>
        )}

        {activeView === 'send' && (
          <section className="dash-panel">
            <div className="panel-head">
              <button onClick={goHome}>Back</button>
              <h2>Send Money</h2>
            </div>

            <label className="dash-label">Receiver Mobile No. or Gloobal ID</label>

            <div className="inline-field">
              <input
                value={sendForm.receiver}
                onChange={(event) => {
                  setSendForm((current) => ({ ...current, receiver: event.target.value }));
                  setReceiverPreview(null);
                }}
                placeholder="Enter mobile or Gloobal ID"
              />

              <button type="button" onClick={() => resolveUser(sendForm.receiver, 'send')} disabled={receiverLoading}>
                {receiverLoading ? '...' : 'Check'}
              </button>
            </div>

            {receiverPreview && (
              <div className="receiver-card">
                <span>Paying to</span>
                <strong>{receiverPreview.fullName || receiverPreview.name || 'Receiver'}</strong>
                <small>{receiverPreview.symbolId || sendForm.receiver}</small>
              </div>
            )}

            <label className="dash-label">Amount</label>
            <input
              className="dash-input"
              value={sendForm.amount}
              onChange={(event) => setSendForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder="Enter amount"
              inputMode="decimal"
            />

            <label className="dash-label">Note</label>
            <input
              className="dash-input"
              value={sendForm.note}
              onChange={(event) => setSendForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="For food, rent, recharge..."
            />

            {sendMessage && <p className="dash-message">{sendMessage}</p>}

            <button className="dash-primary-btn" onClick={handleProceedToPin}>
              Proceed Securely
            </button>

            {receipt && (
              <div className="receipt-card">
                <div className="success-mark">✓</div>
                <h3>Payment Successful</h3>
                <strong>{formatMoney(receipt.amount)}</strong>
                <p>To {receipt.receiverName}</p>
                <small>Ref: {receipt.referenceId}</small>
              </div>
            )}
          </section>
        )}

        {activeView === 'receive' && (
          <section className="dash-panel">
            <div className="panel-head">
              <button onClick={goHome}>Back</button>
              <h2>Receive Money</h2>
            </div>

            <div className="receive-card">
              <div className="qr-box" />
              <strong>{profileName}</strong>
              <span>{dummyUpiId}</span>

              <button className="dash-primary-btn" onClick={() => navigator.clipboard?.writeText(dummyUpiId)}>
                Copy Gloobal UPI ID
              </button>
            </div>
          </section>
        )}

        {activeView === 'addBank' && (
          <section className="dash-panel">
            <div className="panel-head">
              <button onClick={goHome}>Back</button>
              <h2>Add Bank</h2>
            </div>

            <form onSubmit={handleSaveBank}>
              <label className="dash-label">Bank Name</label>
              <input
                className="dash-input"
                value={bankForm.bankName}
                onChange={(event) => setBankForm((current) => ({ ...current, bankName: event.target.value }))}
                placeholder="HDFC Bank / SBI / ICICI"
              />

              <label className="dash-label">Account Holder Name</label>
              <input
                className="dash-input"
                value={bankForm.accountName}
                onChange={(event) => setBankForm((current) => ({ ...current, accountName: event.target.value }))}
                placeholder="Account holder name"
              />

              <label className="dash-label">Account Number</label>
              <input
                className="dash-input"
                value={bankForm.accountNumber}
                onChange={(event) => setBankForm((current) => ({ ...current, accountNumber: event.target.value }))}
                placeholder="Prototype account number"
              />

              <label className="dash-label">IFSC</label>
              <input
                className="dash-input"
                value={bankForm.ifsc}
                onChange={(event) => setBankForm((current) => ({ ...current, ifsc: event.target.value.toUpperCase() }))}
                placeholder="IFSC code"
              />

              {bankMessage && <p className="dash-message">{bankMessage}</p>}

              <button className="dash-primary-btn" type="submit">
                Save Bank Account
              </button>
            </form>
          </section>
        )}

        {activeView === 'history' && (
          <section className="dash-panel">
            <div className="panel-head">
              <button onClick={goHome}>Back</button>
              <h2>Transaction History</h2>
            </div>

            <button className="dash-secondary-btn" onClick={loadHistory}>
              Refresh History
            </button>

            {historyLoading && <p className="dash-message">Loading history...</p>}
            {historyMessage && <p className="dash-message">{historyMessage}</p>}

            <div className="history-list">
              {transactions.length === 0 && !historyLoading ? (
                <p className="empty-state">No transactions yet.</p>
              ) : (
                transactions.map((tx, index) => (
                  <div className="history-item" key={tx._id || tx.referenceId || index}>
                    <div>
                      <strong>{getTransactionTitle(tx)}</strong>
                      <span>{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'Recent'}</span>
                    </div>
                    <b>{formatMoney(getTransactionAmount(tx))}</b>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeView === 'profile' && (
          <section className="dash-panel">
            <div className="panel-head">
              <button onClick={goHome}>Back</button>
              <h2>Profile</h2>
            </div>

            {profileLoading && <p className="dash-message">Loading profile...</p>}

            <div className="profile-card">
              <label>Name</label>
              <strong>{profileName}</strong>
            </div>

            <div className="profile-card">
              <label>Mobile Number</label>
              <strong>{profileMobile}</strong>
            </div>

            <div className="profile-card">
              <label>Gloobal ID</label>
              <strong>{symbolId || 'Not available'}</strong>
            </div>

            <div className="profile-card">
              <label>Referral ID</label>
              <strong>{referralId}</strong>
            </div>

            <p className="profile-note">
              Name edit and mobile update need a safe backend profile update API. Mobile change should require OTP verification.
            </p>

            <button className="dash-danger-btn" onClick={onLogout}>
              Logout
            </button>
          </section>
        )}

        {pinOpen && (
          <div className="pin-overlay">
            <div className="pin-modal">
              <h2>Gloobal UPI PIN</h2>
              <p>Pay {formatMoney(sendForm.amount)} securely</p>

              <div className="pin-dots">
                {[0, 1, 2, 3, 4, 5].map((item) => (
                  <span key={item} className={pin.length > item ? 'pin-dot filled' : 'pin-dot'} />
                ))}
              </div>

              <div className="pin-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button key={num} onClick={() => handlePinKey(num)}>
                    {num}
                  </button>
                ))}

                <button onClick={() => setPin('')}>Clear</button>
                <button onClick={() => handlePinKey(0)}>0</button>
                <button onClick={() => setPin((current) => current.slice(0, -1))}>Del</button>
              </div>

              <p className="pin-warning">Never enter your UPI PIN to receive money.</p>

              <div className="pin-actions">
                <button onClick={() => { setPinOpen(false); setPin(''); }} disabled={paymentLoading}>
                  Cancel
                </button>

                <button onClick={handlePayNow} disabled={paymentLoading}>
                  {paymentLoading ? 'Paying...' : 'Pay'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bottom-nav">
          <button className={activeView === 'home' ? 'nav-item active' : 'nav-item'} onClick={goHome} aria-label="Home">
            <HomeIcon />
            {activeView === 'home' && <div className="active-indicator" />}
          </button>

          <button className={activeView === 'addBank' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('addBank')} aria-label="Bank">
            <CardIcon />
          </button>

          <button className={activeView === 'profile' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('profile')} aria-label="Profile">
            <ProfileIcon />
          </button>

          <button
            className={activeView === 'history' ? 'nav-item active history-nav' : 'nav-item history-nav'}
            onClick={() => {
              setActiveView('history');
              loadHistory();
            }}
            aria-label="Transaction history"
          >
            <ClockIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
