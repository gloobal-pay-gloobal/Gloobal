import React, { useMemo, useState, useEffect, useEffect } from 'react';
import axios from 'axios';
import './GloobalAccess.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gloobal-pay.onrender.com';

const SYMBOL_KEYS = ['+', '-', '×', '=', '□', '■', '○', '●'];
const PROTOTYPE_OTP = '0000';
const HEART_COLORS = ['💜', '💛', '💚', '💙', '🩷', '🩵', '❤️', '🤎'];

// 12 distinct vibrant colors for boxes
const BOX_COLORS = [
  '#FF4757', '#FF6B35', '#FFA502', '#ECCC68',
  '#2ED573', '#1E90FF', '#5352ED', '#A55EEA',
  '#FF6B81', '#00D2D3', '#54A0FF', '#5F27CD',
];

// Mobile digit colors
const MOBILE_COLORS = [
  '#FF4757', '#FF6B35', '#FFA502', '#2ED573',
  '#1E90FF', '#5352ED', '#A55EEA', '#FF6B81',
  '#00D2D3', '#54A0FF',
];
const HEART_COLORS = ['💜', '💛', '💚', '💙', '🩷', '🩵', '❤️', '🤎'];

// 12 distinct vibrant colors for symbol text
const BOX_COLORS = [
  '#FF4757', '#FF6B35', '#FFA502', '#ECCC68',
  '#2ED573', '#1E90FF', '#5352ED', '#A55EEA',
  '#FF6B81', '#00D2D3', '#54A0FF', '#5F27CD',
];

// 10 colors for mobile digit text
const MOBILE_COLORS = [
  '#FF4757', '#FF6B35', '#FFA502', '#2ED573',
  '#1E90FF', '#5352ED', '#A55EEA', '#FF6B81',
  '#00D2D3', '#54A0FF',
];

