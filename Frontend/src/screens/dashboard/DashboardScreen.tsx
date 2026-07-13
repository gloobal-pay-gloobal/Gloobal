import React, { useState, useEffect } from "react";
import { CardAmbientField, DashboardAmbientBg } from "../../components/ambient/AmbientParticles";
import { GlobalSearchField } from "../../components/common/GlobalSearchField";
import { ChevronRightIcon, EyeIcon, FlagEmoji, HomeTabIcon, LogoutIcon, NetworkIcon, NotificationIcon, ProfileTabIcon, RotatingGlobeIcon } from "../../components/icons/MiscIcons";
import { DASHBOARD_ACTIONS, PROFILE_ROWS } from "../../data/dashboardActions";
import { ReferralNetworkScreen } from "../referral/ReferralNetworkScreen";
import { T } from "../../styles/theme";
import { Home, Search } from "lucide-react";
import { commandBus } from "../../app/commandBus";
import { getProfile, getHistory, type BackendUser, type TransactionResult } from "../../services/api/authApi";
import type { DialCountry } from "../../types";

interface DashboardScreenProps {
  dialCountry: DialCountry;
  symbolId: string;
  fullName?: string;
  referralCode: string;
  onShareReferral: () => void;
  onOpenSend: () => void;
  onOpenBank: () => void;
  onOpenCoverage: () => void;
  onOpenReceive: () => void;
}

type DashboardTab = "home" | "profile" | "history";

function formatMoney(amount: unknown): string {
  const value = Number(amount) || 0;
  return `₹${value.toLocaleString("en-IN")}`;
}

function transactionTitle(tx: TransactionResult): string {
  if (tx.note) return String(tx.note);
  if (tx.receiverName) return `Paid to ${tx.receiverName}`;
  if (tx.senderName) return `Received from ${tx.senderName}`;
  if (tx.receiverSymbolId) return `Paid to ${tx.receiverSymbolId}`;
  if (tx.senderSymbolId) return `Received from ${tx.senderSymbolId}`;
  return "Gloobal payment";
}

