import React, { useMemo } from "react";
import { T } from "../../styles/theme";

export const FIN_SYMBOLS = ["+", "−", "×", "÷", "=", "₹", "$", "€", "£", "¥", "%", "#"];
// Mostly dark neutrals per the brief, with a small chance of a brand hue.
export const FIN_NEUTRAL_COLORS = ["#2A2A38", "#1F2333", "#14131F", "#3A3A48", "#20263D"];
export const FIN_BRAND_COLORS = [T.accent, T.accent2, "#C026D3"];
export function finRand(min, max) {
  return min + Math.random() * (max - min);
}
export function finPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
// One floating-symbol particle's fixed, randomized parameters. Position is
// anchored near a random edge; the keyframe then drifts it further along
// that trajectory and fades it in/out, so particles feel like they spawn
// from an edge and dissolve rather than popping in place.
export function makeFinSymbolParticle(i, opts) {
  const { brandChance, glowChance, sizeMin, sizeMax, driftMin, driftMax, symbols = FIN_SYMBOLS, opacityMin = 0.06, opacityMax = 0.2 } = opts;
  const edge = finPick(["top", "bottom", "left", "right"]);
  const along = finRand(4, 96);
  const isBrand = Math.random() < brandChance;
  const glow = Math.random() < glowChance;
  const signX = edge === "left" ? 1 : edge === "right" ? -1 : finRand(-1, 1);
  const signY = edge === "top" ? 1 : edge === "bottom" ? -1 : finRand(-1, 1);
  return {
    id: i,
    symbol: finPick(symbols),
    edge,
    along,
    size: finRand(sizeMin, sizeMax),
    color: isBrand ? finPick(FIN_BRAND_COLORS) : finPick(FIN_NEUTRAL_COLORS),
    duration: finRand(10, 24),
    delay: finRand(-22, 0),
    rotateStart: finRand(-24, 24),
    rotateEnd: finRand(-24, 24),
    dx: signX * finRand(driftMin, driftMax),
    dy: signY * finRand(driftMin, driftMax),
    peakOpacity: finRand(opacityMin, opacityMax),
    glow,
    glowDuration: finRand(3, 6),
    glowDelay: finRand(0, 3),
  };
}
// Renders a contained field of drifting +/−/×/÷ and currency glyphs.
// `count` and the size/drift ranges scale the effect between the small
// action cards and the full dashboard background. `symbols` and the
// opacity range let a caller build a higher-visibility, currency-only
// variant (see SendMoneyAmbientBg) from this same particle system.
export function FinSymbolField({
  count = 8,
  sizeMin = 12,
  sizeMax = 20,
  driftMin = 30,
  driftMax = 90,
  brandChance = 0.12,
  glowChance = 0.14,
  symbols = FIN_SYMBOLS,
  opacityMin = 0.06,
  opacityMax = 0.2,
}) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        makeFinSymbolParticle(i, { brandChance, glowChance, sizeMin, sizeMax, driftMin, driftMax, symbols, opacityMin, opacityMax })
      ),
    [count, sizeMin, sizeMax, driftMin, driftMax, brandChance, glowChance, symbols, opacityMin, opacityMax]
  );

  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      {particles.map((p) => {
        const edgeStyle =
          p.edge === "top"
            ? { top: "-10%", left: `${p.along}%` }
            : p.edge === "bottom"
            ? { bottom: "-10%", left: `${p.along}%` }
            : p.edge === "left"
            ? { left: "-10%", top: `${p.along}%` }
            : { right: "-10%", top: `${p.along}%` };
        return (
          <span
            key={p.id}
            style={{
              position: "absolute",
              ...edgeStyle,
              fontSize: p.size,
              fontWeight: 700,
              color: p.color,
              fontFamily: T.fontDisplay,
              lineHeight: 1,
              userSelect: "none",
              pointerEvents: "none",
              willChange: "transform, opacity",
              animation: `finDrift ${p.duration}s linear ${p.delay}s infinite${
                p.glow ? `, finGlow ${p.glowDuration}s ease-in-out ${p.glowDelay}s infinite` : ""
              }`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--r0": `${p.rotateStart}deg`,
              "--r1": `${p.rotateEnd}deg`,
              "--peak-op": p.peakOpacity,
            }}
          >
            {p.symbol}
          </span>
        );
      })}
    </div>
  );
}
export function makeFinDotParticle(i) {
  const isBrand = Math.random() < 0.08;
  const glow = Math.random() < 0.15;
  return {
    id: i,
    x: finRand(2, 98),
    y: finRand(4, 96),
    size: finRand(2, 4.5),
    color: isBrand ? finPick(FIN_BRAND_COLORS) : finPick(FIN_NEUTRAL_COLORS),
    duration: finRand(6, 14),
    delay: finRand(-12, 0),
    peakOpacity: finRand(0.08, 0.2),
    glow,
    glowDuration: finRand(3, 6),
    glowDelay: finRand(0, 3),
  };
}
// A quiet scatter of small pulsing dots, used only on the full dashboard
// background (kept out of the small action cards to avoid noise).
export function FinDotField({ count = 24 }) {
  const dots = useMemo(() => Array.from({ length: count }, (_, i) => makeFinDotParticle(i)), [count]);
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      {dots.map((d) => (
        <span
          key={d.id}
          style={{
            position: "absolute",
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.size,
            height: d.size,
            borderRadius: "50%",
            background: d.color,
            pointerEvents: "none",
            willChange: "transform, opacity",
            animation: `finDotPulse ${d.duration}s ease-in-out ${d.delay}s infinite${
              d.glow ? `, finGlow ${d.glowDuration}s ease-in-out ${d.glowDelay}s infinite` : ""
            }`,
            "--peak-op": d.peakOpacity,
          }}
        />
      ))}
    </div>
  );
}
// A handful of large, near-invisible outline shapes that turn very slowly —
// pure atmosphere, evoking a "mission control" fintech backdrop without
// competing with foreground content.
export const FIN_GEO_SHAPES = [
  { id: 0, type: "circle", x: 10, y: 16, size: 130, duration: 46, color: "#20263D" },
  { id: 1, type: "square", x: 86, y: 24, size: 80, duration: 58, color: "#2A2A38" },
  { id: 2, type: "circle", x: 78, y: 78, size: 100, duration: 40, color: "#1F2333" },
  { id: 3, type: "square", x: 16, y: 82, size: 70, duration: 64, color: "#3A3A48" },
];
export function FinGeoField() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      {FIN_GEO_SHAPES.map((s) => (
        <div
          key={s.id}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            border: `1px solid ${s.color}`,
            borderRadius: s.type === "circle" ? "50%" : 18,
            opacity: 0.05,
            pointerEvents: "none",
            willChange: "transform",
            animation: `finGeoSpin ${s.duration}s linear infinite`,
          }}
        />
      ))}
    </div>
  );
}
// Composed background used behind the whole dashboard: geometry (back),
// dots (middle), symbols (front) — replaces the flat white/T.bg fill.
export function DashboardAmbientBg() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
      <FinGeoField />
      <FinDotField count={22} />
      <FinSymbolField count={16} sizeMin={14} sizeMax={28} driftMin={60} driftMax={150} brandChance={0.1} glowChance={0.12} />
    </div>
  );
}
// The Send Money empty states leaned on DashboardAmbientBg before, but at
// its normal low opacity a mostly-empty screen still read as blank. This
// swaps in currency signs only ($, €, £, ¥, ₹ — no +/×/= filler) and turns
// the opacity up a lot, so the screen reads as "money is flowing here"
// rather than "nothing's happening yet".
export const CURRENCY_SYMBOLS = ["$", "€", "£", "¥", "₹"];
export function SendMoneyAmbientBg() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
      <FinGeoField />
      <FinSymbolField
        count={16}
        sizeMin={18}
        sizeMax={34}
        driftMin={50}
        driftMax={130}
        brandChance={0.3}
        glowChance={0.24}
        symbols={CURRENCY_SYMBOLS}
        opacityMin={0.35}
        opacityMax={0.7}
      />
    </div>
  );
}
// Smaller, quieter field scoped to a single action card — spawns and drifts
// symbols behind the icon/label, clipped to the card's own rounded corners.
export function CardAmbientField() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, borderRadius: "inherit", pointerEvents: "none" }}>
      <FinSymbolField count={7} sizeMin={11} sizeMax={17} driftMin={26} driftMax={70} brandChance={0.14} glowChance={0.16} />
    </div>
  );
}
