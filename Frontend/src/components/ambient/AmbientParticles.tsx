import React, { useMemo } from "react";
import { ALL_COUNTRIES } from "../../data/countries";
import { T } from "../../styles/theme";
import type { FlagSign } from "../../types";

/** A single background particle in the registration-screen flag flow —
 * mutated in place by RootApp's own requestAnimationFrame loop (position,
 * scale, opacity change every frame outside React state, by design, so the
 * animation doesn't re-render the component tree 60 times a second). */
export interface FlagParticle {
  id: string;
  sign: FlagSign;
  flag: string;
  box: number;
  pw: number;
  ph: number;
  spawnY: number;
  scale: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

// The background flow: every particle is a single country flag, masked into
// one of six silhouettes (+, -, ×, =, ○, ▢) as it drifts up the stage.
export const SIGN_TYPES: FlagSign[] = ["+", "-", "×", "=", "circle", "square"];
export const MAX_PARTICLES = 20;
export const BOX_SIZES = [14, 18, 24, 32, 40, 52];
// A particle is "born" at 1/10th of its box size (a pinprick / tiny star)
// and grows up to its full, existing size as it rises up the stage.
export const GROWTH_START_SCALE = 1 / 10;

export function makeParticle(w: number, h: number): FlagParticle {
  const spawnX = Math.random() * w;
  const spawnY = h + 10 + Math.random() * 20;

  // Gentler, narrower drift range so the flow reads as calm and even
  // rather than scattered.
  const bias = (spawnX / w - 0.5) * 2; // -1 (left) to 1 (right)
  const vx = bias * (0.2 + Math.random() * 0.3);
  const vy = -(0.35 + Math.random() * 0.4);

  const box = BOX_SIZES[Math.floor(Math.random() * BOX_SIZES.length)];
  const sign = SIGN_TYPES[Math.floor(Math.random() * SIGN_TYPES.length)];
  const flag = ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)].flag;

  return {
    id: Math.random().toString(36).slice(2),
    sign,
    flag,
    box,
    pw: box,
    ph: box,
    spawnY,
    scale: GROWTH_START_SCALE,
    x: spawnX,
    y: spawnY,
    vx,
    vy,
    opacity: 0,
    twinkleSpeed: 0.012 + Math.random() * 0.015,
    twinklePhase: Math.random() * Math.PI * 2,
  };
}

// ---------------------------------------------------------------------------
// Ambient dashboard motion: floating financial symbols, drifting dots, and
// slow-turning geometric outlines. Everything here is decorative (aria-hidden,
// pointer-events: none) and driven entirely by CSS keyframes + custom
// properties rather than a JS animation loop, so it stays GPU-composited
// (transform/opacity only) and cheap on battery. Randomized per-particle
// parameters are generated once via useMemo on mount, never per frame.
// ---------------------------------------------------------------------------

export const FIN_SYMBOLS = ["+", "−", "×", "÷", "=", "₹", "$", "€", "£", "¥", "%", "#"];

// Mostly dark neutrals per the brief, with a small chance of a brand hue.
export const FIN_NEUTRAL_COLORS = ["#2A2A38", "#1F2333", "#14131F", "#3A3A48", "#20263D"];
export const FIN_BRAND_COLORS = [T.accent, T.accent2, "#C026D3"];

export function finRand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function finPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface FinSymbolParticleOptions {
  brandChance: number;
  glowChance: number;
  sizeMin: number;
  sizeMax: number;
  driftMin: number;
  driftMax: number;
}

type FinEdge = "top" | "bottom" | "left" | "right";

interface FinSymbolParticle {
  id: number;
  symbol: string;
  edge: FinEdge;
  along: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  rotateStart: number;
  rotateEnd: number;
  dx: number;
  dy: number;
  peakOpacity: number;
  glow: boolean;
  glowDuration: number;
  glowDelay: number;
}

// One floating-symbol particle's fixed, randomized parameters. Position is
// anchored near a random edge; the keyframe then drifts it further along
// that trajectory and fades it in/out, so particles feel like they spawn
// from an edge and dissolve rather than popping in place.
export function makeFinSymbolParticle(i: number, opts: FinSymbolParticleOptions): FinSymbolParticle {
  const { brandChance, glowChance, sizeMin, sizeMax, driftMin, driftMax } = opts;
  const edge = finPick<FinEdge>(["top", "bottom", "left", "right"]);
  const along = finRand(4, 96);
  const isBrand = Math.random() < brandChance;
  const glow = Math.random() < glowChance;
  const signX = edge === "left" ? 1 : edge === "right" ? -1 : finRand(-1, 1);
  const signY = edge === "top" ? 1 : edge === "bottom" ? -1 : finRand(-1, 1);
  return {
    id: i,
    symbol: finPick(FIN_SYMBOLS),
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
    peakOpacity: finRand(0.06, 0.2),
    glow,
    glowDuration: finRand(3, 6),
    glowDelay: finRand(0, 3),
  };
}

/** React's CSSProperties doesn't model custom properties (--foo) — this
 * widens it just enough to allow the --dx/--dy/--peak-op custom properties
 * the keyframes below read, without losing type-checking on everything else. */
type CSSPropertiesWithVars = React.CSSProperties & Record<`--${string}`, string | number>;

interface FinSymbolFieldProps {
  count?: number;
  sizeMin?: number;
  sizeMax?: number;
  driftMin?: number;
  driftMax?: number;
  brandChance?: number;
  glowChance?: number;
}

// Renders a contained field of drifting +/−/×/÷ and currency glyphs.
// `count` and the size/drift ranges scale the effect between the small
// action cards and the full dashboard background.
export function FinSymbolField({
  count = 8,
  sizeMin = 12,
  sizeMax = 20,
  driftMin = 30,
  driftMax = 90,
  brandChance = 0.12,
  glowChance = 0.14,
}: FinSymbolFieldProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        makeFinSymbolParticle(i, { brandChance, glowChance, sizeMin, sizeMax, driftMin, driftMax })
      ),
    [count, sizeMin, sizeMax, driftMin, driftMax, brandChance, glowChance]
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
            } as CSSPropertiesWithVars}
          >
            {p.symbol}
          </span>
        );
      })}
    </div>
  );
}

interface FinDotParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  peakOpacity: number;
  glow: boolean;
  glowDuration: number;
  glowDelay: number;
}

export function makeFinDotParticle(i: number): FinDotParticle {
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
export function FinDotField({ count = 24 }: { count?: number }) {
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
          } as CSSPropertiesWithVars}
        />
      ))}
    </div>
  );
}

// A handful of large, near-invisible outline shapes that turn very slowly —
// pure atmosphere, evoking a "mission control" fintech backdrop without
// competing with foreground content.
interface GeoShape {
  id: number;
  type: "circle" | "square";
  x: number;
  y: number;
  size: number;
  duration: number;
  color: string;
}

export const FIN_GEO_SHAPES: GeoShape[] = [
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

// Smaller, quieter field scoped to a single action card — spawns and drifts
// symbols behind the icon/label, clipped to the card's own rounded corners.
export function CardAmbientField() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, borderRadius: "inherit", pointerEvents: "none" }}>
      <FinSymbolField count={7} sizeMin={11} sizeMax={17} driftMin={26} driftMax={70} brandChance={0.14} glowChance={0.16} />
    </div>
  );
}
