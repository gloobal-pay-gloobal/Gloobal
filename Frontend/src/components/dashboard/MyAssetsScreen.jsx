import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Sprout, Clock, TrendingUp } from "lucide-react";
import { T } from "../../styles/theme";
import { getAssets } from "../../services/api/assetsApi";

// Cashback planted at payment time grows 1%/month, compounded, toward the
// original amount paid. Same formulas the backend uses (Backend/server.js
// computeSeed) so demo seeds and real seeds render identically.
const GROWTH_MONTHLY = 0.01;
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

function computeSeed(seed) {
  const cashback = Number(seed.cashback) || 0;
  const amountPaid = Number(seed.amountPaid) || 0;
  const planted = seed.plantedAt ? new Date(seed.plantedAt) : new Date();
  const yearsAccrued = Math.max(0, (Date.now() - planted.getTime()) / MS_PER_YEAR);
  const currentValue = cashback * Math.pow(1 + GROWTH_MONTHLY, yearsAccrued * 12);
  let yearsToTarget = 0;
  if (cashback > 0 && amountPaid > cashback) {
    yearsToTarget = Math.log(amountPaid / cashback) / Math.log(1 + GROWTH_MONTHLY) / 12;
  }
  return { ...seed, cashback, amountPaid, planted, yearsAccrued, currentValue, yearsToTarget };
}

// Shown only when the account has no real seeds yet, so the founder can see
// the whole feature working without needing live payments. Displayed with a
// "Demo data" chip and never stored anywhere.
const DEMO_SEEDS = [
  { id: "d1", business: "Airtel", category: "Telecom", amountPaid: 1000, cashbackRate: 0.01, cashback: 10, plantedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), currency: "INR" },
  { id: "d2", business: "BESCOM", category: "Electricity", amountPaid: 2500, cashbackRate: 0.02, cashback: 50, plantedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), currency: "INR" },
  { id: "d3", business: "Swiggy", category: "Food", amountPaid: 450, cashbackRate: 0.05, cashback: 22.5, plantedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), currency: "INR" },
  { id: "d4", business: "BookMyShow", category: "Entertainment", amountPaid: 800, cashbackRate: 0.07, cashback: 56, plantedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), currency: "INR" },
  { id: "d5", business: "Jio", category: "Telecom", amountPaid: 599, cashbackRate: 0.01, cashback: 5.99, plantedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), currency: "INR" },
];

const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const yr = (n) => `${(Number(n) || 0).toFixed(1)} yr`;

