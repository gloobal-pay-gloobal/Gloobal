import React, { useEffect, useRef, useState } from "react";
import {
  Delete,
} from "lucide-react";
import globalIdLogo from "../../assets/globalid-logo.png";
import { PhoneConnector } from "../auth/PhoneConnector";
import { T } from "../../styles/theme";

// 8 symbols sit as raised 3D tiles arranged evenly around a ring, with
// the delete/cross button fixed at the very center. Same progress dots
// Sits inside a shiny 3D circular housing with a slow breathing glow
// around its boundary.
export function SymbolDialPad({ value, onChange, length, showLogo = true }) {
  const symbolKeys = ["−", "+", "×", "=", "○", "□", "●", "■"];
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
  const housingRef = useRef(null);
  const dragRef = useRef(null);
  const momentumRef = useRef(null);
  const suppressClickRef = useRef(false);

  // --- Idle logo flip -----------------------------------------------------
  // The brand mark sits behind the ring as a quiet watermark. Whenever the
  // dial pad has gone untouched for a while it does a single 3D flip, then
  // waits a fresh, randomly-picked stretch of idle time before flipping
  // again — never a fixed interval, so it doesn't read as a ticking clock.
  // Any tap or drag on the dial cancels the pending flip and restarts the
  // countdown, so it only ever happens while no one is using it.
  const [logoFlips, setLogoFlips] = useState(0);
  const idleTimerRef = useRef(null);
  const backTimerRef = useRef(null);

  const randomIdleDelay = () => 6000 + Math.random() * 14000; // 6s–20s, never fixed
  const LOGO_SHOW_MS = 2000; // logo face shows for up to 2s, then auto-flips back

  const scheduleIdleFlip = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setLogoFlips((n) => n + 1); // flip to the logo face
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
      backTimerRef.current = setTimeout(() => {
        setLogoFlips((n) => n + 1); // flip straight back to the dial
        scheduleIdleFlip(); // then wait out a fresh idle window before doing it again
      }, LOGO_SHOW_MS);
    }, randomIdleDelay());
  };

  useEffect(() => {
    if (!showLogo) return; // showLogo={false} opts a specific instance out, but every dial pad in the app uses the default (true) today
    scheduleIdleFlip();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLogo]);

  const registerActivity = () => {
    if (showLogo) scheduleIdleFlip();
  };

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

  function angleFromCenter(clientX, clientY) {
    const rect = housingRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }

  function runMomentum(startVelocity) {
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

  function handlePointerDown(e) {
    if (isBackShowing) {
      // Tapping the logo face flips the coin straight back to the dial
      // and resets the idle countdown — no one gets stuck waiting.
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
      setLogoFlips((n) => n + 1);
      scheduleIdleFlip();
      return;
    }
    stopMomentum();
    registerActivity();
    const angle = angleFromCenter(e.clientX, e.clientY);
    // Note: the pointer is NOT captured here. Capturing on pointerdown
    // retargets the follow-up click to the housing, which silently
    // swallows tile taps on mouse input (touch synthesizes its click at
    // the touch point, so phones worked while laptops didn't). Capture
    // is taken in pointermove instead, only once a real drag begins.
    dragRef.current = { pointerId: e.pointerId, captured: false, lastAngle: angle, lastTime: performance.now(), velocity: 0, moved: 0 };
    suppressClickRef.current = false;
  }

  function handlePointerMove(e) {
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
    if (d.moved > 4) {
      suppressClickRef.current = true;
      if (!d.captured) {
        d.captured = true;
        housingRef.current?.setPointerCapture?.(d.pointerId);
      }
    }
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

  const press = (k) => {
    if (suppressClickRef.current) return; // that was a drag, not a tap
    registerActivity();
    if (k === "cross") onChange(value.slice(0, -1));
    else if (k && value.length < length) onChange(value + k);
  };

  // buttonSize was bumped up from 42 → 48 for easier tapping. radius was
  // increased from 58 → 64 (larger buttons need more room around the
  // circle or they'd overlap each other), and ringGap — the breathing
  // room between the tile ring and the housing's inner boundary — was
  // trimmed from 18 → 9 to absorb that difference, so ringSize/housingSize
  // (the outer ring/coin) stays pixel-for-pixel identical to before.
  const radius = 64;
  const buttonSize = 48;
  const ringSize = radius * 2 + buttonSize;
  const ringGap = 9; // breathing room between tile edges and the housing's inner boundary — trimmed to offset the bigger buttons above
  const housingSize = ringSize + 28 + ringGap * 2;
  // Dialled back from 0.74 → 0.40 (a ~46% reduction): at the old size the
  // mark filled most of the coin face and competed with the dial itself.
  // It now reads as a quiet watermark, which is what this face is for.
  const logoSize = housingSize * 0.4;
  const isBackShowing = showLogo && logoFlips % 2 === 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "100%" }}>
      <style>{`
        @keyframes symbolDialShine {
          0%, 100% { box-shadow: 0 12px 26px rgba(76,29,149,0.16), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 0 2px rgba(124,58,237,0.14); }
          50% { box-shadow: 0 12px 26px rgba(76,29,149,0.2), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 2px rgba(124,58,237,0.55), 0 0 22px 5px rgba(124,58,237,0.35); }
        }
        .symbol-dial-face { animation: symbolDialShine 3.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .symbol-dial-face { animation: none !important; }
          .symbol-dial-flip-inner { transition: none !important; }
        }
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

      {/* The housing is a literal two-sided coin: one face is the dial pad,
          the other is the brand mark. Whenever the dial has sat idle for a
          random stretch of time, it's the whole white circle that flips
          over (a real 3D rotateY on the shared inner wrapper) to reveal the
          logo face — not just an image flipping inside a static circle.
          Tapping while the logo face is showing flips it straight back to
          the dial and resets the idle countdown. Dial pads mounted with
          showLogo={false} never flip at all — only the dial face exists. */}
      <div
        ref={housingRef}
        className="symbol-dial-housing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: housingSize,
          height: housingSize,
          position: "relative",
          perspective: 700,
          touchAction: "none",
          cursor: "grab",
        }}
      >
        <div
          className="symbol-dial-flip-inner"
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transform: `rotateY(${logoFlips * 180}deg)`,
            transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Front face — the dial pad itself */}
          <div
            className="symbol-dial-face"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              padding: 14,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(160deg, #ffffff 0%, #f5f3fc 100%)",
              border: "1px solid rgba(124,58,237,0.16)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              pointerEvents: isBackShowing ? "none" : "auto",
            }}
          >
            <div style={{ position: "relative", width: ringSize, height: ringSize }}>
              {/* The actual dial pad */}
              <div style={{ position: "absolute", inset: 0 }}>
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
                        fontSize: 19,
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
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#EF4444" strokeWidth="2.4">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Back face — the brand mark. Only exists at all when this dial
              pad is allowed to flip (showLogo). Its own rotateY(180deg)
              cancels the wrapper's rotation once flipped, so the logo sits
              upright and facing the viewer instead of mirrored. */}
          {showLogo && (
            <div
              className="symbol-dial-face"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(160deg, #ffffff 0%, #f5f3fc 100%)",
                border: "1px solid rgba(124,58,237,0.16)",
                transform: "rotateY(180deg)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                pointerEvents: "none",
              }}
            >
              <img
                src={globalIdLogo}
                alt=""
                aria-hidden="true"
                style={{
                  width: logoSize,
                  height: "auto",
                  userSelect: "none",
                }}
              />
            </div>
          )}
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
export function CircularSymbolDial({ onPick }) {
  const [angle, setAngle] = useState(0); // degrees; each DIAL_SEGMENT_ANGLE step = one symbol at front
  const [dragging, setDragging] = useState(false);
  const drumRef = useRef(null);
  const angleRef = useRef(0); // mirrors `angle`, kept in sync synchronously during drags
  const dragRef = useRef(null);
  const momentumRef = useRef(null);
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
  function snapToNearest(fromAngle) {
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
  function runMomentum(startVelocity) {
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

  function handlePointerDown(e) {
    stopMomentum();
    // Same capture-on-drag-only rule as the ring pad above: capturing
    // here would retarget the follow-up click away from the tiles and
    // break taps for mouse input.
    dragRef.current = { pointerId: e.pointerId, captured: false, lastY: e.clientY, lastTime: performance.now(), velocity: 0, moved: 0 };
    setDragging(true);
  }

  function handlePointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastTime);
    const dy = e.clientY - d.lastY;
    const stepDelta = dy * DIAL_ROTATE_SENSITIVITY;
    d.velocity = (stepDelta / dt) * 16.6; // normalize to "degrees per ~frame"
    d.moved += Math.abs(dy);
    if (d.moved > 4 && !d.captured) {
      d.captured = true;
      drumRef.current?.setPointerCapture?.(d.pointerId);
    }
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
// Circular keypad used for mobile numbers, OTP, and PIN entry alike.
// Numbers vary from country to country and OTP/PIN are fixed-length, so
// instead of a row of dots sized to an exact length, it shows the digits
// themselves, grouped for readability, so there's no length to guess at
// up front.
export function PhoneDialPad({ value, onChange, minLength = 0, maxLength, onSubmit }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "in"];
  const press = (k) => {
    if (k === "back") onChange(value.slice(0, -1));
    else if (k && value.length < maxLength) onChange(value + k);
  };
  const grouped = value.replace(/(\d{3})(?=\d)/g, "$1 ");
  // Same completeness check PhoneConnector uses for its own call button —
  // reused here so the in-pad "IN" key enables/disables in lockstep with
  // every other submit control for this same value.
  const canSubmit = !!onSubmit && value.length >= (minLength || maxLength) && value.length <= maxLength;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, width: "100%" }}>
      <span
        style={{
          position: "absolute",
          top: -4,
          right: 4,
          fontSize: 10.5,
          fontWeight: 700,
          color: T.inkFaint,
          letterSpacing: 0.3,
        }}
      >
        {minLength && minLength !== maxLength ? `${value.length} (${minLength}–${maxLength})` : `${value.length}/${maxLength}`}
      </span>
      <div
        style={{
          minHeight: 26,
          minWidth: 160,
          padding: "0 6px 8px",
          borderBottom: `2px solid ${value ? T.accent : T.line}`,
          fontSize: 19,
          fontWeight: 800,
          letterSpacing: 0.5,
          color: T.ink,
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
          transition: "border-color 0.15s ease",
        }}
      >
        {grouped || <span style={{ color: T.inkFaint, fontWeight: 600, fontSize: 14 }}>—</span>}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          width: "100%",
          maxWidth: 220,
        }}
      >
        {keys.map((k, i) => {
          // The slot between "9" and "0" used to sit empty. When the pad
          // is given an onSubmit, that slot becomes the "IN" key instead
          // of an inert gap; when it isn't (e.g. the search dial pad),
          // the slot stays blank exactly as before.
          if (k === "in") {
            if (!onSubmit) return <span key={i} />;
            return (
              <button
                key={i}
                onClick={() => canSubmit && onSubmit()}
                disabled={!canSubmit}
                aria-label="Log in"
                className="v2-tap"
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: "50%",
                  border: "none",
                  background: canSubmit ? T.gradButton : T.gradButtonDisabled,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  opacity: canSubmit ? 1 : 0.6,
                  boxShadow: canSubmit ? "0 8px 18px rgba(124,58,237,0.32)" : "none",
                  transition: "opacity 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                IN
              </button>
            );
          }
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
                fontSize: 19,
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
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#EF4444" strokeWidth="2.4">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
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