const COUNTRIES = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'Afghanistan', code: '+93', flag: '🇦🇫' },
  { name: 'Albania', code: '+355', flag: '🇦🇱' },
  { name: 'Algeria', code: '+213', flag: '🇩🇿' },
  { name: 'Andorra', code: '+376', flag: '🇦🇩' },
  { name: 'Angola', code: '+244', flag: '🇦🇴' },
  { name: 'Argentina', code: '+54', flag: '🇦🇷' },
  { name: 'Armenia', code: '+374', flag: '🇦🇲' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Austria', code: '+43', flag: '🇦🇹' },
  { name: 'Azerbaijan', code: '+994', flag: '🇦🇿' },
  { name: 'Bahamas', code: '+1', flag: '🇧🇸' },
  { name: 'Bahrain', code: '+973', flag: '🇧🇭' },
  { name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { name: 'Belarus', code: '+375', flag: '🇧🇾' },
  { name: 'Belgium', code: '+32', flag: '🇧🇪' },
  { name: 'Belize', code: '+501', flag: '🇧🇿' },
  { name: 'Benin', code: '+229', flag: '🇧🇯' },
  { name: 'Bhutan', code: '+975', flag: '🇧🇹' },
  { name: 'Bolivia', code: '+591', flag: '🇧🇴' },
  { name: 'Bosnia and Herzegovina', code: '+387', flag: '🇧🇦' },
  { name: 'Botswana', code: '+267', flag: '🇧🇼' },
  { name: 'Brazil', code: '+55', flag: '🇧🇷' },
  { name: 'Brunei', code: '+673', flag: '🇧🇳' },
  { name: 'Bulgaria', code: '+359', flag: '🇧🇬' },
  { name: 'Burkina Faso', code: '+226', flag: '🇧🇫' },
  { name: 'Burundi', code: '+257', flag: '🇧🇮' },
  { name: 'Cambodia', code: '+855', flag: '🇰🇭' },
  { name: 'Cameroon', code: '+237', flag: '🇨🇲' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Chad', code: '+235', flag: '🇹🇩' },
  { name: 'Chile', code: '+56', flag: '🇨🇱' },
  { name: 'China', code: '+86', flag: '🇨🇳' },
  { name: 'Colombia', code: '+57', flag: '🇨🇴' },
  { name: 'Costa Rica', code: '+506', flag: '🇨🇷' },
  { name: 'Croatia', code: '+385', flag: '🇭🇷' },
  { name: 'Cuba', code: '+53', flag: '🇨🇺' },
  { name: 'Cyprus', code: '+357', flag: '🇨🇾' },
  { name: 'Czech Republic', code: '+420', flag: '🇨🇿' },
  { name: 'Denmark', code: '+45', flag: '🇩🇰' },
  { name: 'Djibouti', code: '+253', flag: '🇩🇯' },
  { name: 'Dominican Republic', code: '+1', flag: '🇩🇴' },
  { name: 'Ecuador', code: '+593', flag: '🇪🇨' },
  { name: 'Egypt', code: '+20', flag: '🇪🇬' },
  { name: 'El Salvador', code: '+503', flag: '🇸🇻' },
  { name: 'Estonia', code: '+372', flag: '🇪🇪' },
  { name: 'Ethiopia', code: '+251', flag: '🇪🇹' },
  { name: 'Fiji', code: '+679', flag: '🇫🇯' },
  { name: 'Finland', code: '+358', flag: '🇫🇮' },
  { name: 'France', code: '+33', flag: '🇫🇷' },
  { name: 'Gabon', code: '+241', flag: '🇬🇦' },
  { name: 'Gambia', code: '+220', flag: '🇬🇲' },
  { name: 'Georgia', code: '+995', flag: '🇬🇪' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'Ghana', code: '+233', flag: '🇬🇭' },
  { name: 'Greece', code: '+30', flag: '🇬🇷' },
  { name: 'Guatemala', code: '+502', flag: '🇬🇹' },
  { name: 'Guinea', code: '+224', flag: '🇬🇳' },
  { name: 'Haiti', code: '+509', flag: '🇭🇹' },
  { name: 'Honduras', code: '+504', flag: '🇭🇳' },
  { name: 'Hong Kong', code: '+852', flag: '🇭🇰' },
  { name: 'Hungary', code: '+36', flag: '🇭🇺' },
  { name: 'Iceland', code: '+354', flag: '🇮🇸' },
  { name: 'Indonesia', code: '+62', flag: '🇮🇩' },
  { name: 'Iran', code: '+98', flag: '🇮🇷' },
  { name: 'Iraq', code: '+964', flag: '🇮🇶' },
  { name: 'Ireland', code: '+353', flag: '🇮🇪' },
  { name: 'Israel', code: '+972', flag: '🇮🇱' },
  { name: 'Italy', code: '+39', flag: '🇮🇹' },
  { name: 'Jamaica', code: '+1', flag: '🇯🇲' },
  { name: 'Japan', code: '+81', flag: '🇯🇵' },
  { name: 'Jordan', code: '+962', flag: '🇯🇴' },
  { name: 'Kazakhstan', code: '+7', flag: '🇰🇿' },
  { name: 'Kenya', code: '+254', flag: '🇰🇪' },
  { name: 'Kuwait', code: '+965', flag: '🇰🇼' },
  { name: 'Kyrgyzstan', code: '+996', flag: '🇰🇬' },
  { name: 'Laos', code: '+856', flag: '🇱🇦' },
  { name: 'Latvia', code: '+371', flag: '🇱🇻' },
  { name: 'Lebanon', code: '+961', flag: '🇱🇧' },
  { name: 'Lesotho', code: '+266', flag: '🇱🇸' },
  { name: 'Liberia', code: '+231', flag: '🇱🇷' },
  { name: 'Libya', code: '+218', flag: '🇱🇾' },
  { name: 'Liechtenstein', code: '+423', flag: '🇱🇮' },
  { name: 'Lithuania', code: '+370', flag: '🇱🇹' },
  { name: 'Luxembourg', code: '+352', flag: '🇱🇺' },
  { name: 'Macau', code: '+853', flag: '🇲🇴' },
  { name: 'Madagascar', code: '+261', flag: '🇲🇬' },
  { name: 'Malawi', code: '+265', flag: '🇲🇼' },
  { name: 'Malaysia', code: '+60', flag: '🇲🇾' },
  { name: 'Maldives', code: '+960', flag: '🇲🇻' },
  { name: 'Mali', code: '+223', flag: '🇲🇱' },
  { name: 'Malta', code: '+356', flag: '🇲🇹' },
  { name: 'Mauritania', code: '+222', flag: '🇲🇷' },
  { name: 'Mauritius', code: '+230', flag: '🇲🇺' },
  { name: 'Mexico', code: '+52', flag: '🇲🇽' },
  { name: 'Moldova', code: '+373', flag: '🇲🇩' },
  { name: 'Monaco', code: '+377', flag: '🇲🇨' },
  { name: 'Mongolia', code: '+976', flag: '🇲🇳' },
  { name: 'Montenegro', code: '+382', flag: '🇲🇪' },
  { name: 'Morocco', code: '+212', flag: '🇲🇦' },
  { name: 'Mozambique', code: '+258', flag: '🇲🇿' },
  { name: 'Myanmar', code: '+95', flag: '🇲🇲' },
  { name: 'Namibia', code: '+264', flag: '🇳🇦' },
  { name: 'Nepal', code: '+977', flag: '🇳🇵' },
  { name: 'Netherlands', code: '+31', flag: '🇳🇱' },
  { name: 'New Zealand', code: '+64', flag: '🇳🇿' },
  { name: 'Nicaragua', code: '+505', flag: '🇳🇮' },
  { name: 'Niger', code: '+227', flag: '🇳🇪' },
  { name: 'Nigeria', code: '+234', flag: '🇳🇬' },
  { name: 'North Korea', code: '+850', flag: '🇰🇵' },
  { name: 'North Macedonia', code: '+389', flag: '🇲🇰' },
  { name: 'Norway', code: '+47', flag: '🇳🇴' },
  { name: 'Oman', code: '+968', flag: '🇴🇲' },
  { name: 'Pakistan', code: '+92', flag: '🇵🇰' },
  { name: 'Panama', code: '+507', flag: '🇵🇦' },
  { name: 'Papua New Guinea', code: '+675', flag: '🇵🇬' },
  { name: 'Paraguay', code: '+595', flag: '🇵🇾' },
  { name: 'Peru', code: '+51', flag: '🇵🇪' },
  { name: 'Philippines', code: '+63', flag: '🇵🇭' },
  { name: 'Poland', code: '+48', flag: '🇵🇱' },
  { name: 'Portugal', code: '+351', flag: '🇵🇹' },
  { name: 'Qatar', code: '+974', flag: '🇶🇦' },
  { name: 'Romania', code: '+40', flag: '🇷🇴' },
  { name: 'Russia', code: '+7', flag: '🇷🇺' },
  { name: 'Rwanda', code: '+250', flag: '🇷🇼' },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { name: 'Senegal', code: '+221', flag: '🇸🇳' },
  { name: 'Serbia', code: '+381', flag: '🇷🇸' },
  { name: 'Seychelles', code: '+248', flag: '🇸🇨' },
  { name: 'Sierra Leone', code: '+232', flag: '🇸🇱' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'Slovakia', code: '+421', flag: '🇸🇰' },
  { name: 'Slovenia', code: '+386', flag: '🇸🇮' },
  { name: 'Somalia', code: '+252', flag: '🇸🇴' },
  { name: 'South Africa', code: '+27', flag: '🇿🇦' },
  { name: 'South Korea', code: '+82', flag: '🇰🇷' },
  { name: 'South Sudan', code: '+211', flag: '🇸🇸' },
  { name: 'Spain', code: '+34', flag: '🇪🇸' },
  { name: 'Sri Lanka', code: '+94', flag: '🇱🇰' },
  { name: 'Sudan', code: '+249', flag: '🇸🇩' },
  { name: 'Suriname', code: '+597', flag: '🇸🇷' },
  { name: 'Sweden', code: '+46', flag: '🇸🇪' },
  { name: 'Switzerland', code: '+41', flag: '🇨🇭' },
  { name: 'Syria', code: '+963', flag: '🇸🇾' },
  { name: 'Taiwan', code: '+886', flag: '🇹🇼' },
  { name: 'Tajikistan', code: '+992', flag: '🇹🇯' },
  { name: 'Tanzania', code: '+255', flag: '🇹🇿' },
  { name: 'Thailand', code: '+66', flag: '🇹🇭' },
  { name: 'Togo', code: '+228', flag: '🇹🇬' },
  { name: 'Trinidad and Tobago', code: '+1', flag: '🇹🇹' },
  { name: 'Tunisia', code: '+216', flag: '🇹🇳' },
  { name: 'Turkey', code: '+90', flag: '🇹🇷' },
  { name: 'Turkmenistan', code: '+993', flag: '🇹🇲' },
  { name: 'Uganda', code: '+256', flag: '🇺🇬' },
  { name: 'Ukraine', code: '+380', flag: '🇺🇦' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'Uruguay', code: '+598', flag: '🇺🇾' },
  { name: 'Uzbekistan', code: '+998', flag: '🇺🇿' },
  { name: 'Venezuela', code: '+58', flag: '🇻🇪' },
  { name: 'Vietnam', code: '+84', flag: '🇻🇳' },
  { name: 'Yemen', code: '+967', flag: '🇾🇪' },
  { name: 'Zambia', code: '+260', flag: '🇿🇲' },
  { name: 'Zimbabwe', code: '+263', flag: '🇿🇼' },
];

function flagToTwemojiUrl(flagEmoji) {
  const codepoints = Array.from(flagEmoji)
    .map((char) => char.codePointAt(0).toString(16))
    .join('-');
  return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${codepoints}.svg`;
}

function formatMobileIdentity(digits, dialCode) {
  if (!digits) return '';
  const code = dialCode || '+91';
  return `${code}${digits}`;
}

function OpenEyeIcon() {
  return (
    <svg className="ga-eye-svg ga-eye-svg-open" width="30" height="30" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.8 12s3.8-7 10.2-7 10.2 7 10.2 7-3.8 7-10.2 7-10.2-7-10.2-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ClosedEyeIcon() {
  return (
    <svg className="ga-eye-svg ga-eye-svg-closed" width="34" height="34" viewBox="0 0 64 64"
      fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 30C19 44 45 44 56 30" />
      <path d="M16 38L10 46" />
      <path d="M28 43L27 52" />
      <path d="M40 43L41 52" />
      <path d="M50 38L56 46" />
    </svg>
  );
}

// Symbol slots: white boxes colored text | gap | X(bigger) | gap | Verify(biggest) — one line
function ColorSymbolSlots({ symbols, shouldHide, isComplete, onDelete, isBusy }) {
  return (
    <div className="ga-color-slots-row">
      {/* 12 white boxes with colored symbols */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="ga-color-box ga-white-box"
          style={{
            boxShadow: i < symbols.length ? '0 2px 8px rgba(67,97,238,0.18)' : '0 1px 3px rgba(0,0,0,0.07)',
            border: i < symbols.length ? '1.5px solid rgba(67,97,238,0.25)' : '1.5px dashed rgba(67,97,238,0.18)',
          }}
        >
          <span className="ga-color-box-char" style={{ color: i < symbols.length ? BOX_COLORS[i] : '#c5cde8', fontWeight: 800 }}>
            {i < symbols.length ? (shouldHide ? '•' : symbols[i]) : '·'}
          </span>
        </div>
      ))}

      {/* Gap */}
      <div style={{ width: '5px', flexShrink: 0 }} />

      {/* Cross — thoda bada than boxes */}
      <button
        type="button"
        className="ga-action-btn ga-action-delete ga-action-md"
        onClick={onDelete}
        disabled={isBusy || symbols.length === 0}
        title="Delete last"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Gap */}
      <div style={{ width: '4px', flexShrink: 0 }} />

      {/* Verify — sabse bada */}
      <button
        type="button"
        className={`ga-action-btn ga-action-verify ga-action-lg ${isComplete ? 'ga-action-verify-done' : ''}`}
        disabled
        title={isComplete ? 'Complete!' : 'Fill all 12'}
      >
        {isComplete ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3.5" />
          </svg>
        )}
      </button>
    </div>
  );
}

// Mobile number boxes with flag/code toggle, white boxes, colored digits, verify at end
function ColorMobileBoxes({ digits, onRef }) {
  const [showFlag, setShowFlag] = React.useState(true);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  return (
    <div className="ga-mobile-boxes-row" style={{ position: 'relative' }}>
      {/* Country selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, position: 'relative' }}>
        {/* Flag box — full cover */}
        <div className="ga-flag-box" onClick={() => setDropdownOpen((v) => !v)}>
          {showFlag ? (
            <img
              src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f1ee-1f1f3.svg"
              alt="IN"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#4361ee' }}>+91</span>
          )}
        </div>

        {/* Chevron — just floating beside, no box */}
        <svg
          onClick={() => setDropdownOpen((v) => !v)}
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="#4361ee" strokeWidth="2.5" strokeLinecap="round"
          style={{ cursor: 'pointer', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="ga-country-dropdown">
            <div className="ga-country-option" onClick={(e) => { e.stopPropagation(); setShowFlag(true); setDropdownOpen(false); }}>
              <img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f1ee-1f1f3.svg" alt="IN" style={{ width: '22px', height: '22px', objectFit: 'cover', borderRadius: '4px' }} />
              {showFlag && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <div className="ga-country-option" onClick={(e) => { e.stopPropagation(); setShowFlag(false); setDropdownOpen(false); }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#4361ee' }}>+91</span>
              {!showFlag && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
          </div>
        )}
      </div>

      {/* Gap */}
      <div style={{ width: '6px', flexShrink: 0 }} />

      {/* Digit boxes + verify icon — wrapped so the invisible input only covers THIS area, not the flag/dropdown */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
        {/* 10 digit boxes — white, colored text */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="ga-color-box ga-white-box"
            style={{
              boxShadow: i < digits.length ? `0 2px 8px rgba(67,97,238,0.18)` : '0 1px 4px rgba(0,0,0,0.07)',
              border: i < digits.length ? '1.5px solid rgba(67,97,238,0.25)' : '1.5px dashed rgba(67,97,238,0.18)',
            }}
          >
            <span className="ga-color-box-char" style={{ color: i < digits.length ? MOBILE_COLORS[i] : '#c5cde8', fontWeight: 800 }}>
              {i < digits.length ? digits[i] : '·'}
            </span>
          </div>
        ))}

        {/* Verify box — bigger */}
        <div className={`ga-verify-mobile ${digits.length === 10 ? 'ga-verify-mobile-done' : ''}`}>
          {digits.length === 10 ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3" />
            </svg>
          )}
        </div>

        {/* Hidden real input — covers ONLY the digit-boxes + verify area, never the flag/chevron */}
        <input
          ref={onRef}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'text', zIndex: 10, fontSize: '16px',
          }}
        />
      </div>
    </div>
  );
}

// 3D icon wrapper for step headings
function Icon3D({ children }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 54,
      height: 54,
      borderRadius: 18,
      background: 'linear-gradient(145deg, #f0f4ff 0%, #dce5ff 60%, #c5d0fa 100%)',
      boxShadow: '4px 4px 10px rgba(67,97,238,0.18), -2px -2px 6px rgba(255,255,255,0.9), inset 0 1px 2px rgba(255,255,255,0.8)',
      margin: '0 auto 10px auto',
    }}>
      {children}
    </span>
  );
}

// 3D circle for symbol/digit boxes — shiny white with inner glow
// Size passed as prop so mobile (10+verify) and symbol (12) can auto-size
function Circle3D({ char, color, filled, size = 26 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      background: filled
        ? 'radial-gradient(circle at 35% 30%, #ffffff 0%, #f0f2ff 55%, #dce2ff 100%)'
        : 'radial-gradient(circle at 35% 30%, #ffffff 0%, #f5f5f5 60%, #e8e8e8 100%)',
      boxShadow: filled
        ? '3px 3px 7px rgba(67,97,238,0.22), -2px -2px 5px rgba(255,255,255,0.95), inset 0 1px 2px rgba(255,255,255,0.9)'
        : '2px 2px 5px rgba(0,0,0,0.12), -1px -1px 3px rgba(255,255,255,0.95), inset 0 1px 1px rgba(255,255,255,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'box-shadow 0.2s',
    }}>
      <span style={{
        fontSize: Math.round(size * 0.42),
        fontWeight: 800,
        lineHeight: 1,
        color: filled ? color : '#d0d5e8',
        userSelect: 'none',
        textShadow: filled ? `0 1px 2px rgba(0,0,0,0.08)` : 'none',
      }}>
        {filled ? char : '·'}
      </span>
    </div>
  );
}

// Green 3D verify circle — bigger than digit circles
function VerifyCircle3D({ done }) {
  return (
    <div style={{
      width: 38,
      height: 38,
      borderRadius: '50%',
      flexShrink: 0,
      background: done
        ? 'radial-gradient(circle at 35% 28%, #7effd4 0%, #2ED573 45%, #1abc9c 100%)'
        : 'radial-gradient(circle at 35% 30%, #ffffff 0%, #efefef 60%, #d8d8d8 100%)',
      boxShadow: done
        ? '4px 4px 10px rgba(46,213,115,0.45), -3px -3px 7px rgba(255,255,255,0.95), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.08)'
        : '3px 3px 7px rgba(0,0,0,0.12), -2px -2px 5px rgba(255,255,255,0.95), inset 0 1px 2px rgba(255,255,255,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s',
      animation: done ? 'ga-verify-pop 0.35s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
    }}>
      {done ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b0b8d0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3" />
        </svg>
      )}
    </div>
  );
}

// Red 3D delete circle
function DeleteCircle3D({ onClick, disabled }) {
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        flexShrink: 0,
        background: disabled
          ? 'radial-gradient(circle at 35% 30%, #f5f5f5 0%, #e8e8e8 100%)'
          : 'radial-gradient(circle at 35% 30%, #ff8fa0 0%, #FF4757 55%, #c0392b 100%)',
        boxShadow: disabled
          ? '2px 2px 5px rgba(0,0,0,0.08), -1px -1px 3px rgba(255,255,255,0.9)'
          : '3px 3px 8px rgba(255,71,87,0.4), -2px -2px 5px rgba(255,255,255,0.9), inset 0 1px 2px rgba(255,255,255,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        transition: 'all 0.2s',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={disabled ? '#b0b8d0' : '#fff'} strokeWidth="3.2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </div>
  );
}

// Symbol slots — 12 circles in one line, flex stretch so all 12 always visible
function ColorSymbolSlots({ symbols, shouldHide, isComplete, onDelete, isBusy }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      width: '100%',
      margin: '8px 0 4px 0',
      flexWrap: 'nowrap',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
          <Circle3D
            char={i < symbols.length ? (shouldHide ? '•' : symbols[i]) : ''}
            color={BOX_COLORS[i]}
            filled={i < symbols.length}
            size={24}
          />
        </div>
      ))}
    </div>
  );
}

// Mobile boxes — flag + 10 digit circles + green verify circle, all in one line
function ColorMobileBoxes({ digits, onRef, selectedCountry, onSelectCountry }) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  // Calculate circle size dynamically: available width after flag (~54px) and verify (~42px)
  // We use CSS flex with minWidth:0 and let circles be exactly sized via flex
  const CIRCLE_SIZE = 24; // slightly smaller so 10 + verify all fit

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      width: '100%',
      margin: '8px 0 10px 0',
      flexWrap: 'nowrap',
      overflow: 'visible',
      cursor: 'text',
      position: 'relative',
      boxSizing: 'border-box',
    }}>
      {/* Country selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, position: 'relative' }}>
        <div className="ga-flag-box" onClick={() => setDropdownOpen((v) => !v)}>
          <img
            src={flagToTwemojiUrl(selectedCountry.flag)}
            alt={selectedCountry.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
        <svg
          onClick={() => setDropdownOpen((v) => !v)}
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="#4361ee" strokeWidth="2.5" strokeLinecap="round"
          style={{ cursor: 'pointer', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {dropdownOpen && (
          <div className="ga-country-dropdown">
            {COUNTRIES.map((c) => (
              <div
                key={c.name}
                className="ga-country-option"
                onClick={() => { onSelectCountry(c); setDropdownOpen(false); }}
              >
                <img src={flagToTwemojiUrl(c.flag)} alt={c.name} style={{ width: '22px', height: '16px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} />
                <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ color: '#4361ee', fontWeight: 700 }}>{c.code}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Digit circles + verify — with hidden input overlay, all in one row */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
      }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
            <Circle3D
              char={i < digits.length ? digits[i] : ''}
              color={MOBILE_COLORS[i]}
              filled={i < digits.length}
              size={CIRCLE_SIZE}
            />
          </div>
        ))}

        {/* Green verify circle — bigger, beside the digits */}
        <div style={{ flexShrink: 0 }}>
          <VerifyCircle3D done={digits.length === 10} />
        </div>

        {/* Hidden input covering only this area */}
        <input
          ref={onRef}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'text', zIndex: 10, fontSize: '16px',
          }}
        />
      </div>
    </div>
  );
}

export default function GloobalAccess({ onComplete }) {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [secureSymbols, setSecureSymbols] = useState([]);
  const [referrerSymbols, setReferrerSymbols] = useState([]);
  const [activeField, setActiveField] = useState('secure');
  const [hideSecure, setHideSecure] = useState(false);
  const [hideReferrer, setHideReferrer] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const mobileInputRef = React.useRef(null);

  const [hearts, setHearts] = useState([]);
  const [isBeating, setIsBeating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now() + Math.random();
      const randomColor = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
      const randomX = (Math.random() * 80 - 40) + 'px';
      setIsBeating(true);
      setTimeout(() => setIsBeating(false), 250);
      setHearts((prev) => [...prev, { id, color: randomColor, randomX }]);
      setTimeout(() => { setHearts((prev) => prev.filter((h) => h.id !== id)); }, 3500);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const mobileDigits = mobile.replace(/\D/g, '').slice(0, 10);
  const mobileIdentity = useMemo(() => formatMobileIdentity(mobileDigits, selectedCountry.code), [mobileDigits, selectedCountry]);

  const secureId = secureSymbols.join('');
  const referredBy = referrerSymbols.join('');

  const isMobileValid = mobileDigits.length === 10;
  const isOtpValid = otp === PROTOTYPE_OTP;

  const currentFieldIsSecure = activeField === 'secure';
  const activeSymbols = currentFieldIsSecure ? secureSymbols : referrerSymbols;
  const currentFieldIsHidden = currentFieldIsSecure ? hideSecure : hideReferrer;
  const currentFieldLabel = currentFieldIsSecure ? 'Secure ID' : 'Referral ID';
  const eyeButtonLabel = currentFieldIsHidden ? `Show ${currentFieldLabel}` : `Hide ${currentFieldLabel}`;

  const updateActiveSymbols = (nextSymbols) => {
    if (currentFieldIsSecure) { setSecureSymbols(nextSymbols); return; }
    setReferrerSymbols(nextSymbols);
  };

  const handleSymbolPress = (symbol) => {
    if (busy) return;
    if (activeSymbols.length >= 12) {
      setStatus(currentFieldIsSecure ? 'Secure ID already has 12 symbols.' : 'Referral ID already has 12 symbols.');
      setStatus(currentFieldIsSecure ? 'Secure ID already has 12 symbols.' : 'Referral ID already has 12 symbols.');
      return;
    }
    updateActiveSymbols([...activeSymbols, symbol]);
    setStatus('');
  };

  const handleClear = () => {
    if (busy) return;
    updateActiveSymbols([]);
    setStatus('');
  };

  const handleToggleVisibility = () => {
    if (busy) return;
    if (activeField === 'secure') setHideSecure((v) => !v);
    if (activeField === 'referrer') setHideReferrer((v) => !v);
    setStatus('');
  };

  const handleMobileChange = (event) => {
    const nextMobile = event.target.value;
    const nextDigits = nextMobile.replace(/\D/g, '');
    setMobile(nextMobile);
    setStatus('');
    if (nextDigits.length < 10 && otp) setOtp('');
  };

  const handleOtpChange = (event) => {
    const nextOtp = event.target.value.replace(/\D/g, '').slice(0, 4);
    setOtp(nextOtp);
    setStatus('');
  };

  useEffect(() => {
    if (step === 1 && isMobileValid && isOtpValid) {
      const timer = setTimeout(() => {
        setStatus('');
        setStep(2);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step, isMobileValid, isOtpValid]);

  const deleteLastSecureSymbol = (e) => {
    e && e.stopPropagation();
    if (busy || secureSymbols.length === 0) return;
    setSecureSymbols((s) => s.slice(0, -1));
    setStatus('');
  };

  const deleteLastReferralSymbol = (e) => {
    e && e.stopPropagation();
    if (busy || referrerSymbols.length === 0) return;
    setReferrerSymbols((s) => s.slice(0, -1));
    setStatus('');
  };

  const handleSubmit = async () => {
    if (secureSymbols.length !== 12) { alert('Please complete all 12 symbols for Secure ID.'); return; }
    if (referrerSymbols.length > 0 && referrerSymbols.length !== 12) {
      alert('Referral ID is optional, but if entered it must be 12 symbols.');
      return;
    }
    const userData = { fullName: mobileIdentity, symbolId: secureId, referredBy: referredBy || '' };
    setBusy(true);
    setStatus('Checking Secure ID...');
    try {
      const response = await axios.post(`${API_BASE}/api/register-symbol`, userData);
      const savedUser = response.data?.user || userData;
      const nextUser = {
        fullName: savedUser.fullName || mobileIdentity,
        mobileNumber: mobileIdentity,
        symbolId: savedUser.symbolId || secureId,
        referralCount: savedUser.referralCount || 0,
        referredBy: savedUser.referredBy || referredBy || null,
        hasPasskey: Boolean(savedUser.hasPasskey)
      };
      setRegisteredUser(nextUser);
      if (response.data?.alreadyRegistered) {
        setStatus('Secure ID already registered. Continuing to login...');
      } else {
        setStatus('Registration complete. Continuing...');
      }
      setTimeout(() => { if (typeof onComplete === 'function') onComplete(nextUser); }, 1200);
    } catch (err) {
      console.error('Registration saving error:', err);
      const message = err.response?.data?.message || 'Could not connect to server. Please try again.';
      setStatus(message);
      alert(message);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = isMobileValid && isOtpValid && secureSymbols.length === 12 && !busy;

  return (
    <div className="ga-wrapper">
      <style>{`
        .ga-wrapper {
          background: #ffffff !important;
          min-height: 100vh;
        }
        .ga-shell {
          background: #ffffff !important;
        }

        /* Flag box */
        .ga-flag-box {
          width: 44px;
          height: 36px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          cursor: pointer;
          box-shadow: 3px 3px 8px rgba(0,0,0,0.15), -2px -2px 5px rgba(255,255,255,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f3ff;
        }

        /* Country dropdown */
        .ga-country-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          background: #fff !important;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(67,97,238,0.18);
          border: 1px solid rgba(67,97,238,0.12);
          overflow-y: auto;
          max-height: 240px;
          z-index: 100;
          min-width: 200px;
        }
        .ga-country-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          cursor: pointer;
          font-size: 13px;
          color: #2d3142;
          font-weight: 500;
          transition: background 0.15s;
          background: #fff !important;
        }
        .ga-country-option:hover { background: rgba(67,97,238,0.07) !important; }
        .ga-country-option:not(:last-child) { border-bottom: 1px solid rgba(67,97,238,0.08); }

        /* Verified tick badge */
        .ga-verified-tick {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2ED573, #1abc9c);
          color: #fff;
          flex-shrink: 0;
          animation: ga-verify-pop 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }
        .ga-verified-tick-inline {
          margin-left: 6px;
          vertical-align: middle;
        }

        @keyframes ga-verify-pop {
          0% { transform: scale(0.7); }
          100% { transform: scale(1); }
        }

        .ga-otp-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #4361ee;
          background: rgba(67,97,238,0.07);
          border-radius: 20px;
          padding: 5px 12px;
          margin-bottom: 16px;
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        .ga-brand-text {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #1a1f36;
          font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;
        }

        .ga-heading {
          font-size: 28px;
          font-weight: 400;
          line-height: 1.3;
          color: #2d3142;
          margin: 0 0 24px 0;
          text-align: center;
          font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;
          letter-spacing: -0.01em;
        }
        .ga-heading strong {
          font-weight: 700;
          color: #4361ee;
          display: block;
          font-size: 32px;
          letter-spacing: -0.02em;
        }

        .ga-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 28px;
          padding: 0 4px;
        }

        .ga-step-view {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }

        /* id-box */
        .ga-id-box {
          background: #ffffff !important;
          overflow: visible !important;
          width: 100%;
          padding: 14px 16px 12px 16px;
          box-sizing: border-box;
        }
        .ga-id-box-active {
          border-color: rgba(67,97,238,0.35) !important;
          box-shadow: 0 0 0 3px rgba(67,97,238,0.08) !important;
        }

        /* Hearts */
        .static-footer-master-heart {
          position: relative;
          display: inline-block;
          font-size: 19px;
          z-index: 40;
          transition: transform 0.2s ease;
        }
        .static-footer-master-heart.beating { transform: scale(1.3); }
        .ga-automatic-colored-heart {
          position: absolute;
          left: 50%;
          top: 50%;
          font-size: 13px;
          pointer-events: none;
          z-index: 10;
          animation: ga-heart-shoot-up 3.5s cubic-bezier(0.1,0.65,0.25,1) forwards;
        }
        @keyframes ga-heart-shoot-up {
          0%   { transform: translate(-50%,-50%) scale(0.3); opacity: 0; }
          12%  { opacity: 1; transform: translate(-50%,-35px) scale(1.1); }
          100% { transform: translate(calc(-50% + var(--drift-x,0px)),-120vh) scale(0.75) rotate(20deg); opacity: 0; }
        }
      `}</style>

      <style>{`
        /* ── Force white background everywhere ── */
        .ga-wrapper {
          background: #ffffff !important;
          min-height: 100vh;
        }
        .ga-shell {
          background: #ffffff !important;
        }

        /* ── Color boxes — one line, no scroll ── */
        .ga-color-slots-row {
          display: flex;
          align-items: center;
          gap: 3px;
          width: 100%;
          margin: 8px 0 4px 0;
          flex-wrap: nowrap;
          overflow: hidden;
        }
        .ga-color-box {
          flex: 1 1 0;
          min-width: 0;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, box-shadow 0.2s;
        }
        .ga-color-box-char {
          font-size: 12px;
          font-weight: 800;
          line-height: 1;
          user-select: none;
        }

        /* ── Action buttons inline ── */
        .ga-action-btn {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .ga-action-delete {
          background: linear-gradient(135deg, #ff4757, #ff6b81);
          color: #fff;
          box-shadow: 0 3px 8px rgba(255,71,87,0.4);
        }
        .ga-action-delete:hover:not(:disabled) { transform: scale(1.1); }
        .ga-action-delete:disabled { opacity: 0.35; cursor: not-allowed; }
        .ga-action-verify {
          background: rgba(67,97,238,0.1);
          color: #a0aec0;
          cursor: default;
        }
        .ga-action-verify-done {
          background: linear-gradient(135deg, #2ED573, #1abc9c);
          color: #fff;
          box-shadow: 0 3px 8px rgba(46,213,115,0.45);
          animation: ga-verify-pop 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes ga-verify-pop {
          0% { transform: scale(0.7); }
          100% { transform: scale(1); }
        }

        /* ── Mobile boxes — one line, no scroll ── */
        .ga-mobile-boxes-row {
          display: flex;
          align-items: center;
          gap: 3px;
          width: 100%;
          margin: 8px 0 10px 0;
          flex-wrap: nowrap;
          overflow: visible;
          cursor: text;
        }

        /* ── White shiny box ── */
        .ga-white-box {
          background: #ffffff !important;
        }
        /* ── id-box pure white bg ── */
        .ga-id-box {
          background: #ffffff !important;
        }

        /* ── Country selector ── */
        /* Flag box — pure image, no padding */
        .ga-flag-box {
          width: 44px;
          height: 36px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f3ff;
        }

        .ga-country-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(67,97,238,0.18);
          border: 1px solid rgba(67,97,238,0.12);
          overflow: hidden;
          z-index: 100;
          min-width: 110px;
        }
        .ga-country-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          cursor: pointer;
          font-size: 13px;
          color: #2d3142;
          font-weight: 500;
          transition: background 0.15s;
        }
        .ga-country-option:hover { background: rgba(67,97,238,0.07); }
        .ga-country-option:not(:last-child) { border-bottom: 1px solid rgba(67,97,238,0.08); }

        /* ── Mobile verify box ── */
        .ga-verify-mobile {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: rgba(67,97,238,0.08);
          color: #a0aec0;
          transition: all 0.3s;
        }
        .ga-verify-mobile-done {
          background: linear-gradient(135deg, #2ED573, #1abc9c);
          color: #fff;
          box-shadow: 0 4px 12px rgba(46,213,115,0.4);
          animation: ga-verify-pop 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }

        /* ── Action button size variants ── */
        .ga-action-md {
          width: 28px !important;
          height: 28px !important;
        }
        .ga-action-lg {
          width: 36px !important;
          height: 36px !important;
          border-radius: 11px !important;
        }
        /* ── Mobile verify bigger ── */
        .ga-verify-mobile {
          width: 38px !important;
          height: 38px !important;
          border-radius: 11px !important;
        }

        /* ── id-box stretch ── */
        .ga-id-box {
          width: 100%;
          padding: 14px 16px 12px 16px;
          box-sizing: border-box;
        }

        /* ── OTP hint ── */
        .ga-otp-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #4361ee;
          background: rgba(67,97,238,0.07);
          border-radius: 20px;
          padding: 5px 12px;
          margin-bottom: 16px;
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        /* ── Heading icon ── */
        .ga-heading-icon {
          display: flex;
          margin: 0 auto 10px auto;
          width: 54px;
          height: 54px;
          background: rgba(67,97,238,0.08);
          border-radius: 16px;
          align-items: center;
          justify-content: center;
        }

        /* ── Brand text ── */
        .ga-brand-text {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #1a1f36;
          font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;
        }

        /* ── Page headings ── */
        .ga-heading {
          font-size: 28px;
          font-weight: 400;
          line-height: 1.3;
          color: #2d3142;
          margin: 0 0 24px 0;
          text-align: center;
          font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;
          letter-spacing: -0.01em;
        }
        .ga-heading strong {
          font-weight: 700;
          color: #4361ee;
          display: block;
          font-size: 32px;
          letter-spacing: -0.02em;
        }

        /* ── Brand block spacing ── */
        .ga-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 28px;
          padding: 0 4px;
        }

        /* ── Step view ── */
        .ga-step-view {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }

        /* ── Arrow CTA (slide to continue) ── */
        .ga-arrow-cta {
          position: relative;
          background: linear-gradient(135deg, #4361ee, #5352ED) !important;
          border-radius: 50px !important;
          height: 56px !important;
          overflow: hidden !important;
          cursor: pointer;
          padding: 0 !important;
        }
        .ga-arrow-cta:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ga-arrow-track {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          position: relative;
        }
        .ga-arrow-thumb {
          width: 44px;
          height: 44px;
          background: rgba(255,255,255,0.22);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          animation: ga-arrow-pulse 1.5s ease-in-out infinite;
        }
        .ga-arrow-cta:not(:disabled):hover .ga-arrow-thumb {
          background: rgba(255,255,255,0.35);
          transform: scale(1.1);
          transition: all 0.2s;
        }
        @keyframes ga-arrow-pulse {
          0%, 100% { transform: translateX(0); opacity: 1; }
          50% { transform: translateX(6px); opacity: 0.85; }
        }

        /* ── Hearts ── */
        .static-footer-master-heart {
          position: relative;
          display: inline-block;
          font-size: 26px;
          z-index: 40;
          transition: transform 0.2s ease;
        }
        .static-footer-master-heart.beating { transform: scale(1.3); }
        .ga-automatic-colored-heart {
          position: absolute;
          left: 50%;
          top: 50%;
          font-size: 13px;
          pointer-events: none;
          z-index: 10;
          animation: ga-heart-shoot-up 3.5s cubic-bezier(0.1,0.65,0.25,1) forwards;
        }
        @keyframes ga-heart-shoot-up {
          0%   { transform: translate(-50%,-50%) scale(0.3); opacity: 0; }
          12%  { opacity: 1; transform: translate(-50%,-35px) scale(1.1); }
          100% { transform: translate(calc(-50% + var(--drift-x,0px)),-120vh) scale(0.75) rotate(20deg); opacity: 0; }
        }
      `}</style>

      <div className="ga-shell">
        {registeredUser ? (
          <div className="ga-success">
            <div className="ga-step-bar">
              <div className="ga-segment ga-done" />
              <div className="ga-segment ga-done" />
            </div>
            <div className="ga-success-orb">{'\u2713'}</div>
            <h1 className="ga-heading">
              Mobile identity<br />
              <strong>connected</strong>
            </h1>
            <div className="ga-summary-card"><span>Mobile</span><strong>{registeredUser.mobileNumber || registeredUser.fullName}</strong></div>
            <div className="ga-summary-card"><span>Secure ID</span><strong>{registeredUser.symbolId}</strong></div>
            {registeredUser.referredBy && (
              <div className="ga-summary-card"><span>Referral ID</span><strong>{registeredUser.referredBy}</strong></div>
            )}
            <p className="ga-status">Preparing device authentication...</p>
          </div>
        ) : (
          <>
            <div className="ga-step-bar">
              <div className={`ga-segment ${step >= 1 ? 'ga-active' : ''} ${step > 1 ? 'ga-done' : ''}`} />
              <div className={`ga-segment ${step >= 2 ? 'ga-active' : ''}`} />
            </div>

            {/* Brand only on step 1 */}
            {step === 1 && (
              <div className="ga-brand">
                <div className="ga-logo-circle" aria-label="Gloobal logo">
                  <img src="/pwa-512x512.jpeg" alt="Gloobal logo" className="ga-logo-img" />
                </div>
                <div className="ga-brand-text">Gloobal Access</div>
              </div>
            )}

            {step === 1 && (
              <div className="ga-step-view ga-step-enter">
                <h1 className="ga-heading">
                  {/* 3D icon */}
                  <Icon3D>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" />
                      <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="3" />
                    </svg>
                  </Icon3D>
                  <strong style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    Mobile Number
                    <span style={{
                      fontSize: 38,
                      fontWeight: 900,
                      color: '#4361ee',
                      lineHeight: 1,
                      flexShrink: 0,
                    }}>?</span>
                  </strong>
                </h1>

                <div className="ga-id-box" style={{ marginBottom: '12px' }} onClick={() => mobileInputRef.current && mobileInputRef.current.focus()}>
                  <div className="ga-id-top">
                    <span>Mobile Number</span>
                    <small style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {isMobileValid && (
                        <span className="ga-verified-tick" title="Mobile verified">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                      {mobileDigits.length} / 10
                    </small>
                  </div>
                  <ColorMobileBoxes
                    digits={mobileDigits}
                    selectedCountry={selectedCountry}
                    onSelectCountry={setSelectedCountry}
                    onRef={(el) => {
                      mobileInputRef.current = el;
                      if (el) {
                        el.value = mobile;
                        el.oninput = (ev) => handleMobileChange({ target: { value: ev.target.value } });
                      }
                    }}
                  />
                </div>

                <div className="ga-otp-hint">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <circle cx="9" cy="10" r="1" fill="#4361ee" />
                    <circle cx="12" cy="10" r="1" fill="#4361ee" />
                    <circle cx="15" cy="10" r="1" fill="#4361ee" />
                  </svg>
                  <span>OTP sent via SMS</span>
                </div>

                <div className="ga-field-block">
                  <label className="ga-label" htmlFor="otpInput">
                    OTP Code
                    {isOtpValid && (
                      <span className="ga-verified-tick ga-verified-tick-inline" title="OTP verified">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </label>
                  <input
                    id="otpInput" type="tel" inputMode="numeric" className="ga-input"
                    value={otp} onChange={handleOtpChange}
                    placeholder="0000" autoComplete="one-time-code"
                    disabled={!isMobileValid || busy}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="ga-step-view ga-step-enter">
                <h1 className="ga-heading">
                  {/* 3D icon — no brand above, icon acts as visual anchor */}
                  <Icon3D>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      <circle cx="12" cy="16" r="1.5" fill="#4361ee" />
                    </svg>
                  </Icon3D>
                  Choose 
                  <br />
                  <strong>Symbolic ID</strong>
                </h1>

                {/* Secure ID box */}
                <div
                  className={`ga-id-box ${activeField === 'secure' ? 'ga-id-box-active' : ''}`}
                  onClick={() => setActiveField('secure')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveField('secure'); }}
                  role="button" tabIndex={0}
                >
                  <div className="ga-id-top">
                    <span>12-Symbol Secure ID</span>
                    <small>{secureSymbols.length} / 12</small>
                  </div>
                  <ColorSymbolSlots
                    symbols={secureSymbols}
                    shouldHide={hideSecure}
                    isComplete={secureSymbols.length === 12}
                    onDelete={deleteLastSecureSymbol}
                    isBusy={busy}
                  />
                </div>

                {/* Referral ID box */}
                <div
                  className={`ga-id-box ${activeField === 'referrer' ? 'ga-id-box-active' : ''}`}
                  onClick={() => setActiveField('referrer')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveField('referrer'); }}
                  role="button" tabIndex={0}
                  style={{ marginTop: '10px' }}
                >
                  <div className="ga-id-top">
                    <span>Referral ID</span>
                    <small>{referrerSymbols.length} / 12 optional</small>
                  </div>
                  <ColorSymbolSlots
                    symbols={referrerSymbols}
                    shouldHide={hideReferrer}
                    isComplete={referrerSymbols.length === 12}
                    onDelete={deleteLastReferralSymbol}
                    isBusy={busy}
                  />
                </div>


                {/* Undo button — replaces old "Editing / Clear" row */}
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', margin: '10px 0 4px 0' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (busy) return;
                      if (currentFieldIsSecure) deleteLastSecureSymbol();
                      else deleteLastReferralSymbol();
                    }}
                    disabled={busy || activeSymbols.length === 0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '8px 18px 8px 14px',
                      borderRadius: 50,
                      border: 'none',
                      background: activeSymbols.length === 0 || busy
                        ? 'radial-gradient(circle at 35% 30%, #f5f5f5 0%, #e8e8e8 100%)'
                        : 'radial-gradient(circle at 35% 28%, #ff9aaa 0%, #FF4757 50%, #c0392b 100%)',
                      boxShadow: activeSymbols.length === 0 || busy
                        ? '2px 2px 5px rgba(0,0,0,0.08), -1px -1px 3px rgba(255,255,255,0.9)'
                        : '3px 3px 9px rgba(255,71,87,0.38), -2px -2px 5px rgba(255,255,255,0.9), inset 0 1px 2px rgba(255,255,255,0.3)',
                      cursor: activeSymbols.length === 0 || busy ? 'not-allowed' : 'pointer',
                      opacity: activeSymbols.length === 0 || busy ? 0.4 : 1,
                      transition: 'all 0.2s',
                      fontSize: 13,
                      fontWeight: 700,
                      color: activeSymbols.length === 0 || busy ? '#b0b8d0' : '#fff',
                      letterSpacing: 0.3,
                    }}
                  >
                    {/* Undo arrow icon */}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                      stroke={activeSymbols.length === 0 || busy ? '#b0b8d0' : '#fff'}
                      strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 14 4 9 9 4" />
                      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                    </svg>
                    Undo
                  </button>
                </div>

                <div className="ga-dial" aria-label="Symbol dialpad">
                  {SYMBOL_KEYS.map((symbol, index) => (
                    <button key={symbol} type="button"
                      className={`ga-dial-key ga-dial-key-${index}`}
                      onClick={() => handleSymbolPress(symbol)}
                      disabled={busy || activeSymbols.length >= 12}>
                      {symbol}
                    </button>
                  ))}
                  <button type="button"
                    className={`ga-dial-center ga-dial-eye ${currentFieldIsHidden ? 'ga-eye-closed' : 'ga-eye-open'}`}
                    onClick={handleToggleVisibility} disabled={busy}
                    aria-label={eyeButtonLabel} title={eyeButtonLabel}>
                    {currentFieldIsHidden ? <ClosedEyeIcon /> : <OpenEyeIcon />}
                  </button>
                </div>

                <button type="button" className="ga-main-cta" disabled={!canSubmit} onClick={handleSubmit}>
                  {busy ? 'Please wait...' : 'Register & Continue'}
                </button>

                <button type="button" className="ga-back-btn"
                  onClick={() => { setStep(1); setStatus(''); }} disabled={busy}>
                  {'\u2190'} Back
                </button>
              </div>
            )}

            {status && <p className="ga-status">{status}</p>}

            <div className="ga-footer">
              <span className={`static-footer-master-heart ${isBeating ? 'beating' : ''}`}>
                ❤️
                {hearts.map((h) => (
                  <span key={h.id} className="ga-automatic-colored-heart" style={{ '--drift-x': h.randomX }}>
                    {h.color}
                  </span>
                ))}
              </span>{' '}
              from भारत
            </div>
          </>
        )}
      </div>
    </div>
  );
}