export function MyAssetsScreen({ ccy = "₹", symbolId, onClose, onOpenPayLater }) {
  const [raw, setRaw] = useState(null); // { seeds, ... } from API, or null while loading
  const [isDemo, setIsDemo] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detailSeed, setDetailSeed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = symbolId ? await getAssets(symbolId) : { seeds: [] };
        if (cancelled) return;
        if (!data.seeds || data.seeds.length === 0) {
          setRaw({ seeds: DEMO_SEEDS });
          setIsDemo(true);
        } else {
          setRaw(data);
          setIsDemo(false);
        }
      } catch {
        // Offline or backend waking up — still show the feature with demo
        // seeds rather than an empty screen.
        if (cancelled) return;
        setRaw({ seeds: DEMO_SEEDS });
        setIsDemo(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbolId]);

  const seeds = useMemo(() => (raw?.seeds || []).map(computeSeed), [raw]);
  const totalAssets = useMemo(() => seeds.reduce((s, x) => s + x.currentValue, 0), [seeds]);
  const futureAssets = useMemo(() => seeds.reduce((s, x) => s + x.amountPaid, 0), [seeds]);
  const avgYearsToTarget = useMemo(
    () => (seeds.length ? seeds.reduce((s, x) => s + x.yearsToTarget, 0) / seeds.length : 0),
    [seeds]
  );

  const money = (n) => `${ccy}${(Number(n) || 0).toFixed(2)}`;
  const visibleSeeds = expanded ? seeds : seeds.slice(0, 4);

  if (detailSeed) {
    return <AssetDetail seed={detailSeed} money={money} onBack={() => setDetailSeed(null)} />;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: T.fontBody }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
        <button
          onClick={onClose}
          aria-label="Back"
          className="v2-tap"
          style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <ArrowLeft size={18} color={T.ink} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>My Assets</span>
        {isDemo && (
          <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, color: T.accent, background: T.accentSoft, borderRadius: 999, padding: "4px 10px", letterSpacing: 0.3 }}>
            Demo data
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 18px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 1 — Total card */}
        <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "20px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>My Assets</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: T.accent, fontFamily: T.fontDisplay, marginTop: 4, lineHeight: 1.1 }}>
            {money(totalAssets)}
          </div>
          <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4 }}>
            Growing toward {money(futureAssets)}
          </div>

          {/* Stepper strip: Spending -> Earnings -> Assets */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14 }}>
            {["Spending", "Earnings", "Assets"].map((label, i) => (
              <React.Fragment key={label}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: "5px 10px",
                    borderRadius: 999,
                    color: label === "Assets" ? "#fff" : T.inkSoft,
                    background: label === "Assets" ? T.accent : T.surfaceAlt,
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
                {i < 2 && <span style={{ color: T.inkFaint, fontSize: 12, fontWeight: 800 }}>{"→"}</span>}
              </React.Fragment>
            ))}
          </div>

          {/* PayLater cross-link */}
          <button
            type="button"
            onClick={onOpenPayLater}
            className="v2-tap"
            style={{ marginTop: 14, border: "none", background: T.accentSoft, borderRadius: T.radiusMd, padding: "10px 12px", width: "100%", textAlign: "left", color: T.accent, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
          >
            = your PayLater limit ({money(totalAssets)}) {"→"}
          </button>
        </div>

        {/* 2 — Rate strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { value: "0–7%", label: "Cashback range" },
            { value: "1%/mo", label: "Growth rate" },
            { value: "Monthly", label: "Compounding" },
          ].map((t) => (
            <div key={t.label} style={{ background: T.surface, borderRadius: T.radiusMd, boxShadow: T.shadowCard, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.accent, fontFamily: T.fontDisplay }}>{t.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.inkFaint, marginTop: 3 }}>{t.label}</div>
            </div>
          ))}
        </div>

        {/* 3 — Per-transaction list */}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "4px 2px 8px" }}>
            Assets from spending
          </div>

          {/* Column headers */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 14px 8px", fontSize: 10, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.3 }}>
            <span style={{ flex: 1 }}>Business / Date</span>
            <span style={{ width: 60, textAlign: "center" }}>Rate</span>
            <span style={{ width: 70, textAlign: "right" }}>Time to full</span>
          </div>

          <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
            {visibleSeeds.map((s, i) => (
              <button
                key={s.id}
                data-testid="asset-seed-row"
                onClick={() => setDetailSeed(s)}
                className="v2-tap"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "13px 14px", border: "none", background: "none", cursor: "pointer", textAlign: "left", borderTop: i === 0 ? "none" : `1px solid ${T.line}` }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.business}</span>
                  <span style={{ display: "block", fontSize: 11, color: T.inkFaint, marginTop: 1 }}>{fmtDate(s.planted)}</span>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.positive, marginTop: 2 }}>{money(s.currentValue)} now</span>
                </span>
                <span style={{ width: 60, textAlign: "center", fontSize: 13, fontWeight: 800, color: T.accent }}>
                  {Math.round(s.cashbackRate * 100)}%
                </span>
                <span style={{ width: 70, textAlign: "right", fontSize: 12.5, fontWeight: 800, color: T.ink }}>
                  {yr(s.yearsToTarget)}
                </span>
              </button>
            ))}
          </div>

          {/* 4 — View all / Show less */}
          {seeds.length > 4 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="v2-tap"
              style={{ width: "100%", marginTop: 10, border: `1px solid ${T.line}`, background: T.surface, borderRadius: T.radiusMd, padding: "11px", fontSize: 12.5, fontWeight: 800, color: T.accent, cursor: "pointer" }}
            >
              {expanded ? "Show less" : `View all spending (${seeds.length})`}
            </button>
          )}

          {/* Average time card — only when expanded */}
          {expanded && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, background: T.surface, border: `1px solid ${T.accent}`, borderRadius: T.radiusLg, padding: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={18} color={T.accent} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.inkSoft }}>Average time to fully compound</span>
                <span style={{ display: "block", fontSize: 18, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, marginTop: 2 }}>{yr(avgYearsToTarget)}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Per-asset growth chart -------------------------------------------------
