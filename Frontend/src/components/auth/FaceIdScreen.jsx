import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScanFace, ShieldAlert } from "lucide-react";
import { T } from "../../styles/theme";
import { PinScreenHeader } from "./PinScreenShell";
import { FACE_MODEL_TAG, createBlinkDetector, detectFace, loadFaceEngine } from "../../services/faceEngine";
import { enrollFace, verifyFace } from "../../services/api/faceApi";

// Face verification, as an additional factor.
//
// mode="enroll"  — records the reference face. Requires a blink.
// mode="verify"  — scores a fresh capture against the enrolled one.
//
// The camera frames never leave this component. They are drawn by the
// browser, read by the model, and discarded; what goes to the server is a
// vector of floats. Nothing here can sign a person in on its own — the
// caller decides what a verified face unlocks, and the passkey and PIN
// remain the primary factors.

const PHASE = {
  BOOTING: "booting", // loading ~13MB of models
  WAITING_CAMERA: "waiting_camera",
  FINDING_FACE: "finding_face",
  BLINK: "blink",
  CAPTURING: "capturing",
  SUBMITTING: "submitting",
  DONE: "done",
  ERROR: "error",
};

// How long to keep looking before admitting it is not going to work. Long
// enough for someone to find the light, short enough not to strand them.
const ATTEMPT_TIMEOUT_MS = 45_000;
const FRAME_INTERVAL_MS = 120;

