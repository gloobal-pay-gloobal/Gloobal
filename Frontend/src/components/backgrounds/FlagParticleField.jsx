import React, { useEffect, useRef, useState } from "react";
import { FlagSignShape } from "../common/FlagComponents";
import { ALL_COUNTRIES } from "../../constants/countries";

// The background flow: every particle is a single country flag, masked into
// one of six silhouettes (+, -, ×, =, ○, ▢) as it drifts up the stage.
export const SIGN_TYPES = ["+", "-", "×", "=", "circle", "square"];
export const MAX_PARTICLES = 20;
export const BOX_SIZES = [14, 18, 24, 32, 40, 52];
// A particle is "born" at 1/10th of its box size (a pinprick / tiny star)
// and grows up to its full, existing size as it rises up the stage.
export const GROWTH_START_SCALE = 1 / 10;
export function makeParticle(w, h, onlyFlag = null, varied = false) {
  const spawnX = Math.random() * w;
  const spawnY = h + 10 + Math.random() * 20;

  // Gentler, narrower drift range so the flow reads as calm and even
  // rather than scattered.
  const bias = (spawnX / w - 0.5) * 2; // -1 (left) to 1 (right)
  let vx = bias * (0.2 + Math.random() * 0.3);
  let vy = -(0.35 + Math.random() * 0.4);

  // Varied mode (the selected-country flow): slower overall, with a wide
  // per-particle spread — some flags drift lazily, some move quick, so
  // the single-flag wall still feels alive rather than uniform.
  if (varied) {
    const speedMul = 0.22 + Math.random() * 1.15;
    vx *= speedMul * 0.8;
    vy *= speedMul * 0.7;
  }

  const box = BOX_SIZES[Math.floor(Math.random() * BOX_SIZES.length)];
  const sign = SIGN_TYPES[Math.floor(Math.random() * SIGN_TYPES.length)];
  const flag = onlyFlag || ALL_COUNTRIES[Math.floor(Math.random() * ALL_COUNTRIES.length)].flag;

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
// The exact same "flags flowing" concept as the registration screen's
// background (growth from a pinprick, gentle collision-avoiding drift,
// twinkle, shape-masked into +/-/×/=/○/▢) — reused here as the primary
// content of a box instead of a faint backdrop, so opacity runs much
// higher and the box owns its own particle loop scoped to its own size
// instead of the full viewport.
export function FlagFlowBox({ opacityBoost = 2.4, onlyFlag = null, varied = false }) {
  const containerRef = useRef(null);
  const particlesRef = useRef([]);
  const elsRef = useRef({});
  const rafRef = useRef(null);
  const dimsRef = useRef({ w: 0, h: 0 });
  const frameRef = useRef(0);
  const [, forceRender] = useState(0);

  useEffect(() => {
    function measure() {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      dimsRef.current = { w, h };
      if (particlesRef.current.length === 0 && w && h) {
        // Seed particles spread through the whole box (not all starting at
        // the bottom edge), so it reads as already "flowing" on first paint.
        particlesRef.current = Array.from({ length: MAX_PARTICLES }, () => {
          const p = makeParticle(w, h, onlyFlag, varied);
          p.y = Math.random() * h;
          p.spawnY = p.y;
          return p;
        });
        forceRender((n) => n + 1);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const tick = () => {
      frameRef.current += 1;
      const { w, h } = dimsRef.current;
      if (!w || !h) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const arr = particlesRef.current;

      for (const p of arr) {
        p.x += p.vx;
        p.y += p.vy;
        p.twinklePhase += p.twinkleSpeed;
      }

      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i];
          const b = arr[j];
          const ra = (Math.max(a.pw, a.ph) * a.scale) / 2;
          const rb = (Math.max(b.pw, b.ph) * b.scale) / 2;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          const minDist = (ra + rb) * 0.9;
          if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;
            const push = 0.18;
            a.vx -= nx * push;
            a.vy -= ny * push * 0.25;
            b.vx += nx * push;
            b.vy += ny * push * 0.25;
            a.vx = Math.max(-1.3, Math.min(1.3, a.vx));
            b.vx = Math.max(-1.3, Math.min(1.3, b.vx));
            a.vy = Math.max(-1.6, Math.min(-0.15, a.vy));
            b.vy = Math.max(-1.6, Math.min(-0.15, b.vy));
          }
        }
      }

      for (const p of arr) {
        const distFromBottom = h - p.y;
        let baseOpacity;
        if (distFromBottom < 60) baseOpacity = Math.min(0.9, distFromBottom / 60);
        else baseOpacity = 0.35 + Math.abs(Math.sin(p.twinklePhase)) * 0.55;
        p.opacity = Math.min(1, baseOpacity * opacityBoost);

        const traveled = p.spawnY - p.y;
        const growthRatio = Math.min(1, traveled / (h * 0.5));
        const eased = 1 - Math.pow(1 - growthRatio, 3);
        p.scale = GROWTH_START_SCALE + (1 - GROWTH_START_SCALE) * eased;

        const el = elsRef.current[p.id];
        if (el) {
          el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.scale})`;
          el.style.opacity = p.opacity;
        }
      }

      let changed = false;
      particlesRef.current = arr.filter((p) => {
        const alive = p.y > -30 && p.x > -30 && p.x < w + 30;
        if (!alive) changed = true;
        return alive;
      });
      if (frameRef.current % 10 === 0 && particlesRef.current.length < MAX_PARTICLES) {
        particlesRef.current.push(makeParticle(w, h, onlyFlag, varied));
        changed = true;
      }
      if (changed) forceRender((n) => n + 1);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opacityBoost]);

  return (
    <div ref={containerRef} aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {particlesRef.current.map((p) => (
        <div
          key={p.id}
          ref={(el) => {
            if (el) elsRef.current[p.id] = el;
            else delete elsRef.current[p.id];
          }}
          style={{
            position: "absolute",
            top: -(p.ph / 2),
            left: -(p.pw / 2),
            width: p.pw,
            height: p.ph,
            userSelect: "none",
            pointerEvents: "none",
            willChange: "transform, opacity",
            opacity: p.opacity,
          }}
        >
          <FlagSignShape sign={p.sign} flag={p.flag} box={p.box} />
        </div>
      ))}
    </div>
  );
}
// A handful of country flags that gently drift/fade behind the screen as
// ambient decoration. Purely visual — computed once and animated with CSS
// (transform + opacity only) so it stays smooth without per-frame JS.
export const AMBIENT_FLAG_CODES = ['US', 'BR', 'IN', 'JP', 'FR', 'DE', 'GB', 'AU', 'CA', 'ZA', 'MX', 'KR', 'ES', 'AE'];
