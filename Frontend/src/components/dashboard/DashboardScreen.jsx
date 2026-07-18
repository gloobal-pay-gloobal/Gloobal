import React, { useState } from "react";
import {
  Search,
  User,
  Copy,
  X,
  ChevronRight,
  ArrowLeft,
  Home,
  Users2,
  Share2,
  Gift,
  Store,
  Info,
} from "lucide-react";
import { CardAmbientField, DashboardAmbientBg, SendMoneyAmbientBg } from "../backgrounds/FinancialAmbient";
import { POSITION_COLORS } from "../common/CodeEntry";
import { FlagEmoji } from "../common/FlagComponents";
import { ChevronRightIcon, EyeIcon, HomeTabIcon, LogoutIcon, ProfileTabIcon, RotatingGlobeIcon } from "../common/Icons";
import { BILL_ACTIONS, DASHBOARD_ACTIONS, PROFILE_ROWS, generateReferralNetwork } from "../../constants/dashboardData";
import { T } from "../../styles/theme";

function DashboardScreenBase({ dialCountry, onLogout, onOpenSend, onOpenBank, onOpenCoverage, myGloobalId }) {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [activeTab, setActiveTab] = useState("home"); // home | profile
  const [showIdTag, setShowIdTag] = useState(false);
  const [toast, setToast] = useState(null);
  const [showReceive, setShowReceive] = useState(false);
  // null | "share" | "referral" — full-screen overlays opened from the
  // Profile tab, layered above the tab bar the same way Send/Bank/Coverage
  // sit above the dashboard itself.
  const [profileOverlay, setProfileOverlay] = useState(null);
  // The referral member whose earnings breakdown card is currently open —
  // tapping a row in "My Referral Network" opens this, tapping the backdrop
  // or the close button clears it back to null.
  const [selectedMember, setSelectedMember] = useState(null);
  // Whether the "How your network works" explanation card is open —
  // opened from the option that replaced the old "Invite a friend" CTA.
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const balance = "12,480.50";

  // A masked Gloobal ID built from the person's own country/dial code, shown
  // when they tap the flag on the balance card — the digits stay hidden
  // behind a run of "+" marks, matching the app's mark.
  const gloobalIdTag = `${dialCountry.iso}${dialCountry.dialCode.replace("+", "")}++++++++++++`;

  // The full 12-symbol Secure ID set at registration, used for the Profile
  // tab's "Share your Gloobal ID" screen. Falls back to a run of "+" the
  // same length if it isn't available yet, rather than showing nothing.
  const shareableGloobalId = myGloobalId && myGloobalId.length === 12 ? myGloobalId : "++++++++++++";

  // The Gloobal ID doubles as the referral code, so every share/invite path
  // resolves to one direct link — no separate referral code to manage.
  // Swap this base URL for the real deep-link domain when it exists.
  const referralLink = `https://gloobal.id/r/${shareableGloobalId}`;

  // A random placeholder profile photo, picked once per session rather than
  // re-randomizing on every render.
  const [avatarSeed] = useState(() => Math.floor(Math.random() * 70) + 1);

  // 5 random referrals — a fresh mix of names, countries, and today's
  // earnings each time the Referral Network screen loads.
  const [referralNetwork] = useState(() => generateReferralNetwork());

  // Which profile this Gloobal ID is acting as when it's shared — "user"
  // for personal spending (bills, transfers to friends/family) or
  // "merchant" for business takings (shop sales, invoices). Flipping this
  // is the same quick rotateY flip used for the Secure ID / Referral card
  // during registration. Whichever side is showing is the profile a
  // payment coming in through this ID should be recorded against — the
  // actual ledger split lives outside this screen; this state is the
  // switch it would read.
  const [shareRole, setShareRole] = useState("user"); // "user" | "merchant"
  const [roleFlipping, setRoleFlipping] = useState(false);

  const toggleShareRole = () => {
    setRoleFlipping(true);
    setTimeout(() => {
      setShareRole((r) => (r === "user" ? "merchant" : "user"));
      setRoleFlipping(false);
    }, 180);
  };

  const revealGloobalId = () => {
    setShowIdTag(true);
    setTimeout(() => setShowIdTag(false), 2500);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  // Single shared handler for every "Share" action in the app (Profile tab,
  // search bar icon, Referral Network invite) — always shares the direct
  // referral link, never just the bare ID.
  const handleShareReferralLink = async () => {
    const text = `Join me on Gloobal Access — send and receive money globally. Use my link: ${referralLink}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join Gloobal Access", text, url: referralLink });
      } else {
        await navigator.clipboard.writeText(referralLink);
        showToast(shareRole === "merchant" ? "Link copied · Merchant" : "Link copied · Personal");
      }
    } catch {}
  };

  const handleCopyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
    } catch {}
    showToast(shareRole === "merchant" ? "Link copied · Merchant" : "Link copied · Personal");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: T.fontBody,
        overflow: "hidden",
      }}
    >
      <DashboardAmbientBg />

      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 12px", background: "transparent" }}>
        <button
          onClick={onOpenCoverage}
          aria-label="Gloobal coverage"
          className="v2-tap"
          style={{
            border: "none",
            background: T.surface,
            width: 40,
            height: 40,
            borderRadius: "50%",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: T.shadowCard,
            flexShrink: 0,
          }}
        >
          <RotatingGlobeIcon />
        </button>
        <button
          onClick={onOpenCoverage}
          aria-label="Gloobal coverage"
          className="v2-tap"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "none",
            background: T.surface,
            borderRadius: T.radiusMd,
            padding: "11px 15px",
            boxShadow: T.shadowCard,
            cursor: "pointer",
          }}
        >
          <Search size={15} color={T.inkFaint} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: T.inkFaint, fontWeight: 500, textAlign: "center" }}>Gloobal Coverage</span>
          <span style={{ width: 15, flexShrink: 0 }} aria-hidden="true" />
        </button>

        <button
          onClick={() => setProfileOverlay("share")}
          aria-label="Share your Gloobal ID"
          className="v2-tap"
          style={{
            border: "none",
            background: T.surface,
            width: 40,
            height: 40,
            borderRadius: "50%",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: T.shadowCard,
            flexShrink: 0,
          }}
        >
          <Share2 size={17} color={T.accent} />
        </button>
      </div>

      <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {activeTab === "home" && (
          <div style={{ padding: "8px 18px 30px", display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                position: "relative",
                borderRadius: T.radiusXl,
                padding: "24px 22px",
                background: T.gradWallet,
                boxShadow: T.shadowRaised,
                color: "#fff",
                overflow: "hidden",
              }}
            >
              {/* Soft decorative glow — purely visual, no logic */}
              <div
                style={{
                  position: "absolute",
                  top: -60,
                  right: -60,
                  width: 180,
                  height: 180,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={revealGloobalId}
                    aria-label="Show my Gloobal ID"
                    className="v2-tap"
                    style={{
                      border: "1.5px solid rgba(255,255,255,0.35)",
                      background: "rgba(255,255,255,0.12)",
                      padding: 3,
                      borderRadius: 11,
                      cursor: "pointer",
                      display: "flex",
                      lineHeight: 0,
                    }}
                  >
                    <FlagEmoji flag={dialCountry.flag} width={38} height={28} radius={7} />
                  </button>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.75 }}>
                    Gloobal Wallet
                  </span>
                </div>
                <button
                  onClick={() => setBalanceVisible((v) => !v)}
                  aria-label={balanceVisible ? "Hide balance" : "Show balance"}
                  className="v2-tap"
                  style={{
                    border: "none",
                    background: "rgba(255,255,255,0.16)",
                    borderRadius: "50%",
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <EyeIcon open={balanceVisible} />
                </button>
              </div>
              <div style={{ position: "relative", marginTop: 20, fontSize: 32, fontWeight: 800, letterSpacing: 0.2, fontFamily: T.fontDisplay }}>
                {balanceVisible ? `$${balance}` : "•••••••"}
              </div>
              <div style={{ position: "relative", marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, opacity: 0.82 }}>
                <span>{dialCountry.flag}</span>
                <span>Connected to your Gloobal ID</span>
              </div>

              {showIdTag && (
                <div
                  style={{
                    position: "absolute",
                    top: 66,
                    left: 22,
                    zIndex: 5,
                    background: "rgba(15,12,35,0.94)",
                    backdropFilter: "blur(6px)",
                    color: "#fff",
                    borderRadius: 14,
                    padding: "9px 14px",
                    boxShadow: T.shadowFloat,
                    whiteSpace: "nowrap",
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, opacity: 0.7, textTransform: "uppercase" }}>
                    Gloobal ID
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, marginTop: 1, fontFamily: T.fontDisplay }}>
                    {gloobalIdTag}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {DASHBOARD_ACTIONS.map(({ key, label, Icon }) => {
                const onClick =
                  key === "send" ? onOpenSend
                  : key === "bank" ? onOpenBank
                  : key === "receive" ? () => setShowReceive(true)
                  : key === "scan" ? () => showToast("Scanner opening…")
                  : undefined;
                return (
                <button
                  key={key}
                  onClick={onClick}
                  aria-label={label}
                  className="v2-tap"
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    aspectRatio: "1",
                    border: `1px solid ${T.line}`,
                    background: T.surface,
                    borderRadius: T.radiusLg,
                    cursor: onClick ? "pointer" : "default",
                    padding: "15px 14px",
                    boxShadow: T.shadowCard,
                  }}
                >
                  <CardAmbientField />
                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      width: 42,
                      height: 42,
                      flexShrink: 0,
                      borderRadius: 14,
                      background: T.accentSoft,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon />
                  </span>
                </button>
                );
              })}
            </div>

            {/* Bills — a single compact row, kept small and quiet so the
                screen still reads clean; "More" is the door to everything
                else the business/network offers, without listing it all
                here. */}
            <div style={{ display: "flex", gap: 10 }}>
              {BILL_ACTIONS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => showToast(`${label} — coming soon`)}
                  aria-label={label}
                  className="v2-tap"
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "12px 4px",
                    border: `1px solid ${T.line}`,
                    background: T.surface,
                    borderRadius: 16,
                    cursor: "pointer",
                    boxShadow: T.shadowCard,
                  }}
                >
                  <span
                    style={{
                      width: 32, height: 32, borderRadius: 10,
                      background: T.accentSoft, display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Icon size={15} color={T.accent} />
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: T.inkSoft }}>{label}</span>
                </button>
              ))}
              <button
                onClick={() => showToast("More services — coming soon")}
                aria-label="More services"
                className="v2-tap"
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "12px 4px",
                  border: `1px solid ${T.line}`,
                  background: T.surface,
                  borderRadius: 16,
                  cursor: "pointer",
                  boxShadow: T.shadowCard,
                }}
              >
                <span
                  style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: T.accentSoft, display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  <ChevronRight size={15} color={T.accent} />
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: T.inkSoft }}>More</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div style={{ padding: "12px 18px 30px", display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "18px",
                borderRadius: T.radiusLg,
                background: T.surface,
                boxShadow: T.shadowCard,
              }}
            >
              <FlagEmoji
                flag={dialCountry.flag}
                width={54}
                height={54}
                radius={16}
                dropShadow="drop-shadow(0 4px 10px rgba(76,29,149,0.20))"
              />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Gloobal ID Member</div>
                <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>
                  {dialCountry.flag} {dialCountry.dialCode} · {dialCountry.name}
                </div>
              </div>
            </div>

            <div style={{ borderRadius: T.radiusLg, background: T.surface, overflow: "hidden", boxShadow: T.shadowCard }}>
              <button
                onClick={() => setProfileOverlay("referral")}
                className="v2-row"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 18px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: T.positiveSoft, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Gift size={18} color={T.positive} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>My Referral Network</div>
                  <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>See who you've invited and what you've earned</div>
                </span>
                <ChevronRightIcon />
              </button>
            </div>

            <div style={{ borderRadius: T.radiusLg, background: T.surface, overflow: "hidden", boxShadow: T.shadowCard }}>
              {PROFILE_ROWS.map((label, i) => (
                <button
                  key={label}
                  className="v2-row"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "15px 18px",
                    border: "none",
                    borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
                    background: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{label}</span>
                  <ChevronRightIcon />
                </button>
              ))}
            </div>

            <button
              onClick={onLogout}
              className="v2-tap"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                border: "1px solid rgba(226,63,69,0.22)",
                background: T.negativeSoft,
                borderRadius: T.radiusMd,
                padding: "14px 0",
                color: T.negative,
                fontSize: 13.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              <LogoutIcon />
              Log out
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          background: T.surface,
          borderTop: `1px solid ${T.line}`,
          padding: "10px 0 calc(10px + env(safe-area-inset-bottom, 0px))",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setActiveTab("home")}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            border: "none",
            background: "none",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          <HomeTabIcon active={activeTab === "home"} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: activeTab === "home" ? T.accent : T.inkFaint }}>
            Home
          </span>
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            border: "none",
            background: "none",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          <ProfileTabIcon active={activeTab === "profile"} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: activeTab === "profile" ? T.accent : T.inkFaint }}>
            Profile
          </span>
        </button>
      </div>

      {toast && (
        <div
          style={{
            position: "absolute",
            bottom: 90,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            background: T.ink,
            color: "#fff",
            padding: "11px 18px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: T.shadowFloat,
          }}
        >
          {toast}
        </div>
      )}

      {showReceive && (
        <div
          aria-hidden="true"
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,12,35,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowReceive(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 430, background: T.surface, borderRadius: "26px 26px 0 0", padding: "26px 22px 34px", boxShadow: T.shadowFloat }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Receive</span>
              <button
                onClick={() => setShowReceive(false)}
                aria-label="Close"
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={15} color={T.inkSoft} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 14px" }}>Share this Gloobal ID to receive money</p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                background: T.surfaceAlt,
                border: `1px solid ${T.line}`,
                borderRadius: T.radiusMd,
                padding: "14px 16px",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: T.fontDisplay, letterSpacing: 0.3 }}>
                {gloobalIdTag}
              </span>
              <button
                onClick={() => {
                  try {
                    navigator?.clipboard?.writeText(gloobalIdTag);
                  } catch {}
                  showToast("Copied");
                }}
                aria-label="Copy Gloobal ID"
                style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              >
                <Copy size={15} color={T.accent} />
              </button>
            </div>
          </div>
        </div>
      )}

      {profileOverlay === "share" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <SendMoneyAmbientBg />
          </div>

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
            <button
              onClick={() => setProfileOverlay(null)}
              aria-label="Back"
              className="v2-tap"
              style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <ArrowLeft size={18} color={T.ink} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Share your Gloobal ID</span>
          </div>

          <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "6px 18px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 360,
                minHeight: 220,
                background: T.surface,
                borderRadius: T.radiusLg,
                boxShadow: T.shadowCard,
                padding: 22,
              }}
            >
              <button
                onClick={toggleShareRole}
                aria-label={shareRole === "user" ? "Switch to Merchant profile" : "Switch to User profile"}
                className="v2-tap"
                style={{
                  position: "absolute", top: -14, left: "50%",
                  transform: `translateX(-50%) rotateY(${roleFlipping ? 90 : 0}deg)`,
                  transition: "transform 0.18s ease",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: "50%",
                  border: `1.5px solid ${T.surface}`,
                  background: shareRole === "merchant" ? "#FEF3E2" : T.accentSoft,
                  boxShadow: T.shadowCard,
                  cursor: "pointer",
                }}
              >
                {shareRole === "merchant" ? <Store size={15} color="#F59E0B" /> : <User size={15} color={T.accent} />}
              </button>

              <div style={{ position: "absolute", top: 22, left: 22 }}>
                <FlagEmoji flag={dialCountry.flag} width={60} height={44} radius={14} dropShadow="drop-shadow(0 4px 10px rgba(76,29,149,0.20))" />
              </div>

              <span
                style={{
                  position: "absolute", top: 22, right: 22,
                  width: 50, height: 50, borderRadius: "50%",
                  overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 10px rgba(76,29,149,0.16)", flexShrink: 0,
                }}
              >
                <img
                  src={`https://i.pravatar.cc/150?img=${avatarSeed}`}
                  alt="Profile"
                  width={50}
                  height={50}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </span>

              <div
                style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                  display: "flex", alignItems: "center", gap: 2, whiteSpace: "nowrap",
                }}
              >
                {shareableGloobalId.split("").map((ch, i) => (
                  <React.Fragment key={i}>
                    <span
                      style={{
                        fontSize: 20, fontWeight: 800, letterSpacing: 0.5, fontFamily: T.fontDisplay,
                        color: POSITION_COLORS[i % POSITION_COLORS.length],
                      }}
                    >
                      {ch}
                    </span>
                    {(i + 1) % 4 === 0 && i !== shareableGloobalId.length - 1 && <span style={{ width: 8 }} />}
                  </React.Fragment>
                ))}
              </div>

              <button
                onClick={handleCopyReferralLink}
                aria-label="Copy"
                className="v2-tap"
                style={{ position: "absolute", bottom: 22, left: 22, border: "none", background: "none", padding: 4, cursor: "pointer", display: "flex" }}
              >
                <Copy size={22} color={T.accent} />
              </button>

              <button
                onClick={handleShareReferralLink}
                aria-label="Share"
                className="v2-tap"
                style={{ position: "absolute", bottom: 22, right: 22, border: "none", background: "none", padding: 4, cursor: "pointer", display: "flex" }}
              >
                <Share2 size={22} color={T.accent} />
              </button>
            </div>
          </div>

          {toast && (
            <div
              style={{
                position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", zIndex: 50,
                background: T.ink, color: "#fff", padding: "11px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                whiteSpace: "nowrap", boxShadow: T.shadowFloat,
              }}
            >
              {toast}
            </div>
          )}
        </div>
      )}

      {profileOverlay === "referral" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <SendMoneyAmbientBg />
          </div>

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
            <button
              onClick={() => setProfileOverlay(null)}
              aria-label="Back"
              className="v2-tap"
              style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <ArrowLeft size={18} color={T.ink} />
            </button>
          </div>

          <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "6px 18px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Earnings summary */}
            <div style={{ position: "relative", background: T.gradWallet, borderRadius: T.radiusLg, padding: "22px 22px 52px", display: "flex", flexDirection: "column", gap: 4, boxShadow: T.shadowRaised }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: 0.3, textTransform: "uppercase" }}>
                Total earned from referrals
              </span>
              <span style={{ fontSize: 30, fontWeight: 800, color: "#fff", fontFamily: T.fontDisplay }}>
                ${referralNetwork.reduce((sum, m) => sum + m.earned, 0).toFixed(2)}
              </span>
              <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{referralNetwork.length}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>Invited</div>
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>
                    {referralNetwork.filter((m) => m.status === "Active").length}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>Active</div>
                </div>
              </div>

              <button
                onClick={() => setProfileOverlay("share")}
                aria-label="Share your referral link"
                className="v2-tap"
                style={{
                  position: "absolute", bottom: 16, right: 20,
                  width: 40, height: 40, borderRadius: "50%", border: "none",
                  background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <Share2 size={18} color="#fff" />
              </button>
            </div>

            {/* How the network works */}
            <button
              onClick={() => setShowHowItWorks(true)}
              className="v2-tap"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", background: T.gradButton, borderRadius: T.radiusMd, padding: "14px 0", color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 20px rgba(124,58,237,0.32)" }}
            >
              <Info size={16} color="#fff" />
              How your network works
            </button>

            {/* Network list — ranked by today's earnings first, so whoever
                is putting the most in your pocket today sits at the top. */}
            <div style={{ borderRadius: T.radiusLg, background: T.surface, overflow: "hidden", boxShadow: T.shadowCard }}>
              {[...referralNetwork]
                .sort((a, b) => b.earnedToday - a.earnedToday)
                .map((m, i) => (
                <button
                  key={m.name}
                  onClick={() => setSelectedMember(m)}
                  className="v2-tap"
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
                    borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
                    border: "none", borderTopStyle: "solid", background: "none", width: "100%", textAlign: "left", cursor: "pointer",
                  }}
                >
                  <FlagEmoji flag={m.flag} width={40} height={40} radius={12} dropShadow="drop-shadow(0 2px 6px rgba(76,29,149,0.14))" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{m.name}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: m.earnedToday > 0 ? T.positive : T.inkFaint }}>
                      {m.earnedToday > 0 ? `+$${m.earnedToday.toFixed(2)}` : "—"}
                    </span>
                    <span style={{ fontSize: 10, color: T.inkFaint, fontWeight: 600 }}>today</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {toast && (
            <div
              style={{
                position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", zIndex: 50,
                background: T.ink, color: "#fff", padding: "11px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                whiteSpace: "nowrap", boxShadow: T.shadowFloat,
              }}
            >
              {toast}
            </div>
          )}
        </div>
      )}

      {/* Tapping a name in "My Referral Network" opens this — a share-card
          style popup with a donut split between what this person earned
          you today and their all-time total. */}
      {selectedMember && (
        <div
          aria-hidden="true"
          onClick={() => setSelectedMember(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 400, background: "rgba(20,12,36,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative", width: "100%", maxWidth: 320,
              background: T.surface, borderRadius: T.radiusLg, boxShadow: T.shadowFloat,
              padding: "30px 24px 26px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            }}
          >
            <button
              onClick={() => setSelectedMember(null)}
              aria-label="Close"
              className="v2-tap"
              style={{
                position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: "50%",
                border: "none", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <X size={16} color={T.inkFaint} />
            </button>

            <span style={{ fontSize: 32 }}>{selectedMember.flag}</span>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>{selectedMember.name}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: selectedMember.status === "Active" ? T.positive : T.inkFaint, marginTop: 2 }}>
                {selectedMember.status}
              </div>
            </div>

            {(() => {
              const total = selectedMember.earned;
              const today = selectedMember.earnedToday;
              // The ring shows today's earnings as a slice of the all-time
              // total — with a small minimum sweep so a real but modest
              // "today" amount is still visible rather than a sliver.
              const rawPct = total > 0 ? Math.min(100, (today / total) * 100) : 0;
              const deg = rawPct > 0 ? Math.max(18, (rawPct / 100) * 360) : 0;
              return (
                <div
                  style={{
                    position: "relative", width: 150, height: 150, borderRadius: "50%",
                    background: deg > 0
                      ? `conic-gradient(${T.accent} 0deg ${deg}deg, ${T.accentSoft} ${deg}deg 360deg)`
                      : T.accentSoft,
                    display: "flex", alignItems: "center", justifyContent: "center", marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      width: 108, height: 108, borderRadius: "50%", background: T.surface,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: T.inkFaint, letterSpacing: 0.4, textTransform: "uppercase" }}>
                      Total earned
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>
                      ${total.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 22, marginTop: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: T.accent, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>${selectedMember.earnedToday.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: T.inkFaint, fontWeight: 600 }}>Today</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: T.accentSoft, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>${selectedMember.earned.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: T.inkFaint, fontWeight: 600 }}>All-time total</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Explains how earning through the referral network works — opened
          from the option that replaced the old "Invite a friend" CTA. */}
      {showHowItWorks && (
        <div
          aria-hidden="true"
          onClick={() => setShowHowItWorks(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 400, background: "rgba(20,12,36,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative", width: "100%", maxWidth: 340,
              background: T.surface, borderRadius: T.radiusLg, boxShadow: T.shadowFloat,
              padding: "28px 24px 24px", display: "flex", flexDirection: "column", gap: 18,
            }}
          >
            <button
              onClick={() => setShowHowItWorks(false)}
              aria-label="Close"
              className="v2-tap"
              style={{
                position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: "50%",
                border: "none", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <X size={16} color={T.inkFaint} />
            </button>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users2 size={24} color={T.accent} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>
                How your network works
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Share2 size={16} color={T.accent} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Share your link</div>
                  <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.4, marginTop: 2 }}>
                    Your Gloobal ID doubles as your invite link. Send it to friends and family.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Users2 size={16} color={T.accent} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>They join your network</div>
                  <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.4, marginTop: 2 }}>
                    Once they sign up and become active, they show up in your network list.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Gift size={16} color={T.accent} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>You earn together</div>
                  <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.4, marginTop: 2 }}>
                    Every time they send money, a share of the fee is added straight to your balance — tracked today and all-time for each person.
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHowItWorks(false)}
              className="v2-tap"
              style={{ border: "none", background: T.gradButton, borderRadius: T.radiusMd, padding: "13px 0", color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 20px rgba(124,58,237,0.32)" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Memoized: this screen is only ever (re)rendered while the "dashboard"
// stage is active, but its parent (App) re-renders periodically on its
// own (e.g. the background particle animation) — memoizing skips that
// work here whenever this screen's actual props haven't changed.
export const DashboardScreen = React.memo(DashboardScreenBase);