export function FaceIdScreen({ mode = "verify", symbolId, onBack, onSuccess, onFailure }) {
  const isEnroll = mode === "enroll";

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const blinkRef = useRef(createBlinkDetector());
  const cancelledRef = useRef(false);
  const startedAtRef = useRef(0);

  const [phase, setPhase] = useState(PHASE.BOOTING);
  const [message, setMessage] = useState("Getting the camera ready…");
  const [error, setError] = useState(null);
  const [ear, setEar] = useState(null);
  const [spoof, setSpoof] = useState(false);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  // Releasing the camera on unmount is not optional: a live track leaves the
  // recording indicator on, which reads as the app watching you after you
  // left the screen.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    cancelledRef.current = false;
    startedAtRef.current = Date.now();
    blinkRef.current.reset();

    let timer = null;

    const fail = (reason, text) => {
      if (cancelledRef.current) return;
      setPhase(PHASE.ERROR);
      setError(text);
      stopCamera();
      if (onFailure) onFailure(reason);
    };

    const run = async () => {
      // 1. Camera first. If this is refused there is no point loading 13MB
      // of models.
      setPhase(PHASE.WAITING_CAMERA);
      setMessage("Allow camera access to continue.");
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (err) {
        const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
        return fail(
          denied ? "camera_denied" : "camera_unavailable",
          denied
            ? "Camera access was blocked. Allow it in your browser settings, or use your PIN instead."
            : "No camera is available on this device. Use your PIN or passkey instead."
        );
      }
      if (cancelledRef.current) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Autoplay can be refused; the loop below still reads frames.
        }
      }

      // 2. Models.
      setPhase(PHASE.BOOTING);
      setMessage("Preparing face verification…");
      try {
        await loadFaceEngine();
      } catch {
        return fail("engine_unavailable", "Face verification could not start on this device.");
      }
      if (cancelledRef.current) return;

      // 3. Frame loop: find a face, then require a blink, then capture.
      setPhase(PHASE.FINDING_FACE);
      setMessage("Center your face in the circle.");

      const tick = async () => {
        if (cancelledRef.current) return;

        if (Date.now() - startedAtRef.current > ATTEMPT_TIMEOUT_MS) {
          return fail("timeout", "That took too long. Try again in better light, or use your PIN.");
        }

        let reading;
        try {
          reading = await detectFace(videoRef.current);
        } catch {
          timer = setTimeout(tick, FRAME_INTERVAL_MS);
          return;
        }
        if (cancelledRef.current) return;

        if (!reading.found) {
          setMessage("Center your face in the circle.");
          setPhase(PHASE.FINDING_FACE);
          timer = setTimeout(tick, FRAME_INTERVAL_MS);
          return;
        }

        // The anti-spoof and liveness classifiers get a say before the blink
        // challenge, so an obvious screen replay is rejected immediately.
        if (reading.spoofSuspected) {
          setSpoof(true);
          setMessage("That looks like a photo or a screen. Use your real face.");
          timer = setTimeout(tick, FRAME_INTERVAL_MS);
          return;
        }
        setSpoof(false);

        setEar(reading.eyes?.ear ?? null);

        const blinked = blinkRef.current.push(reading.eyes?.ear);
        if (!blinked) {
          setPhase(PHASE.BLINK);
          setMessage("Now blink once, slowly.");
          timer = setTimeout(tick, FRAME_INTERVAL_MS);
          return;
        }

        // 4. Blink seen. This frame is the one we submit.
        if (!Array.isArray(reading.descriptor) || reading.descriptor.length === 0) {
          setMessage("Hold still a moment longer…");
          timer = setTimeout(tick, FRAME_INTERVAL_MS);
          return;
        }

        setPhase(PHASE.SUBMITTING);
        setMessage(isEnroll ? "Saving your face…" : "Checking your face…");
        stopCamera();

        try {
          if (isEnroll) {
            await enrollFace({
              symbolId,
              descriptor: reading.descriptor,
              model: FACE_MODEL_TAG,
              livenessPassed: true,
            });
            if (cancelledRef.current) return;
            setPhase(PHASE.DONE);
            setMessage("Face saved.");
            if (onSuccess) onSuccess({ enrolled: true });
            return;
          }

          const result = await verifyFace({
            symbolId,
            descriptor: reading.descriptor,
            model: FACE_MODEL_TAG,
            livenessPassed: true,
          });
          if (cancelledRef.current) return;

          if (result.verified) {
            setPhase(PHASE.DONE);
            setMessage("Verified.");
            if (onSuccess) onSuccess(result);
            return;
          }
          return fail(
            result.reason || "no_match",
            result.message || "That face did not match the one saved for this account."
          );
        } catch (err) {
          return fail("server", err instanceof Error ? err.message : "Face verification failed.");
        }
      };

      tick();
    };

    run();

    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, symbolId]);

  const busy = phase === PHASE.BOOTING || phase === PHASE.SUBMITTING;

  return (
    <div
      data-testid="face-id-screen"
      data-face-phase={phase}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: T.fontBody,
      }}
    >
      <PinScreenHeader onBack={onBack} title={isEnroll ? "Set up Face ID" : "Verify it's you"} />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          padding: "28px 24px 40px",
          overflowY: "auto",
        }}
      >
        {/* The preview is mirrored so moving left moves the image left —
            an unmirrored self-view makes centering weirdly difficult. */}
        <div
          style={{
            position: "relative",
            width: 240,
            height: 240,
            borderRadius: "50%",
            overflow: "hidden",
            border: `3px solid ${spoof ? "#dc2626" : phase === PHASE.DONE ? T.positive : T.accent}`,
            background: T.surfaceAlt,
            boxShadow: T.shadowFloat,
            transition: "border-color 0.2s ease",
          }}
        >
          <video
            ref={videoRef}
            data-testid="face-video"
            playsInline
            muted
            autoPlay
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
            }}
          />
        </div>

        <div
          data-testid="face-status"
          style={{ fontSize: 14, fontWeight: 700, color: T.ink, textAlign: "center", maxWidth: 300 }}
        >
          {message}
        </div>

        {phase === PHASE.BLINK && (
          <div
            data-testid="face-blink-prompt"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              background: T.accentSoft,
              color: T.accentDeep,
              fontSize: 12.5,
              fontWeight: 800,
            }}
          >
            <ScanFace size={16} />
            Blink to confirm you&apos;re really here
          </div>
        )}

        {/* Live eye-openness readout. Useful to a person wondering why the
            blink is not registering, and the hook the e2e suite watches. */}
        {ear !== null && (
          <div data-testid="face-ear" data-ear={ear.toFixed(3)} style={{ fontSize: 11, color: T.inkFaint, fontWeight: 600 }}>
            eye openness {ear.toFixed(3)}
          </div>
        )}

        {busy && (
          <div style={{ fontSize: 12, color: T.inkFaint, fontWeight: 600 }}>Working…</div>
        )}

        {error && (
          <div
            data-testid="face-error"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              maxWidth: 320,
              padding: 14,
              borderRadius: T.radiusLg,
              background: T.surface,
              border: "1px solid rgba(220,38,38,0.35)",
              color: "#dc2626",
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Face is never the only way through. Whatever the outcome here,
            the PIN and passkey stay reachable. */}
        <button
          type="button"
          onClick={onBack}
          className="v2-tap"
          style={{
            marginTop: "auto",
            border: "none",
            background: "none",
            color: T.inkFaint,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            padding: "6px 8px",
            textDecoration: "underline",
          }}
        >
          {isEnroll ? "Skip for now" : "Use PIN instead"}
        </button>
      </div>
    </div>
  );
}
