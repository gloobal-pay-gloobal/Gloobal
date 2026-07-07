import React, { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import { ensureScanSafeDark, hashSeed } from "../../lib/qr";
import { SYMBOL_COLORS } from "../../lib/symbolColors";
import { T } from "../../styles/theme";


// Renders a REAL, camera-scannable QR code encoding `token` — an actual
// ISO/IEC 18004 module grid from the `qrcode` library, at error-correction
// level H (~30% of modules can be damaged/recolored and it still decodes,
// which is what gives us room to brand it below). This replaced an earlier
// purely-decorative circular badge that could never actually be scanned;
// nothing here is randomized filler — every dark module is real data.
//
// Styling rules, in order of how much scan-reliability they cost:
//   1. The 3 finder patterns (the corner squares scanners lock onto first)
//      and their white separator ring are drawn in ONE solid, scan-safe
//      brand-ink color. These never get per-module randomized — finder
//      pattern detection is the least tolerant part of the whole pipeline.
//   2. Every other dark module (timing pattern, alignment pattern, data,
//      format/version info) gets a color drawn from the same brand
//      palette, each forced dark enough to keep contrast, so the bulk of
//      the code still reads as colorful.
//   3. A full 4-module quiet (blank) zone is kept on all sides, and the
//      whole thing renders as a plain square — no circular clipping —
//      since both are required by the spec for reliable detection.
type QrModules = ReturnType<typeof QRCode.create>["modules"];

interface QrMatrixProps {
  token: string;
  size?: number;
  color?: string;
}

export function QrMatrix({ token, size = 200, color = T.ink }: QrMatrixProps) {
  const [qr, setQr] = useState<QrModules | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const built = QRCode.create(token, { errorCorrectionLevel: "H" });
      if (!cancelled) setQr(built.modules);
    } catch (e) {
      if (!cancelled) setQr(null);
    }
    return () => {
      cancelled = true;
    };
  }, [token]);

  const scanSafePalette = useMemo(
    () => Object.values(SYMBOL_COLORS).map((c) => ensureScanSafeDark(c)),
    []
  );
  const finderColor = useMemo(() => ensureScanSafeDark(color), [color]);

  // Precompute which cells to draw and what color each gets. Uses its own
  // fresh seeded generator (keyed off `token`, not a shared/mutating one)
  // so the coloring is stable across re-renders of the same token instead
  // of reshuffling on every unrelated parent update.
  const cells = useMemo(() => {
    if (!qr) return { list: [], modCount: 0 };
    const modCount = qr.size;
    const localRand = hashSeed(`${token}::modules`);

    const inFinderZone = (r: number, c: number) => {
      const tl = r < 8 && c < 8;
      const tr = r < 8 && c > modCount - 9;
      const bl = r > modCount - 9 && c < 8;
      return tl || tr || bl;
    };

    const list = [];
    for (let r = 0; r < modCount; r++) {
      for (let c = 0; c < modCount; c++) {
        if (!qr.get(r, c)) continue; // light module — leave as white background
        const finderZone = inFinderZone(r, c);
        list.push({
          r,
          c,
          fill: finderZone
            ? finderColor
            : scanSafePalette[Math.floor(localRand() * scanSafePalette.length)],
        });
      }
    }
    return { list, modCount };
  }, [qr, token, finderColor, scanSafePalette]);

  if (!qr) {
    // Brief loading state while the real module grid is computed (near
    // instant) — avoids a blank flash between token rotations.
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Generating scannable code">
        <rect width={size} height={size} fill="#fff" />
      </svg>
    );
  }

  const QUIET = 4; // modules of required blank margin on every side (spec minimum)
  const totalModules = cells.modCount + QUIET * 2;
  const px = size / totalModules;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Scannable Global ID code">
      <rect width={size} height={size} fill="#fff" />
      {cells.list.map((cell, i) => (
        <rect
          key={i}
          x={(cell.c + QUIET) * px}
          y={(cell.r + QUIET) * px}
          width={px}
          height={px}
          fill={cell.fill}
        />
      ))}
    </svg>
  );
}
