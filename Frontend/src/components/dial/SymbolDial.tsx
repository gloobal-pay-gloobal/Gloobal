import React, { useState, useEffect, useRef } from "react";
import { T } from "../../styles/theme";
import { Delete } from "lucide-react";
import globalIdLogo from "../../assets/globalid-logo.png";

interface SymbolDialPadProps {
  value: string;
  onChange: (next: string) => void;
  length: number;
  /** Shrinks the whole dial (ring, tiles, housing) around its center —
   * e.g. 0.8 for the Referral step, per founder feedback to reduce that
   * screen's visual bulk ~20% so it comfortably fits short viewports.
   * Defaults to 1 (Secure ID / Login dial, unchanged). Tiles never drop
   * below a ~48px touch target even at 0.8, keeping them tappable. */
  scale?: number;
}

interface RingDragState {
  lastAngle: number;
  lastTime: number;
  velocity: number;
  moved: number;
}

// A circular dial pad for entering Secure ID / Referral ID symbols — the
// 8 symbols sit as raised 3D tiles arranged evenly around a ring, with
// the delete/cross button fixed at the very center. Same progress dots
// and press/onChange behavior as before, arranged as a proper circle
// instead of a grid. Sits inside a shiny 3D circular housing with a slow
// breathing glow around its boundary; if left untouched for 5 seconds it
// flips over to show the Gloobal logo for a brief 1-2s glimpse (randomized)
// before flipping itself back to the dial pad — and it flips back
// immediately the moment it's tapped, so the logo is never a resting state.
export function SymbolDialPad({ value, onChange, length, scale = 1 }: SymbolDialPadProps) {
  const symbolKeys = ["−", "+", "×", "=", "○", "□", "●", "■"];
  const [idle, setIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearIdleReturnTimer() {
    if (idleReturnTimerRef.current) {
      clearTimeout(idleReturnTimerRef.current);
      idleReturnTimerRef.current = null;
    }
  }

  function scheduleIdle() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIdle(true), 5000);
  }

  useEffect(() => {
    scheduleIdle();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      clearIdleReturnTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once flipped to the logo, hold it for a random 1-2s glimpse, then
  // flip itself back to the dial pad automatically — the logo never
  // stays up waiting for a tap.
  useEffect(() => {
    if (idle) {
      const glimpseMs = 1000 + Math.random() * 1000; // random 1-2s
      idleReturnTimerRef.current = setTimeout(() => {
        setIdle(false);
        scheduleIdle();
      }, glimpseMs);
    }
    return clearIdleReturnTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle]);

  function wake() {
    clearIdleReturnTimer();
    setIdle(false);
    scheduleIdle();
  }

  // --- Drag-to-rotate ---------------------------------------------------
  // The whole ring of symbol tiles can be spun by dragging anywhere in the
  // housing, rotary-phone style. Each tile stays upright as it orbits (the
  // counter-rotation in its own transform cancels the ring's spin), and a
  // tap still presses whichever symbol is under the finger. A real drag
  // (movement past a small threshold) suppresses the click that would
  // otherwise fire on release, and releasing with some speed lets the ring
  // keep coasting with friction until it eases to a stop.
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const housingRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<RingDragState | null>(null);
  const momentumRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    return () => {
      if (momentumRef.current) cancelAnimationFrame(momentumRef.current);
    };
  }, []);

  function stopMomentum() {
    if (momentumRef.current) {
      cancelAnimationFrame(momentumRef.current);
      momentumRef.current = null;
    }
  }

  function angleFromCenter(clientX: number, clientY: number): number {
    const rect = housingRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }

  function runMomentum(startVelocity: number) {
    stopMomentum();
    let v = startVelocity;
    function step() {
      v *= 0.95;
      rotationRef.current += v;
      setRotation(rotationRef.current);
      if (Math.abs(v) < 0.05) {
        momentumRef.current = null;
        return;
      }
      momentumRef.current = requestAnimationFrame(step);
    }
    momentumRef.current = requestAnimationFrame(step);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    wake();
    // If the pointer actually went down on one of the symbol/delete
    // buttons, don't capture it — setPointerCapture on the housing
    // redirects the browser's click-target resolution away from the
    // button underneath, which silently ate every tap (confirmed: real
    // pointer clicks did nothing, a raw DOM .click() worked fine). Drag-
    // to-rotate only needs to engage when the gesture starts on the open
    // housing background, not on a button — a real tap on a button should
    // just fire that button's own onClick, untouched.
    if ((e.target as HTMLElement).closest("button")) return;
    stopMomentum();
    housingRef.current?.setPointerCapture?.(e.pointerId);
    const angle = angleFromCenter(e.clientX, e.clientY);
    dragRef.current = { lastAngle: angle, lastTime: performance.now(), velocity: 0, moved: 0 };
    suppressClickRef.current = false;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const now = performance.now();
    const angle = angleFromCenter(e.clientX, e.clientY);
    let stepDelta = angle - d.lastAngle;
    if (stepDelta > 180) stepDelta -= 360;
    if (stepDelta < -180) stepDelta += 360;
    const dt = Math.max(1, now - d.lastTime);
    d.velocity = (stepDelta / dt) * 16.6;
    d.moved += Math.abs(stepDelta);
    d.lastAngle = angle;
    d.lastTime = now;
    rotationRef.current += stepDelta;
    setRotation(rotationRef.current);
    if (d.moved > 4) suppressClickRef.current = true;
  }

  function handlePointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved > 4) {
      runMomentum(d.velocity);
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 150);
    } else {
      suppressClickRef.current = false;
    }
  }

  const press = (k: string) => {
    if (suppressClickRef.current) return; // that was a drag, not a tap
    wake();
    if (k === "cross") onChange(value.slice(0, -1));
    else if (k && value.length < length) onChange(value + k);
  };

  // Base size trimmed ~20% per founder feedback that the enlarged dial from
  // the previous round now reads as oversized — radius/buttonSize are still
  // chosen together so adjacent tiles clear each other (chord between
  // neighboring centers must exceed buttonSize), just off a smaller base.
  const SIZE_FACTOR = 0.8;
  const radius = 92 * SIZE_FACTOR * scale;
  const buttonSize = Math.max(48, 64 * SIZE_FACTOR * scale); // never below a ~48px touch target
  const ringSize = radius * 2 + buttonSize;
  const housingPadding = 10;
  const ringGap = 4; // breathing room between tile edges and the housing's inner boundary
  const tileFontSize = Math.max(18, 27 * SIZE_FACTOR * scale);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "100%" }}>
      <style>{`
        @keyframes symbolDialShine {
          0%, 100% { box-shadow: 0 12px 26px rgba(76,29,149,0.16), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 0 2px rgba(124,58,237,0.14); }
          50% { box-shadow: 0 12px 26px rgba(76,29,149,0.2), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 2px rgba(124,58,237,0.55), 0 0 22px 5px rgba(124,58,237,0.35); }
        }
        @media (prefers-reduced-motion: reduce) { .symbol-dial-housing { animation: none !important; } }
      `}</style>

      <div style={{ display: "flex", gap: 8 }}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              boxSizing: "border-box",
              background: i < value.length ? T.accent : "transparent",
              border: "1.5px solid " + (i < value.length ? T.accent : T.line),
              boxShadow: i < value.length ? "0 2px 6px rgba(124,58,237,0.35)" : "none",
              transition: "background 0.15s ease, box-shadow 0.15s ease",
            }}
          />
        ))}
      </div>

      {/* Shiny 3D housing — the whole dial pad sits "inside" this box, with
          a slow, breathing glow around its boundary. Tapping wakes the dial
          back up; dragging anywhere in the housing spins the ring of tiles
          like a rotary phone dial. The ring itself (ringSize) is kept
          noticeably smaller than the housing so the tiles float with clear
          breathing room and never touch the outer circle. */}
      <div
        ref={housingRef}
        className="symbol-dial-housing"
        onClick={wake}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: ringSize + housingPadding * 2 + ringGap * 2,
          height: ringSize + housingPadding * 2 + ringGap * 2,
          borderRadius: "50%",
          padding: housingPadding,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #ffffff 0%, #f5f3fc 100%)",
          border: "1px solid rgba(124,58,237,0.16)",
          animation: "symbolDialShine 3.6s ease-in-out infinite",
          touchAction: "none",
          cursor: "grab",
        }}
      >
        <div style={{ perspective: 700 }}>
          <div
            style={{
              position: "relative",
              width: ringSize,
              height: ringSize,
              transformStyle: "preserve-3d",
              transform: idle ? "rotateY(180deg)" : "rotateY(0deg)",
              transition: "transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)",
            }}
          >
            {/* Front face: the actual dial pad */}
            <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
              {symbolKeys.map((k, i) => {
                const baseAngle = (360 / symbolKeys.length) * i;
                const angle = baseAngle + rotation;
                return (
                  <button
                    key={i}
                    onClick={() => press(k)}
                    aria-label={`Symbol ${k}`}
                    className="v2-tap"
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: buttonSize,
                      height: buttonSize,
                      margin: -buttonSize / 2,
                      transform: `rotate(${angle}deg) translate(0, -${radius}px) rotate(${-angle}deg)`,
                      borderRadius: "50%",
                      border: "1px solid rgba(124,58,237,0.18)",
                      background: "linear-gradient(160deg, #ffffff 0%, #f2effb 100%)",
                      color: T.ink,
                      fontSize: tileFontSize,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow:
                        "0 6px 12px rgba(76,29,149,0.16), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -3px 5px rgba(124,58,237,0.08)",
                      transition: dragRef.current
                        ? "box-shadow 0.15s ease"
                        : "transform 0.1s ease, box-shadow 0.15s ease",
                    }}
                  >
                    {k}
                  </button>
                );
              })}

              {/* Delete/cross — fixed at the exact center of the ring */}
              <button
                onClick={() => press("cross")}
                aria-label="Delete last symbol"
                className="v2-tap"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: buttonSize,
                  height: buttonSize,
                  margin: -buttonSize / 2,
                  borderRadius: "50%",
                  border: `1px solid ${T.line}`,
                  background: T.surface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: T.shadowCard,
                }}
              >
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke={T.accent} strokeWidth="2.4">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Back face: the Gloobal logo, shown after 5s idle */}
            <div
              aria-hidden={!idle}
              style={{
                position: "absolute",
                inset: 0,
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {/* Enlarged per founder feedback — the dial's idle face read as
                  mostly empty housing around a small logo; sized to actually
                  use that space instead of floating in it. */}
              <img
                src={globalIdLogo}
                alt="Gloobal ID"
                style={{ height: Math.round(68 * scale), width: "auto", objectFit: "contain" }}
              />
              <div style={{ fontSize: Math.round(16 * scale), fontWeight: 800, letterSpacing: 0.4, color: T.ink, fontFamily: T.fontDisplay }}>
                Gloobal ID
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// CircularSymbolDial — a premium rotating drum shared by Secure ID and
// Referral ID. Every symbol sits on its own individual 3D tile mounted on
// the surface of a rotating cylinder — drag up/down and it spins like an
// old combination-lock reel, each tile tilting through 3D space as it
// comes into view. Pure: it doesn't know which field is being filled, it
// just spins and reports picks via onPick("○" | "●" | "□" | "■" | "*" |
// "−" | "×" | "=" | "DEL"). Both screens mount the exact same component
// with a different onPick, so the rotation, gestures, and styling are
// guaranteed identical everywhere it's used.
// ---------------------------------------------------------------------
export const DIAL_SEGMENTS = ["○", "●", "□", "■", "*", "−", "×", "=", "DEL"];
export const DIAL_SEGMENT_ANGLE = 360 / DIAL_SEGMENTS.length;
export const DIAL_DRUM_RADIUS = 92;
export const DIAL_ROTATE_SENSITIVITY = 0.5; // degrees of drum rotation per pixel dragged

interface CircularSymbolDialProps {
  onPick: (symbol: string) => void;
}

interface DrumDragState {
  lastY: number;
  lastTime: number;
  velocity: number;
  moved: number;
}

export function CircularSymbolDial({ onPick }: CircularSymbolDialProps) {
  const [angle, setAngle] = useState(0); // degrees; each DIAL_SEGMENT_ANGLE step = one symbol at front
  const [dragging, setDragging] = useState(false);
  const drumRef = useRef<HTMLDivElement | null>(null);
  const angleRef = useRef(0); // mirrors `angle`, kept in sync synchronously during drags
  const dragRef = useRef<DrumDragState | null>(null);
  const momentumRef = useRef<number | null>(null);
  const lastActiveRef = useRef(0);

  useEffect(() => {
    angleRef.current = angle;
  }, [angle]);

  const activeIndex = (() => {
    const raw = Math.round(angle / DIAL_SEGMENT_ANGLE);
    return ((raw % DIAL_SEGMENTS.length) + DIAL_SEGMENTS.length) % DIAL_SEGMENTS.length;
  })();

  // Subtle haptic "detent" click every time a new symbol reaches the
  // front — silently does nothing on devices/browsers without the
  // Vibration API (notably iOS Safari).
  useEffect(() => {
    if (activeIndex !== lastActiveRef.current) {
      lastActiveRef.current = activeIndex;
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(6);
    }
  }, [activeIndex]);

  useEffect(() => {
    return () => {
      if (momentumRef.current) cancelAnimationFrame(momentumRef.current);
    };
  }, []);

  function stopMomentum() {
    if (momentumRef.current) {
      cancelAnimationFrame(momentumRef.current);
      momentumRef.current = null;
    }
  }

  // Eases the drum to rest with a symbol precisely centered at the front.
  function snapToNearest(fromAngle: number) {
    stopMomentum();
    const target = Math.round(fromAngle / DIAL_SEGMENT_ANGLE) * DIAL_SEGMENT_ANGLE;
    let a = fromAngle;
    function step() {
      const diff = target - a;
      if (Math.abs(diff) < 0.25) {
        angleRef.current = target;
        setAngle(target);
        momentumRef.current = null;
        return;
      }
      a += diff * 0.22;
      angleRef.current = a;
      setAngle(a);
      momentumRef.current = requestAnimationFrame(step);
    }
    momentumRef.current = requestAnimationFrame(step);
  }

  // Flick-to-spin: keeps turning at the release velocity, losing speed to
  // friction each frame, then snaps to the nearest symbol once it's slow.
  function runMomentum(startVelocity: number) {
    stopMomentum();
    let v = startVelocity;
    let a = angleRef.current;
    function step() {
      v *= 0.94;
      a += v;
      angleRef.current = a;
      if (Math.abs(v) < 0.6) {
        snapToNearest(a);
        return;
      }
      setAngle(a);
      momentumRef.current = requestAnimationFrame(step);
    }
    momentumRef.current = requestAnimationFrame(step);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    stopMomentum();
    drumRef.current?.setPointerCapture?.(e.pointerId);
    dragRef.current = { lastY: e.clientY, lastTime: performance.now(), velocity: 0, moved: 0 };
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastTime);
    const dy = e.clientY - d.lastY;
    const stepDelta = dy * DIAL_ROTATE_SENSITIVITY;
    d.velocity = (stepDelta / dt) * 16.6; // normalize to "degrees per ~frame"
    d.moved += Math.abs(dy);
    d.lastY = e.clientY;
    d.lastTime = now;
    const newAngle = angleRef.current + stepDelta;
    angleRef.current = newAngle; // update synchronously so a fast second
    // pointermove in the same tick never reads a stale angle
    setAngle(newAngle);
  }

  function handlePointerUp() {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setDragging(false);

    const wasTap = d.moved < 4;
    if (wasTap) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(14);
      onPick(DIAL_SEGMENTS[activeIndex]);
      return;
    }
    if (Math.abs(d.velocity) > 1) {
      runMomentum(d.velocity);
    } else {
      snapToNearest(angleRef.current);
    }
  }

  const windowHeight = 190;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{`
        @keyframes dialTilePulse { 0%, 100% { transform: translate(-50%, -50%) rotateX(0deg) translateZ(${DIAL_DRUM_RADIUS}px) scale(1); } 50% { transform: translate(-50%, -50%) rotateX(0deg) translateZ(${DIAL_DRUM_RADIUS}px) scale(1.08); } }
        @media (prefers-reduced-motion: reduce) { .dial-active-tile { animation: none !important; } }
      `}</style>

      <div
        ref={drumRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label="Symbol dial. Drag up or down to rotate, tap the highlighted symbol to enter it."
        aria-valuenow={activeIndex}
        aria-valuemin={0}
        aria-valuemax={DIAL_SEGMENTS.length - 1}
        style={{
          position: "relative",
          width: 150,
          height: windowHeight,
          overflow: "hidden",
          touchAction: "none",
          cursor: dragging ? "grabbing" : "grab",
          userSelect: "none",
          perspective: 420,
        }}
      >
        {/* fade top/bottom of the window, so tiles ease out of view instead of clipping abruptly */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 4,
            pointerEvents: "none",
            background: "linear-gradient(180deg, rgba(8,9,15,0.9) 0%, rgba(8,9,15,0) 30%, rgba(8,9,15,0) 70%, rgba(8,9,15,0.9) 100%)",
          }}
        />
        {/* fixed selection band at the vertical center — doesn't rotate with the drum */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 118,
            height: 52,
            zIndex: 2,
            pointerEvents: "none",
            borderRadius: 14,
            border: `1.5px solid ${T.accent}`,
            boxShadow: `0 0 16px 2px rgba(124,58,237,0.45), inset 0 0 14px rgba(124,58,237,0.18)`,
          }}
        />

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 0,
            height: 0,
            transformStyle: "preserve-3d",
          }}
        >
          {DIAL_SEGMENTS.map((sym, i) => {
            const effAngle = i * DIAL_SEGMENT_ANGLE - angle;
            const rad = (effAngle * Math.PI) / 180;
            const depth = Math.cos(rad); // 1 = facing front, -1 = facing away
            const isActive = i === activeIndex;
            if (depth < -0.05) return null; // hide tiles on the far side of the drum
            const scale = 0.62 + 0.38 * Math.max(0, depth);
            const opacity = Math.max(0, depth);
            return (
              <div
                key={i}
                aria-hidden="true"
                className={isActive ? "dial-active-tile" : undefined}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 58,
                  height: 58,
                  marginLeft: -29,
                  marginTop: -29,
                  borderRadius: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isActive ? 26 : 18,
                  fontWeight: 800,
                  color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
                  background: isActive
                    ? "linear-gradient(160deg, #9D6BFF 0%, #7C3AED 55%, #4C1D95 100%)"
                    : "linear-gradient(160deg, #333c5c 0%, #1b2038 100%)",
                  border: isActive ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: isActive
                    ? "0 10px 24px rgba(124,58,237,0.55), 0 0 22px 4px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.35)"
                    : "0 6px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
                  transformStyle: "preserve-3d",
                  transform: `translate(-50%, -50%) rotateX(${effAngle}deg) translateZ(${DIAL_DRUM_RADIUS}px) scale(${scale})`,
                  opacity,
                  transition: dragging ? "none" : "transform 0.12s ease, font-size 0.12s ease, background 0.12s ease, box-shadow 0.12s ease",
                  animation: isActive ? "dialTilePulse 1.3s ease-in-out infinite" : "none",
                }}
              >
                {sym === "DEL" ? <Delete size={17} /> : sym}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


interface PinDialPadProps {
  value: string;
  onChange: (next: string) => void;
  length: number;
}

// Numeric dial pad used on the PIN screen: 1-9, then a blank, 0, and a
// backspace key, styled like a phone dial pad.
export function PinDialPad({ value, onChange, length }: PinDialPadProps) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

  const press = (k: string) => {
    if (k === "back") onChange(value.slice(0, -1));
    else if (k && value.length < length) onChange(value + k);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, width: "100%" }}>
      <div style={{ display: "flex", gap: 12 }}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              boxSizing: "border-box",
              background: i < value.length ? T.accent : "transparent",
              border: "1.5px solid " + (i < value.length ? T.accent : T.line),
              boxShadow: i < value.length ? "0 2px 6px rgba(124,58,237,0.35)" : "none",
              transition: "background 0.15s ease, box-shadow 0.15s ease",
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          width: "100%",
          maxWidth: 260,
        }}
      >
        {keys.map((k, i) => {
          if (k === "") return <span key={i} />;
          const isBack = k === "back";
          return (
            <button
              key={i}
              onClick={() => press(k)}
              aria-label={isBack ? "Delete last digit" : `Digit ${k}`}
              className="v2-tap"
              style={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: "50%",
                border: `1px solid ${T.line}`,
                background: T.surface,
                color: T.ink,
                fontSize: 22,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: T.shadowCard,
                transition: "transform 0.1s ease, box-shadow 0.15s ease",
              }}
            >
              {isBack ? (
                <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke={T.accent} strokeWidth="2.2">
                  <path d="M21 5H8l-6 7 6 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 9.5l-4 5M10 9.5l4 5" strokeLinecap="round" />
                </svg>
              ) : (
                k
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