function AssetDetail({ seed, money, onBack }) {
  const { business, planted, cashback, amountPaid, cashbackRate, currentValue, yearsAccrued, yearsToTarget } = seed;

  // One point per year mark, monthly-compounded, from planting to target.
  const points = useMemo(() => {
    const n = Math.max(1, Math.ceil(yearsToTarget));
    return Array.from({ length: n + 1 }, (_, y) => ({
      year: y,
      value: cashback * Math.pow(1 + GROWTH_MONTHLY, y * 12),
    }));
  }, [cashback, yearsToTarget]);

  // SVG geometry
  const W = 320;
  const H = 200;
  const padL = 44;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const maxYear = Math.max(1, points[points.length - 1].year);
  const maxVal = Math.max(amountPaid, points[points.length - 1].value) || 1;
  const x = (year) => padL + (year / maxYear) * (W - padL - padR);
  const y = (val) => padT + (1 - val / maxVal) * (H - padT - padB);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const todayX = x(Math.min(yearsAccrued, maxYear));
  const targetY = y(amountPaid);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 310, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: T.fontBody }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          className="v2-tap"
          style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <ArrowLeft size={18} color={T.ink} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Asset growth</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 18px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header facts */}
        <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sprout size={18} color={T.accent} />
            <span style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{business}</span>
          </div>
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>{fmtDate(planted)}</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: T.inkSoft, fontWeight: 600 }}>
            <span>Cashback earned: <b style={{ color: T.ink }}>{money(cashback)}</b> ({Math.round(cashbackRate * 100)}%)</span>
            <span>Current value: <b style={{ color: T.positive }}>{money(currentValue)}</b></span>
            <span>Target: <b style={{ color: T.ink }}>{money(amountPaid)}</b> in {yr(yearsToTarget)}</span>
          </div>
        </div>

        {/* Chart */}
        <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "16px 12px" }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Growth curve for ${business}`}>
            {/* Y axis labels: start (cashback) and target (amountPaid) */}
            <text x={4} y={y(amountPaid) + 4} fontSize="9" fill={T.inkFaint}>{money(amountPaid)}</text>
            <text x={4} y={y(cashback) + 4} fontSize="9" fill={T.inkFaint}>{money(cashback)}</text>

            {/* Target line */}
            <line x1={padL} y1={targetY} x2={W - padR} y2={targetY} stroke={T.accent} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
            <text x={W - padR} y={targetY - 5} fontSize="9" fill={T.accent} textAnchor="end">{money(amountPaid)} (full)</text>

            {/* Growth curve */}
            <path d={path} fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Today marker */}
            <line x1={todayX} y1={padT} x2={todayX} y2={H - padB} stroke={T.inkSoft} strokeWidth="1" strokeDasharray="3 3" />
            <text x={todayX + 3} y={padT + 9} fontSize="9" fill={T.inkSoft}>Today</text>

            {/* X axis year ticks */}
            {points.filter((_, i) => i % Math.ceil(points.length / 6 || 1) === 0 || i === points.length - 1).map((p) => (
              <text key={p.year} x={x(p.year)} y={H - padB + 16} fontSize="9" fill={T.inkFaint} textAnchor="middle">{p.year}yr</text>
            ))}
          </svg>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4, fontSize: 10.5, color: T.inkFaint, fontWeight: 600 }}>
            <TrendingUp size={13} color={T.accent} /> 1%/mo compounded · X axis in years
          </div>
        </div>
      </div>
    </div>
  );
}
