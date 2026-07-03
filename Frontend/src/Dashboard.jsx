import React, { useState } from 'react';
import './Dashboard.css';

export default function Dashboard({ symbolId, onLogout }) {
  const [showTopInfo, setShowTopInfo] = useState(false);
  
  // Toggles for the data
  const [showSecureId, setShowSecureId] = useState(false); 
  const [showBalance, setShowBalance] = useState(false);   

  return (
    <div className="dash-body">
      <div className="dash-app-container">
        
        {/* --- Top Header --- */}
        <div className="header-row">
          <div className="search-bar top-toggle-btn" onClick={() => setShowTopInfo(!showTopInfo)}>
            <div className="globe-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            
            <div className="top-info-container">
              {showTopInfo ? (
                <div className="top-info-text">
                  <span className="info-id">{symbolId || 'GLB-8924'}</span>
                  <span className="info-phone">+91 98765 43210</span>
                </div>
              ) : (
                <input 
                  type="text" 
                  placeholder="Search Mobile No. or Gloobal ID" 
                  readOnly
                  style={{ cursor: 'pointer', background: 'transparent' }}
                />
              )}
            </div>
            
            <div className="bell-inside">
              <div className="bell-dot-inside"></div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </div>
          </div>
        </div>

        {/* --- Hero Card --- */}
        <div className="hero-card">
          <div className="flag-wrapper clickable" onClick={() => setShowSecureId(!showSecureId)}>
            <div className="indian-flag-large">
              <div className="saffron"></div>
              <div className="white"><div className="chakra-large"></div></div>
              <div className="green"></div>
            </div>
          </div>
          
          <div className="hero-details">
            <div className="detail-row">
              <span className="detail-value-id">{showSecureId ? (symbolId || 'GLB-8924') : ''}</span>
            </div>
            <div className="detail-row">
              <span className="detail-value">{showBalance ? '₹45,250' : '••••••••'}</span>
              <button className="eye-btn-small" onClick={() => setShowBalance(!showBalance)}>
                {showBalance ? (
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                ) : (
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* --- 2x2 Actions Grid --- */}
        <div className="actions-grid">
          
          {/* Scanner (Purple, Top-Left, Viewfinder Design) */}
          <div className="action-card card-purple">
            <div className="icon-sign text-purple">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
                <path d="M16 3h3a2 2 0 0 1 2 2v3"></path>
                <path d="M8 21H5a2 2 0 0 1-2-2v-3"></path>
                <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
                <line x1="4" y1="12" x2="20" y2="12"></line>
              </svg>
            </div>
          </div>
          
          {/* Add Bank (Blue, Top-Right, Big + Sign) */}
          <div className="action-card card-blue">
            <div className="icon-sign text-blue">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
          </div>
          
          {/* Send (Orange, Bottom-Left) */}
          <div className="action-card card-orange">
            <div className="icon-sign text-orange">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"/>
                <polyline points="7 7 17 7 17 17"/>
              </svg>
            </div>
          </div>
          
          {/* Receive (Green, Bottom-Right) */}
          <div className="action-card card-green">
            <div className="icon-sign text-green">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="17" y1="7" x2="7" y2="17"/>
                <polyline points="17 17 7 17 7 7"/>
              </svg>
            </div>
          </div>

        </div>

        {/* --- Bottom Navigation (Centered, Scanner Removed) --- */}
        <div className="bottom-nav">
          <div className="nav-item active"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><div className="active-indicator"></div></div>
          <div className="nav-item"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg></div>
          <div className="nav-item" onClick={onLogout} style={{ cursor: 'pointer' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>
          <div className="nav-item"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
        </div>
      </div>
    </div>
  );
}