// Logout is dispatched through the Command Bus rather than an `onLogout`
// prop threaded down from RootApp — this component no longer needs to know
// who handles logging out, only that "auth/logout" is a thing that can be
// dispatched. RootApp (or, later, an Authentication feature module)
// registers the actual handler; see commandBus.ts.
export function DashboardScreen({ dialCountry, symbolId, fullName, referralCode, onShareReferral, onOpenSend, onOpenBank, onOpenCoverage, onOpenReceive }: DashboardScreenProps) {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>("home");
  const [showIdTag, setShowIdTag] = useState(false);
  const [showReferralNetwork, setShowReferralNetwork] = useState(false);
  // No real balance endpoint exists yet (ledger entries are always 0 in
  // this prototype backend) — this stays a static prototype figure, same
  // as the earlier Dashboard.jsx.
  const balance = "12,480.50";

  const [profile, setProfile] = useState<BackendUser | null>(null);
  const [history, setHistory] = useState<TransactionResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbolId) return;
    getProfile(symbolId)
      .then(setProfile)
      .catch(() => {
        // Profile fetch failing shouldn't block the dashboard — fall back
        // to whatever RootApp already knows (fullName prop) below.
      });
  }, [symbolId]);

  const loadHistory = () => {
    if (!symbolId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    getHistory(symbolId)
      .then(setHistory)
      .catch((err) => setHistoryError(err instanceof Error ? err.message : "Unable to load history."))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolId]);

  const displayName = profile?.fullName || fullName || "Gloobal User";
  const displayMobile = profile?.mobileNumber || "Mobile not available";

  // The real, permanent Global ID (symbolId) — shown masked behind "+"
  // marks when tapping the flag on the balance card, same interaction as
  // before, now backed by a real account identifier instead of a
  // dialCountry-derived placeholder.
  const globalIdTag = symbolId;

  const revealGlobalId = () => {
    setShowIdTag(true);
    setTimeout(() => setShowIdTag(false), 2500);
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
          aria-label="Global coverage"
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
        <GlobalSearchField readOnly onClick={onOpenCoverage} />
        <button
          aria-label="Notifications"
          className="v2-tap"
          style={{
            position: "relative",
            border: "none",
            background: T.surface,
            width: 40,
            height: 40,
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: T.shadowCard,
            flexShrink: 0,
          }}
        >
          <NotificationIcon />
          <span
            style={{
              position: "absolute",
              top: 9,
              right: 10,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#ff8a3d",
              border: `1.5px solid ${T.surface}`,
            }}
          />
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
                    onClick={revealGlobalId}
                    aria-label="Show my Global ID"
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
                    Global Wallet
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
                <span>Connected to your Global ID</span>
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
                    Global ID
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, marginTop: 1, fontFamily: T.fontDisplay }}>
                    {globalIdTag}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, maxWidth: 220, margin: "0 auto", width: "100%" }}>
              {DASHBOARD_ACTIONS.map(({ key, label, Icon }) => {
                const onClick =
                  key === "send"
                    ? onOpenSend
                    : key === "bank"
                    ? onOpenBank
                    : key === "receive"
                    ? onOpenReceive
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
                    padding: 0,
                    boxShadow: T.shadowCard,
                  }}
                >
                  <CardAmbientField />
                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      width: "48%",
                      height: "48%",
                      maxWidth: 34,
                      maxHeight: 34,
                      flexShrink: 0,
                      borderRadius: 11,
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
                <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>{displayName}</div>
                <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>{displayMobile}</div>
                <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2, fontFamily: T.fontDisplay }}>{symbolId}</div>
              </div>
            </div>

            <button
              className="v2-tap"
              onClick={onShareReferral}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 18px",
                border: "none",
                borderRadius: T.radiusLg,
                background: T.gradButton,
                cursor: "pointer",
                textAlign: "left",
                boxShadow: "0 8px 20px rgba(124,58,237,0.28)",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Invite friends</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                  Share your link · code {referralCode}
                </div>
              </div>
              <ChevronRightIcon />
            </button>

            <button
              className="v2-tap"
              onClick={() => setShowReferralNetwork(true)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "15px 18px",
                border: `1px solid ${T.line}`,
                borderRadius: T.radiusLg,
                background: T.surface,
                cursor: "pointer",
                textAlign: "left",
                boxShadow: T.shadowCard,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 700, color: T.ink }}>
                <NetworkIcon />
                Referral Network
              </span>
              <ChevronRightIcon />
            </button>

            <button
              className="v2-tap"
              onClick={() => { setActiveTab("history"); loadHistory(); }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "15px 18px",
                border: `1px solid ${T.line}`,
                borderRadius: T.radiusLg,
                background: T.surface,
                cursor: "pointer",
                textAlign: "left",
                boxShadow: T.shadowCard,
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>Transaction History</span>
              <ChevronRightIcon />
            </button>

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
              onClick={() => commandBus.dispatch("auth/logout", undefined)}
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

        {activeTab === "history" && (
          <div style={{ padding: "12px 18px 30px", display: "flex", flexDirection: "column", gap: 14 }}>
            <button
              onClick={() => setActiveTab("profile")}
              className="v2-tap"
              style={{
                alignSelf: "flex-start",
                border: "none",
                background: T.surface,
                borderRadius: T.radiusMd,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                color: T.ink,
                cursor: "pointer",
                boxShadow: T.shadowCard,
              }}
            >
              ‹ Back
            </button>

            {historyLoading && <p style={{ fontSize: 13, color: T.inkSoft }}>Loading history…</p>}
            {historyError && <p style={{ fontSize: 13, color: T.negative }}>{historyError}</p>}

            {!historyLoading && !historyError && history.length === 0 && (
              <p style={{ fontSize: 13, color: T.inkSoft }}>No transactions yet.</p>
            )}

            {history.map((tx, i) => (
              <div
                key={(tx.referenceId as string) || i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: T.radiusLg,
                  background: T.surface,
                  boxShadow: T.shadowCard,
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{transactionTitle(tx)}</div>
                  <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>
                    {tx.createdAt ? new Date(tx.createdAt as string).toLocaleString() : "Recent"}
                  </div>
                </div>
                <strong style={{ fontSize: 14, color: T.ink }}>{formatMoney(tx.amount)}</strong>
              </div>
            ))}
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

      {showReferralNetwork && (
        <ReferralNetworkScreen referralCode={referralCode} onClose={() => setShowReferralNetwork(false)} />
      )}
    </div>
  );
}
