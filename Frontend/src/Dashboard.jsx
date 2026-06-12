import React, { useState } from 'react';
import './Dashboard.css';

export default function Dashboard() {
  const [showBalance, setShowBalance] = useState(false);

  return (
    <div className="dash-body">
      <div className="dash-app-container">
        
        {/* --- SCROLLABLE CONTENT --- */}
        <div className="dash-scroll-area">
          
          {/* Header */}
          <div className="dash-header">
            <div className="dash-greeting">
              <div className="dash-rupee-icon">₹</div>
              <div className="dash-user-text">
                <h2>Good morning, Karan</h2>
                <p>10 June</p>
              </div>
            </div>
            <div className="dash-header-icons">
              {/* Bell Icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              {/* Profile Icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
          </div>

          {/* Offer Details */}
          <div className="dash-offer-banner">
            🎁 Offer details if there is
          </div>

          {/* Balance Card */}
          <div className="dash-balance-card">
            <div className="dash-balance-top">
              <span className="dash-balance-label">Available Balance</span>
              <button 
                className="dash-eye-btn" 
                onClick={() => setShowBalance(!showBalance)}
              >
                {/* Eye Icon Toggle */}
                {showBalance ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                )}
              </button>
            </div>
            
            <div className="dash-balance-amount">
              {showBalance ? '₹ 45,230.00' : '••••••••'}
            </div>
            
            <div className="dash-balance-stats">
              <span className="dash-stat-positive">↑ +12.4%</span>
              <span style={{color: '#6b7280', fontWeight: '500'}}>vs last month</span>
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="dash-actions-grid">
            <div className="dash-action-item">
              <div className="dash-action-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><path d="M3 14h7v7H3z"></path></svg>
              </div>
              <span className="dash-action-label">Scan QR</span>
            </div>
            <div className="dash-action-item">
              <div className="dash-action-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </div>
              <span className="dash-action-label">Transfer</span>
            </div>
            <div className="dash-action-item">
              <div className="dash-action-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </div>
              <span className="dash-action-label">Request</span>
            </div>
            <div className="dash-action-item">
              <div className="dash-action-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              </div>
              <span className="dash-action-label">UPI Lite</span>
            </div>
          </div>

          {/* Recent Transactions */}
          <h3 className="dash-section-title">Recent Transaction</h3>
          <div className="dash-tx-list">
            <div className="dash-tx-item">
              <div className="dash-tx-info">
                <h4>Amazon Web Services</h4>
                <p>Today, 10:24 AM</p>
              </div>
              <div className="dash-tx-amount dash-tx-minus">- ₹ 1,240.00</div>
            </div>
            <div className="dash-tx-item">
              <div className="dash-tx-info">
                <h4>Rahul Sharma</h4>
                <p>Yesterday, 4:15 PM</p>
              </div>
              <div className="dash-tx-amount dash-tx-plus">+ ₹ 500.00</div>
            </div>
            <div className="dash-tx-item">
              <div className="dash-tx-info">
                <h4>Zomato</h4>
                <p>08 June, 8:30 PM</p>
              </div>
              <div className="dash-tx-amount dash-tx-minus">- ₹ 325.50</div>
            </div>
            <div className="dash-tx-item" style={{border: 'none'}}>
              <div className="dash-tx-info">
                <h4>Jio Recharge</h4>
                <p>05 June, 1:00 PM</p>
              </div>
              <div className="dash-tx-amount dash-tx-minus">- ₹ 666.00</div>
            </div>
          </div>
          
        </div>

        {/* --- FIXED BOTTOM NAVIGATION --- */}
        <div className="dash-bottom-nav">
          <div className="dash-nav-item active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span>Home</span>
          </div>
          <div className="dash-nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
            <span>Cards opt.</span>
          </div>
          
          {/* Elevated QR Scanner Button */}
          <div className="dash-nav-scan">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h4v4H4z"></path><path d="M16 4h4v4h-4z"></path><path d="M4 16h4v4H4z"></path><path d="M16 16v.01"></path><path d="M20 16v.01"></path><path d="M16 20v.01"></path><path d="M20 20v.01"></path><path d="M8 12h8"></path><path d="M12 8v8"></path></svg>
          </div>

          <div className="dash-nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            <span>Activity</span>
          </div>
          <div className="dash-nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>Profile</span>
          </div>
        </div>

      </div>
    </div>
  );
}

