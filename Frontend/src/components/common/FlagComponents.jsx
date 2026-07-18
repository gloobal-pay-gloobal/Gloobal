import React from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import CountryFlags from "country-flag-icons/react/3x2";

// Flag emoji are two Unicode regional-indicator symbols (U+1F1E6..U+1F1FF,
// one per A-Z) — this decodes a flag glyph like "🇮🇳" back to its ISO-2 code
// ("IN") so it can be looked up in the real SVG flag set below. Windows
// Chrome/Edge have no color-flag glyphs in their emoji font at all — flag
// emoji there render as two small black letter-shapes instead of a flag —
// so rendering real SVGs (not relying on the OS emoji font) is what makes
// flags actually look like flags on every platform, not just Mac/mobile.
function isoFromFlagEmoji(flag) {
  const chars = Array.from(flag || "");
  if (chars.length !== 2) return null;
  const codes = chars.map((c) => c.codePointAt(0) ?? 0);
  if (codes.some((c) => c < 0x1f1e6 || c > 0x1f1ff)) return null;
  return codes.map((c) => String.fromCharCode(c - 0x1f1e6 + 65)).join("");
}

// A colored glow around a flag's own boundary instead of a small corner
// dot — green if the country is active/live, red if it isn't. Shared by
// every screen that marks a country's status this way (registration's
// country picker, Gloobal Coverage, and the Send Money country picker).
// `compact` trims the border/glow down for small grid flags so it doesn't
// overwhelm them.
export function countryGlowStyle(active, compact = false) {
  const rgb = active ? "34,197,94" : "239,68,68";
  const borderColor = active ? "#22C55E" : "#EF4444";
  return compact
    ? { border: `1.5px solid ${borderColor}`, boxShadow: `0 0 6px rgba(${rgb},0.55)` }
    : { border: `2px solid ${borderColor}`, boxShadow: `0 0 0 2px rgba(${rgb},0.16), 0 0 10px rgba(${rgb},0.5)` };
}
// A country's flag emoji, cropped to fully fill its box. Emoji glyphs carry
// their own built-in padding that varies flag-to-flag; rendering the glyph
// oversized and clipping the overflow removes that padding so every flag
// fills its box edge-to-edge, consistently.
function FlagEmojiBase({ flag, size, width, height, radius = 0, background, dropShadow }) {
  const w = width ?? size;
  const h = height ?? size;
  const iso = isoFromFlagEmoji(flag);
  const SvgFlag = iso ? CountryFlags[iso] : undefined;

  if (SvgFlag) {
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
        <SvgFlag
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
        />
      </div>
    );
  }

  const bleedX = w * 0.4;
  const bleedY = h * 0.4;
  const glyphSize = Math.max(w, h) * 1.6;
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

// Memoized: rendered directly in App.jsx's always-mounted registration/
// login flow, which re-renders periodically on its own (the background
// particle animation) — memoizing skips redundant work here whenever a
// given FlagEmoji's own props haven't changed.
export const FlagEmoji = React.memo(FlagEmojiBase);

// Clip-path silhouettes used to mask a flag into a "+", "-", "×" or "="
// character shape. Thickness is expressed as a percentage of the box.
export const BAR_THICKNESS = 34;
export const LO = 50 - BAR_THICKNESS / 2;
export const HI = 50 + BAR_THICKNESS / 2;
export const PLUS_CLIP = `polygon(${LO}% 0%, ${HI}% 0%, ${HI}% ${LO}%, 100% ${LO}%, 100% ${HI}%, ${HI}% ${HI}%, ${HI}% 100%, ${LO}% 100%, ${LO}% ${HI}%, 0% ${HI}%, 0% ${LO}%, ${LO}% ${LO}%)`;
export const EQUALS_CLIP = `polygon(0% 15%, 100% 15%, 100% 35%, 0% 35%, 0% 65%, 100% 65%, 100% 85%, 0% 85%)`;
// A flag, masked into the silhouette of a symbol from the Gloobal ID dial pad
// (+, -, ×, =) or into a simple circle/square chip. This is how flags show
// up in the background flow — as the shape of a symbol, not a plain square.
function FlagSignShapeBase({ sign, flag, box }) {
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

// Memoized: up to MAX_PARTICLES (20) of these render at once inside the
// background particle field, which re-renders periodically as particles
// are added/removed — most individual particles' own sign/flag/box don't
// change between those re-renders, so this skips redundant work for them.
export const FlagSignShape = React.memo(FlagSignShapeBase);
// Pixel sizes for each flag-chip size, matched 1:1 to the previous CSS
// (.flag-chip.lg/.md/.sm) so nothing visually shifts.
export const FLAG_CHIP_PX = { lg: [52, 40], md: [30, 23], sm: [24, 18] };
export function Flag({ emoji, size = "md", badge }) {
  const [w, h] = FLAG_CHIP_PX[size];
  return (
    <span className="flag-chip-wrap">
      <span className={`flag-chip ${size}`}>
        <FlagEmoji flag={emoji} width={w} height={h} radius={0} />
      </span>
      {badge && (
        <span className={`flag-badge ${badge}`}>
          {badge === "send" ? <ArrowUpRight size={11} strokeWidth={2.75} /> : <ArrowDownLeft size={11} strokeWidth={2.75} />}
        </span>
      )}
    </span>
  );
}
