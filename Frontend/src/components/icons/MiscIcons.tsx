import React from "react";
import type { FlagSign } from "../../types";

interface FlagEmojiProps {
  flag: string;
  size?: number;
  width?: number;
  height?: number;
  radius?: number;
  background?: string;
  dropShadow?: string;
}

// A country's flag emoji, cropped to fully fill its box. Emoji glyphs carry
// their own built-in padding that varies flag-to-flag; rendering the glyph
// oversized and clipping the overflow removes that padding so every flag
// fills its box edge-to-edge, consistently.
export function FlagEmoji({ flag, size, width, height, radius = 0, background, dropShadow }: FlagEmojiProps) {
  const w = width ?? size;
  const h = height ?? size;
  const bleedX = (w ?? 0) * 0.4;
  const bleedY = (h ?? 0) * 0.4;
  const glyphSize = Math.max(w ?? 0, h ?? 0) * 1.6;
  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        overflow: "hidden",
        borderRadius: radius,
        background,
        filter: dropShadow,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -bleedY,
          left: -bleedX,
          right: -bleedX,
          bottom: -bleedY,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: glyphSize,
          lineHeight: 1,
        }}
      >
        {flag}
      </span>
    </div>
  );
}

// Clip-path silhouettes used to mask a flag into a "+", "-", "×" or "="
// character shape. Thickness is expressed as a percentage of the box.
export const BAR_THICKNESS = 34;
export const LO = 50 - BAR_THICKNESS / 2;
export const HI = 50 + BAR_THICKNESS / 2;
export const PLUS_CLIP = `polygon(${LO}% 0%, ${HI}% 0%, ${HI}% ${LO}%, 100% ${LO}%, 100% ${HI}%, ${HI}% ${HI}%, ${HI}% 100%, ${LO}% 100%, ${LO}% ${HI}%, 0% ${HI}%, 0% ${LO}%, ${LO}% ${LO}%)`;
export const EQUALS_CLIP = `polygon(0% 15%, 100% 15%, 100% 35%, 0% 35%, 0% 65%, 100% 65%, 100% 85%, 0% 85%)`;

interface FlagSignShapeProps {
  sign: FlagSign;
  flag: string;
  box: number;
}

// A flag, masked into the silhouette of a symbol from the Global ID dial pad
// (+, -, ×, =) or into a simple circle/square chip. This is how flags show
// up in the background flow — as the shape of a symbol, not a plain square.
export function FlagSignShape({ sign, flag, box }: FlagSignShapeProps) {
  const dropShadow = { filter: "drop-shadow(0 2px 4px rgba(20,20,40,0.28))" };

  if (sign === "circle" || sign === "square") {
    return (
      <div style={dropShadow}>
        <FlagEmoji flag={flag} size={box} radius={sign === "circle" ? box / 2 : box * 0.22} />
      </div>
    );
  }

  let clipPath = PLUS_CLIP;
  let rotate = 0;
  if (sign === "-") clipPath = `inset(${LO}% 0% ${LO}% 0%)`;
  else if (sign === "=") clipPath = EQUALS_CLIP;
  else if (sign === "×") rotate = 45;

  return (
    <div
      style={{
        width: box,
        height: box,
        clipPath,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        ...dropShadow,
      }}
    >
      <FlagEmoji flag={flag} size={box} />
    </div>
  );
}

// A small globe mark, spun continuously — the same "connected / global"
// motif from the header, reused as the left-hand icon on the dashboard's
// top bar.
export function RotatingGlobeIcon({ size = 22 }: { size?: number }) {
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

export function EyeIcon({ open }: { open: boolean }) {
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

export function HomeTabIcon({ active }: { active: boolean }) {
  const c = active ? "#7c3aed" : "#9a94ad";
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke={c} strokeWidth="2">
      <path d="M4 11.5L12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 001 1h4v-6h2v6h4a1 1 0 001-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProfileTabIcon({ active }: { active: boolean }) {
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

export function NetworkIcon({ color = "#7c3aed" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="12" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
      <path d="M12 7.5V15M12 15L5 16.7M12 15v1.5M12 15l7 1.7" strokeLinecap="round" strokeLinejoin="round" />
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
