import React, { useState } from 'react';
import axios from 'axios';
import './GloobalAccess.css';

export default function GloobalAccess({ onComplete }) {
  const [name, setName] = useState('');
  const [referrer, setReferrer] = useState('');
  const [symbols, setSymbols] = useState([]);
  const [isHidden, setIsHidden] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const keys = ['+', '-', '×', '=', '□', '■', '○', '●'];

  const handleKeyPress = (char) => {
    if (symbols.length < 12) {
      setSymbols([...symbols, char]);
    }
  };

  const handleDelete = () => {
    setSymbols(symbols.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (symbols.length > 0 && name.trim() !== '') {
      const userData = {
        symbolId: symbols.join(''),
        fullName: name.trim(),
        referredBy: referrer.trim()
      };

      try {
        await axios.post('https://gloobal-pay.onrender.com/api/register-symbol', userData);

        setRegisteredUser(userData);

        setTimeout(() => {
          onComplete(userData);
        }, 2500);
      } catch (err) {
        console.error("Registration saving error:", err);
        alert(err.response?.data?.message || "Could not connect to server. Please try again.");
      }
    } else {
      alert("Please enter your Documented Name and at least 1 symbol.");
    }
  };

  const renderDisplay = () => {
    const slots = [];

    for (let i = 0; i < 12; i++) {
      if (i < symbols.length) {
        slots.push(<span key={i}>{isHidden ? '*' : symbols[i]}</span>);
      } else {
        slots.push(<span key={i} className="ga-empty-slot">-</span>);
      }
    }

    return slots;
  };

  return (
    <div className="ga-wrapper">
      <div className="ga-card">

        {registeredUser ? (
          <div className="ga-welcome-view">
            <div className="ga-welcome-avatar">👋</div>
            <h2 className="ga-welcome-name">Welcome, {registeredUser.fullName}</h2>
            <p className="ga-subtitle">@{registeredUser.symbolId}</p>
            <div className="ga-welcome-status">Registration Complete</div>
            <p className="ga-footer ga-welcome-footer">
              Preparing hardware authentication secures your profile...
            </p>
          </div>
        ) : (
          <>
            <div className="ga-brand">
              <div className="ga-logo-circle">
                <img
                  src="/pwa-512x512.jpeg"
                  alt="Gloobal logo"
                  className="ga-logo-img"
                />
              </div>

              <h2 className="ga-title">Gloobal Access</h2>
            </div>

            <input
              type="text"
              className="ga-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Documented Name"
            />

            <div>
              <div className="ga-id-header">
                <span>12-Symbol Secure ID</span>
                <span>{symbols.length} / 12</span>
              </div>

              <div
                className="ga-display-box"
                onClick={() => setShowKeyboard(true)}
                onKeyDown={() => setShowKeyboard(true)}
                role="button"
                tabIndex={0}
              >
                <div className="ga-symbols">{renderDisplay()}</div>

                <button
                  type="button"
                  className="ga-hide-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsHidden(!isHidden);
                  }}
                >
                  {isHidden ? '🙈' : '🐵'}
                </button>
              </div>

              {!showKeyboard && (
                <p className="ga-keyboard-hint">
                  Tap Secure ID box to open symbolic keyboard
                </p>
              )}
            </div>

            <input
              type="text"
              className="ga-input"
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              placeholder="Referrer Wallet (Optional)"
            />

            {showKeyboard && (
              <div className="ga-keypad-container">
                <div className="ga-grid">
                  {keys.map((char) => (
                    <button
                      key={char}
                      type="button"
                      onClick={() => handleKeyPress(char)}
                      className="ga-btn"
                    >
                      {char}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleDelete}
                    className="ga-btn ga-btn-del"
                  >
                    ⌫
                  </button>

                  <button
                    type="button"
                    onClick={() => handleKeyPress('Φ')}
                    className="ga-btn ga-btn-phi"
                  >
                    Φ
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="ga-btn ga-btn-submit"
                  >
                    ⇆
                  </button>
                </div>
              </div>
            )}

            <div className="ga-footer">
              <span>❤️</span> from भारत
            </div>
          </>
        )}

      </div>
    </div>
  );
}