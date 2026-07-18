import React from "react";
import { C } from "../../styles/theme";

// A small globe mark, spun continuously — the same "connected / global"
// motif from the header, reused as the left-hand icon on the dashboard's
// top bar.
export function RotatingGlobeIcon({ size = 22 }) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0, animation: "spin 7s linear infinite" }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#7c3aed" strokeWidth="1.7">
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3.3 9h17.4M3.3 15h17.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
export function NotificationIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#1a1a2e" strokeWidth="2">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
    </svg>
  );
}
export function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="2.2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="2.2">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.9 5.1A10.6 10.6 0 0112 5c6.5 0 10 7 10 7a13.2 13.2 0 01-3.1 3.9M6.2 6.9C3.6 8.6 2 12 2 12a13.4 13.4 0 003.3 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function ScannerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#7c3aed" strokeWidth="2">
      <path d="M4 8V6a2 2 0 012-2h2M20 8V6a2 2 0 00-2-2h-2M4 16v2a2 2 0 002 2h2M20 16v2a2 2 0 01-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h16" strokeLinecap="round" />
    </svg>
  );
}
export function AddBankIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#7c3aed" strokeWidth="2">
      <path d="M3 10l9-6 9 6M4 10v8M20 10v8M9 10v8M15 10v8M2 19h20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function ReceiveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#7c3aed" strokeWidth="2">
      <path d="M12 4v13M7 12l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20h14" strokeLinecap="round" />
    </svg>
  );
}
export function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#7c3aed" strokeWidth="2">
      <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function HomeTabIcon({ active }) {
  const c = active ? "#7c3aed" : "#9a94ad";
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke={c} strokeWidth="2">
      <path d="M4 11.5L12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 001 1h4v-6h2v6h4a1 1 0 001-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function ProfileTabIcon({ active }) {
  const c = active ? "#7c3aed" : "#9a94ad";
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke={c} strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.6-3.8 5-5.5 8-5.5s6.4 1.7 8 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#e14848" strokeWidth="2">
      <path d="M9 21H5a1 1 0 01-1-1V4a1 1 0 011-1h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#c3bfe0" strokeWidth="2.4">
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
// Small green/live or red/inactive dot for the corner of a flag box. Reused
// everywhere a flag is shown in Gloobal Coverage so there's one definition
// of what the indicator looks like and where it sits.
export function CoverageStatusDot({ active, size = 12 }) {
  return (
    <span
      aria-hidden="true"
      className={active ? "live-dot" : undefined}
      style={{
        position: "absolute",
        top: -size * 0.28,
        right: -size * 0.28,
        width: size,
        height: size,
        borderRadius: "50%",
        background: active ? C.positive : C.negative,
        border: `2px solid ${C.surface}`,
        boxShadow: "0 1px 3px rgba(20,20,40,0.25)",
        animation: active ? "livePulse 1.8s ease-in-out infinite" : "none",
      }}
    />
  );
}
