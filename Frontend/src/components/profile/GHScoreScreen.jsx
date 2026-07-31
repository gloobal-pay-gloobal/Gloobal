import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Check,
  Lock,
  X,
  Heart,
  BookOpen,
  UtensilsCrossed,
  Brain,
  Handshake,
  Users2,
  Shield,
  Leaf,
  RefreshCw,
  Zap,
  Wallet,
  CreditCard,
  Moon,
  Home,
  Droplet,
  ShieldCheck,
} from "lucide-react";
import { T } from "../../styles/theme";

// ---------------------------------------------------------------------------
// GH Score — the Gloobal Human Score.
//
// Ported from the founder's standalone GHScore.jsx (2026-07-31). That file
// carried its own local `T` for isolated iteration; this reads the app's
// shared tokens instead, so the screen moves with the rest of the design
// system rather than drifting from it. The only token the standalone had
// that the shared object doesn't is `ringTrack` (the unfilled part of each
// ring segment), which is T.surface here — same white, one source.
//
// Four pillars, five check-ins each:
//   Self / Community / Environment  (dailyRotation) — always re-answerable.
//     The question shown, and any math operands, are derived from today's
//     date, so they change day to day with no backend involved.
//   Finance  (locksAfterAnswer) — each item locks permanently on first
//     answer. No rotation, no second attempt.
//
// The overall score appears on its own once all twenty are answered. There
// is no "Generate" button: the score is derived from the answers, so asking
// someone to request a number the app already has was only ever a step.
// ---------------------------------------------------------------------------

// Injected once into the document head rather than rendered as an inline
// <style> per mount — this screen opens and closes over the dashboard, and
// a fresh <style> node on every open would pile up.
const GH_STYLE_ID = "gh-score-styles";
const GH_STYLE = `
@keyframes ghScorePop {
  0% { opacity: 0; transform: scale(0.85); }
  60% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ghFloatA { 0%, 100% { transform: translateY(0) rotate(var(--r)); } 50% { transform: translateY(-10px) rotate(var(--r)); } }
@keyframes ghFloatB { 0%, 100% { transform: translateY(0) rotate(var(--r)); } 50% { transform: translateY(8px) rotate(var(--r)); } }
.gh-score-reveal { animation: ghScorePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.gh-float-a { animation-name: ghFloatA; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.gh-float-b { animation-name: ghFloatB; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
@media (prefers-reduced-motion: reduce) {
  .gh-score-reveal, .gh-float-a, .gh-float-b { animation: none; }
}
`;

function ChevronRightIcon() {
  return <ChevronRight size={15} color="#c3bfe0" strokeWidth={2.4} />;
}

// #RRGGBB -> "rgba(r,g,b,alpha)" — used to derive soft icon-chip backgrounds
// and progress-bar tracks from whatever colour a pillar is currently set to,
// including custom ones picked in the colour sheet.
function hexToRgba(hex, alpha) {
  const clean = (hex || T.accent).replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Organic "amoeba" shapes (asymmetric border-radius plus a slight rotation)
// so the colour-picker's pillar tabs don't read as plain circles.
const GH_BLOB_SHAPES = [
  { radius: "63% 37% 54% 46% / 55% 48% 52% 45%", rotate: -8 },
  { radius: "42% 58% 63% 37% / 41% 51% 49% 59%", rotate: 6 },
  { radius: "58% 42% 39% 61% / 63% 41% 59% 37%", rotate: -5 },
  { radius: "37% 63% 47% 53% / 58% 39% 61% 42%", rotate: 9 },
];

// Decorative digits drifting behind the overview ring — texture, not data.
const GH_FLOAT_NUMS = [
  { text: "2", top: "6%", left: "6%", size: 30, rotate: -14, color: hexToRgba("#7C3AED", 0.14), anim: "gh-float-a", dur: "5.5s", delay: "0s" },
  { text: "8", top: "9%", right: "7%", size: 20, rotate: 11, color: hexToRgba("#F97316", 0.17), anim: "gh-float-b", dur: "4.8s", delay: "0.4s" },
  { text: "5", top: "65%", left: "4%", size: 38, rotate: 9, color: hexToRgba("#14B8A6", 0.13), anim: "gh-float-a", dur: "6.2s", delay: "0.8s" },
  { text: "4", top: "70%", right: "5%", size: 25, rotate: -9, color: hexToRgba("#EC4899", 0.16), anim: "gh-float-b", dur: "5.1s", delay: "0.2s" },
  { text: "0", top: "2%", left: "40%", size: 17, rotate: 4, color: hexToRgba("#7C3AED", 0.11), anim: "gh-float-a", dur: "5.8s", delay: "1.1s" },
  { text: "3", top: "39%", left: "2%", size: 19, rotate: -7, color: hexToRgba("#F97316", 0.14), anim: "gh-float-b", dur: "4.5s", delay: "0.6s" },
  { text: "1", top: "37%", right: "3%", size: 23, rotate: 7, color: hexToRgba("#14B8A6", 0.14), anim: "gh-float-a", dur: "6.6s", delay: "0.3s" },
  { text: "9", top: "87%", left: "40%", size: 19, rotate: -10, color: hexToRgba("#EC4899", 0.13), anim: "gh-float-b", dur: "5.4s", delay: "0.9s" },
  { text: "6", top: "18%", left: "22%", size: 15, rotate: 6, color: hexToRgba("#F97316", 0.1), anim: "gh-float-a", dur: "5s", delay: "1.4s" },
  { text: "7", top: "24%", right: "20%", size: 16, rotate: -5, color: hexToRgba("#7C3AED", 0.1), anim: "gh-float-b", dur: "6s", delay: "0.5s" },
];

// Hue/saturation (0-360, 0-1) at full brightness <-> "#rrggbb". The wheel
// needs both directions: one to report what you drag to, one to place its
// knob at whatever colour a pillar is already set to.
function hsvToHex(h, s, v = 1) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}
function hexToHsv(hex) {
  const clean = (hex || T.accent).replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max };
}

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------
export const GH_CATEGORIES = [
  {
    key: "self",
    label: "Self",
    blurb: "Mind, body & personal well-being",
    icon: Heart,
    color: "#7C3AED",
    dailyRotation: true,
    items: [
      { key: "health", label: "Health", icon: Heart, type: "yesno", questions: ["Are you healthy?", "Are you feeling good in your body today?", "Are you taking care of your health today?"] },
      { key: "education", label: "Education", icon: BookOpen, type: "math", question: "Quick check — what's {a} + {b}?" },
      { key: "food", label: "Food", icon: UtensilsCrossed, type: "yesno", questions: ["Are you eating what you love?", "Did you enjoy your last meal?", "Are you eating well today?"] },
      { key: "mental", label: "Mentally", icon: Brain, type: "yesno", questions: ["Are you okay?", "Is your headspace in a good place today?", "Are you feeling mentally well today?"] },
      { key: "sleep", label: "Sleep", icon: Moon, type: "yesno", questions: ["Did you get enough sleep last night?", "Are you sleeping well these days?", "Did you wake up feeling rested?"] },
    ],
  },
  {
    key: "community",
    label: "Community",
    blurb: "People, connections & contribution",
    icon: Handshake,
    color: "#F97316",
    dailyRotation: true,
    items: [
      { key: "belonging", label: "Belonging", icon: Users2, type: "yesno", questions: ["Do you feel you belong where you live?", "Do you feel at home in your community?", "Do you feel accepted where you live?"] },
      { key: "support", label: "Support", icon: Handshake, type: "yesno", questions: ["Do you help others around you?", "Did you help someone today?", "Do you support the people around you?"] },
      { key: "trust", label: "Trust", icon: Shield, type: "yesno", questions: ["Do you trust the people around you?", "Do you feel safe trusting your neighbors?", "Do you generally trust the people you deal with?"] },
      { key: "voice", label: "Voice", icon: BookOpen, type: "math", question: "Quick check — what's {a} + {b}?" },
      { key: "family", label: "Family", icon: Home, type: "yesno", questions: ["Do you feel connected to your family?", "Have you connected with family recently?", "Do you feel close to your family?"] },
    ],
  },
  {
    key: "environment",
    label: "Environment",
    blurb: "Planet, resources & sustainability",
    icon: Leaf,
    color: "#14B8A6",
    dailyRotation: true,
    items: [
      { key: "recycling", label: "Recycling", icon: RefreshCw, type: "yesno", questions: ["Do you recycle regularly?", "Did you recycle today?", "Do you make an effort to recycle?"] },
      { key: "energy", label: "Energy", icon: Zap, type: "yesno", questions: ["Do you try to save energy at home?", "Did you save energy today?", "Are you mindful about energy use?"] },
      { key: "nature", label: "Nature", icon: Leaf, type: "yesno", questions: ["Do you spend time in nature?", "Did you spend time outdoors today?", "Do you make time for nature regularly?"] },
      { key: "awareness", label: "Awareness", icon: BookOpen, type: "math", question: "Quick check — what's {a} + {b}?" },
      { key: "water", label: "Water", icon: Droplet, type: "yesno", questions: ["Do you try to conserve water?", "Did you try to save water today?", "Are you mindful about how much water you use?"] },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    blurb: "Money habits & financial health",
    icon: Wallet,
    color: "#EC4899",
    locksAfterAnswer: true,
    items: [
      { key: "savings", label: "Savings", icon: Wallet, type: "yesno", question: "Do you save money regularly?" },
      { key: "budgeting", label: "Budgeting", icon: BookOpen, type: "math", question: "Quick check — what's {a} + {b}?" },
      { key: "debt", label: "Debt", icon: Shield, type: "yesno", question: "Do you feel in control of your debts?" },
      { key: "security", label: "Security", icon: CreditCard, type: "yesno", question: "Do you feel financially secure?" },
      { key: "insurance", label: "Insurance", icon: ShieldCheck, type: "yesno", question: "Do you have insurance coverage for emergencies?" },
    ],
  },
];

const GH_DEFAULT_COLORS = GH_CATEGORIES.reduce((acc, c) => ({ ...acc, [c.key]: c.color }), {});

export const ghTotalQuestions = GH_CATEGORIES.reduce((s, c) => s + c.items.length, 0);

function ghDailySeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function ghTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Everything this screen keeps is filed under the account's Gloobal ID.
// DashboardScreen's ID_SCOPED_LOCAL_KEYS carries both across a rename.
const ghStorageKey = (symbolId) => `gloobal.ghAnswers.${symbolId || "guest"}`;
const ghColorsKey = (symbolId) => `gloobal.ghColors.${symbolId || "guest"}`;

// ---------------------------------------------------------------------------
// Segmented ring — one 90° quadrant per pillar (Community, Finance,
// Environment, Self going clockwise from 12 o'clock), each split into a
// coloured "answered" arc and an empty "remaining" arc proportional to that
// pillar's score out of 100. A conic-gradient with a donut hole punched out,
// and a thin gap at each quadrant boundary.
// ---------------------------------------------------------------------------
function GHSegmentedRing({ size, thickness, segments, gapDeg, children }) {
  const stops = [];
  let angle = 0;
  segments.forEach((seg) => {
    const span = 90 - gapDeg;
    const filled = span * seg.pct;
    stops.push(`${seg.color} ${angle}deg ${angle + filled}deg`);
    stops.push(`${T.surface} ${angle + filled}deg ${angle + span}deg`);
    angle += span;
    stops.push(`${T.bg} ${angle}deg ${angle + gapDeg}deg`);
    angle += gapDeg;
  });
  return (
    <div data-testid="gh-ring" style={{ position: "relative", width: size, height: size, flexShrink: 0, transition: "transform 0.3s ease" }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: `conic-gradient(${stops.join(",")})`, boxShadow: "0 0 0 1px rgba(21,19,42,0.07)" }} />
      <div
        style={{
          position: "absolute", inset: thickness, borderRadius: "50%", background: T.surface,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: "inset 0 0 0 1px rgba(21,19,42,0.04)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// A full HSV colour wheel you drag on directly — angle picks hue, distance
// from the centre picks saturation (white at the middle, fully saturated at
// the rim). Pointer capture keeps the drag tracking when the finger slides
// past the wheel's edge.
function GHColorWheel({ size, hue, sat, onChange }) {
  const ref = useRef(null);
  const dragging = useRef(false);

  const update = (clientX, clientY) => {
    const rect = ref.current.getBoundingClientRect();
    const radius = rect.width / 2;
    const dx = clientX - (rect.left + radius);
    const dy = clientY - (rect.top + radius);
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    onChange(angle, radius === 0 ? 0 : dist / radius);
  };
  const handleDown = (e) => {
    dragging.current = true;
    ref.current.setPointerCapture(e.pointerId);
    update(e.clientX, e.clientY);
  };
  const handleMove = (e) => {
    if (!dragging.current) return;
    update(e.clientX, e.clientY);
  };
  const handleUp = (e) => {
    dragging.current = false;
    try {
      ref.current.releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released — nothing to undo
    }
  };

  const radius = size / 2;
  const knobDist = sat * radius;
  const angleRad = (hue * Math.PI) / 180;
  const knobX = radius + Math.cos(angleRad) * knobDist;
  const knobY = radius + Math.sin(angleRad) * knobDist;

  return (
    <div
      ref={ref}
      data-testid="gh-color-wheel"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      style={{
        position: "relative", width: size, height: size, flexShrink: 0,
        borderRadius: "58% 42% 45% 55% / 60% 45% 55% 40%",
        touchAction: "none", cursor: "pointer",
        background:
          "radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 100%), " +
          "conic-gradient(from 90deg, #FF0000 0deg, #FFFF00 60deg, #00FF00 120deg, #00FFFF 180deg, #0000FF 240deg, #FF00FF 300deg, #FF0000 360deg)",
        boxShadow: "inset 0 0 0 1px rgba(21,19,42,0.08)",
      }}
    >
      <div
        style={{
          position: "absolute", left: knobX - 11, top: knobY - 11, width: 22, height: 22, borderRadius: "50%",
          background: hsvToHex(hue, sat, 1), border: "3px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export function GHScoreScreen({ symbolId, onClose }) {
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const [ghScreen, setGhScreen] = useState("categories"); // categories | items | question | complete
  const [ghActiveCategory, setGhActiveCategory] = useState(null);
  const [ghActiveItem, setGhActiveItem] = useState(null);
  const [ghAnswers, setGhAnswers] = useState({});
  const [ghMathNums, setGhMathNums] = useState({}); // Finance's one-time math operands only
  const [ghMathInput, setGhMathInput] = useState("");

  // Per-pillar colour, customisable from the colour sheet behind the header's
  // palette icon. Every screen reads colour through catColor()/catSoft()
  // rather than the static cat.color, so a change shows up everywhere at once.
  const [ghCategoryColors, setGhCategoryColors] = useState({ ...GH_DEFAULT_COLORS });
  const [ghColorPickerCat, setGhColorPickerCat] = useState("self");
  const [ghShowColorSheet, setGhShowColorSheet] = useState(false);
  const [ghWheelHue, setGhWheelHue] = useState(0);
  const [ghWheelSat, setGhWheelSat] = useState(0);

  // The keyframes this screen animates with, added to the head once and left
  // there. The id makes a second mount a no-op rather than a duplicate.
  useEffect(() => {
    if (document.getElementById(GH_STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = GH_STYLE_ID;
    el.textContent = GH_STYLE;
    document.head.appendChild(el);
  }, []);

  // Answers survive a refresh — they are the whole point of a daily check-in,
  // and a page reload is not a reason to make somebody answer twice. Answers
  // written by the previous GH screen used different item keys, so they
  // simply match nothing here and are ignored rather than crashing.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ghStorageKey(symbolId));
      if (raw) setGhAnswers(JSON.parse(raw) || {});
    } catch {
      // corrupt or unavailable storage — start clean rather than crash
    }
    try {
      const rawColors = window.localStorage.getItem(ghColorsKey(symbolId));
      if (rawColors) setGhCategoryColors({ ...GH_DEFAULT_COLORS, ...(JSON.parse(rawColors) || {}) });
    } catch {
      // same — fall back to the default palette
    }
  }, [symbolId]);

  const persistAnswers = (next) => {
    setGhAnswers(next);
    try {
      window.localStorage.setItem(ghStorageKey(symbolId), JSON.stringify(next));
    } catch {
      // private mode / quota — the in-memory answers still work this session
    }
  };
  const persistColors = (next) => {
    setGhCategoryColors(next);
    try {
      window.localStorage.setItem(ghColorsKey(symbolId), JSON.stringify(next));
    } catch {
      // as above — the colours still apply for this session
    }
  };

  const catColor = (catKey) => ghCategoryColors[catKey] || GH_DEFAULT_COLORS[catKey];
  const catSoft = (catKey, alpha = 0.14) => hexToRgba(catColor(catKey), alpha);
  const selectedColorCat = GH_CATEGORIES.find((c) => c.key === ghColorPickerCat);
  const ghPendingColor = hsvToHex(ghWheelHue, ghWheelSat, 1);

  // Whenever the colour sheet opens, or a different pillar tab is picked,
  // snap the wheel's knob to that pillar's current colour rather than
  // wherever it was last left.
  useEffect(() => {
    if (!ghShowColorSheet) return;
    const { h, s } = hexToHsv(ghCategoryColors[ghColorPickerCat] || GH_DEFAULT_COLORS[ghColorPickerCat]);
    setGhWheelHue(h);
    setGhWheelSat(s);
  }, [ghShowColorSheet, ghColorPickerCat, ghCategoryColors]);

  const ghIsLocked = (catKey, itemKey) => {
    const cat = GH_CATEGORIES.find((c) => c.key === catKey);
    return Boolean(cat.locksAfterAnswer && ghAnswers[`${catKey}.${itemKey}`]);
  };
  const ghQuestionText = (catKey, item) => {
    if (!item.questions) return item.question;
    const seed = ghDailySeed(`${ghTodayKey()}.${catKey}.${item.key}`);
    return item.questions[seed % item.questions.length];
  };
  const ghMathNumsFor = (catKey, item) => {
    const cat = GH_CATEGORIES.find((c) => c.key === catKey);
    const qId = `${catKey}.${item.key}`;
    if (cat.dailyRotation) {
      const seedA = ghDailySeed(`${ghTodayKey()}.${qId}.a`);
      const seedB = ghDailySeed(`${ghTodayKey()}.${qId}.b`);
      return { a: 12 + (seedA % 70), b: 11 + (seedB % 70) };
    }
    return ghMathNums[qId] || { a: 12 + Math.floor(Math.random() * 70), b: 11 + Math.floor(Math.random() * 70) };
  };

  const ghCategoryScore = (catKey) => {
    const cat = GH_CATEGORIES.find((c) => c.key === catKey);
    const answered = cat.items.filter((it) => ghAnswers[`${catKey}.${it.key}`]);
    if (answered.length === 0) return null;
    const total = answered.reduce((s, it) => s + ghAnswers[`${catKey}.${it.key}`].points, 0);
    return Math.round((total / (answered.length * 25)) * 100);
  };
  const ghOverallScore = () => {
    const scores = GH_CATEGORIES.map((c) => ghCategoryScore(c.key)).filter((s) => s !== null);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };
  const ghTotalAnswered = Object.keys(ghAnswers).length;
  const ghCanGenerate = ghTotalAnswered === ghTotalQuestions;
  const ghTier = (score) => {
    if (score === null) return "Not scored yet";
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Fair";
    return "Needs Work";
  };
  const ghMaxTotal = GH_CATEGORIES.length * 100;
  const ghRawTotal = GH_CATEGORIES.reduce((s, c) => s + (ghCategoryScore(c.key) || 0), 0);

  const ghOpenCategory = (catKey) => {
    setGhActiveCategory(catKey);
    setGhScreen("items");
  };
  const ghOpenQuestion = (catKey, item) => {
    // A locked Finance item is not a question any more, it's a record.
    if (ghIsLocked(catKey, item.key)) {
      showToast("Finance answers lock after your first response");
      return;
    }
    setGhActiveCategory(catKey);
    setGhActiveItem(item.key);
    if (item.type === "math") {
      const qId = `${catKey}.${item.key}`;
      const cat = GH_CATEGORIES.find((c) => c.key === catKey);
      const existing = ghAnswers[qId];
      if (!cat.dailyRotation) {
        setGhMathNums((m) => ({
          ...m,
          [qId]: m[qId] || { a: 12 + Math.floor(Math.random() * 70), b: 11 + Math.floor(Math.random() * 70) },
        }));
      }
      setGhMathInput(existing ? String(existing.value) : "");
    }
    setGhScreen("question");
  };
  const ghAnswerYesNo = (catKey, itemKey, value) => {
    const qId = `${catKey}.${itemKey}`;
    const next = { ...ghAnswers, [qId]: { type: "yesno", value, points: value === "yes" ? 25 : 10, day: ghTodayKey() } };
    persistAnswers(next);
    setGhScreen(Object.keys(next).length === ghTotalQuestions ? "complete" : "items");
  };
  const ghSubmitMath = (catKey, itemKey) => {
    const qId = `${catKey}.${itemKey}`;
    const cat = GH_CATEGORIES.find((c) => c.key === catKey);
    const nums = cat.dailyRotation
      ? ghMathNumsFor(catKey, cat.items.find((it) => it.key === itemKey))
      : ghMathNums[qId];
    const correct = Boolean(nums) && Number(ghMathInput) === nums.a + nums.b;
    const next = { ...ghAnswers, [qId]: { type: "math", value: ghMathInput, correct, points: correct ? 25 : 10, day: ghTodayKey() } };
    persistAnswers(next);
    setGhScreen(Object.keys(next).length === ghTotalQuestions ? "complete" : "items");
  };

  const ghResetColors = () => {
    persistColors({ ...GH_DEFAULT_COLORS });
    const { h, s } = hexToHsv(GH_DEFAULT_COLORS[ghColorPickerCat]);
    setGhWheelHue(h);
    setGhWheelSat(s);
    showToast("Colours reset to default");
  };
  const ghSaveColor = () => {
    persistColors({ ...ghCategoryColors, [ghColorPickerCat]: ghPendingColor });
    showToast(`${selectedColorCat.label} colour saved`);
    setGhShowColorSheet(false);
  };

  // Ring segments clockwise from 12 o'clock: Community (top-right), Finance
  // (bottom-right), Environment (bottom-left), Self (top-left).
  const ringOrder = ["community", "finance", "environment", "self"];
  const ringSegments = ringOrder.map((key) => ({
    color: catColor(key),
    pct: (ghCategoryScore(key) || 0) / 100,
  }));

  // Back steps through the screens, and off the first one it closes — this
  // is an overlay above the dashboard, not a page with somewhere else to go.
  const handleBack = () => {
    if (ghScreen === "question") setGhScreen("items");
    else if (ghScreen === "items") {
      setGhScreen("categories");
      setGhActiveCategory(null);
    } else onClose?.();
  };

  return (
    <div
      data-testid="gh-score-screen"
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: T.bg,
        display: "flex", justifyContent: "center", overflow: "hidden", fontFamily: T.fontBody,
      }}
    >
      <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column", position: "relative", minHeight: 0 }}>
        {ghScreen !== "complete" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(20px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
            <button
              onClick={handleBack}
              aria-label="Back"
              className="v2-tap"
              style={{
                width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface,
                boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, cursor: "pointer",
              }}
            >
              <ArrowLeft size={18} color={T.ink} />
            </button>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, minWidth: 0 }}>GH Score</div>
            {ghScreen === "categories" && (
              <button
                onClick={() => setGhShowColorSheet(true)}
                data-testid="gh-color-open"
                aria-label="Change colours"
                className="v2-tap"
                style={{
                  marginLeft: "auto", width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  border: "none", padding: 3, background: T.surface, boxShadow: T.shadowCard,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: "100%", height: "100%", borderRadius: "50%",
                    background:
                      "radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 100%), " +
                      "conic-gradient(from 90deg, #FF0000 0deg, #FFFF00 60deg, #00FF00 120deg, #00FFFF 180deg, #0000FF 240deg, #FF00FF 300deg, #FF0000 360deg)",
                    boxShadow: "inset 0 0 0 1px rgba(21,19,42,0.1)",
                  }}
                />
              </button>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 18px 30px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* ---------- Overview: ring + pillar list ---------- */}
          {ghScreen === "categories" && (
            <>
              <div style={{ position: "relative", background: T.surface, borderRadius: T.radiusXl, padding: "30px 14px", boxShadow: T.shadowCard, overflow: "hidden" }}>
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {GH_FLOAT_NUMS.map((n, i) => (
                    <span
                      key={i}
                      className={n.anim}
                      style={{
                        position: "absolute", top: n.top, left: n.left, right: n.right,
                        fontSize: n.size, fontWeight: 800, color: n.color, fontFamily: T.fontDisplay,
                        userSelect: "none",
                        "--r": `${n.rotate}deg`,
                        animationDuration: n.dur,
                        animationDelay: n.delay,
                      }}
                    >
                      {n.text}
                    </span>
                  ))}
                </div>

                <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <GHSegmentedRing size={196} thickness={17} gapDeg={4} segments={ringSegments}>
                    <div
                      key={ghCanGenerate ? "done" : "pending"}
                      className={ghCanGenerate ? "gh-score-reveal" : ""}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
                    >
                      <span data-testid="gh-score-value" style={{ fontSize: 42, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, lineHeight: 1 }}>
                        {ghCanGenerate ? ghRawTotal : "—"}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.inkFaint, marginTop: 3 }}>out of {ghMaxTotal}</span>
                      {ghCanGenerate && (
                        <span data-testid="gh-tier" style={{ fontSize: 13, fontWeight: 800, color: T.positive, marginTop: 4 }}>
                          {ghTier(ghOverallScore())}
                        </span>
                      )}
                    </div>
                  </GHSegmentedRing>

                  <span data-testid="gh-progress" style={{ fontSize: 12, fontWeight: 700, color: ghCanGenerate ? T.positive : T.inkFaint }}>
                    {ghCanGenerate ? "All check-ins complete" : `${ghTotalAnswered}/${ghTotalQuestions} answered`}
                  </span>
                </div>
              </div>

              <div style={{ borderRadius: T.radiusLg, background: T.surface, overflow: "hidden", boxShadow: T.shadowCard }}>
                {GH_CATEGORIES.map((cat, i) => {
                  const Icon = cat.icon;
                  const score = ghCategoryScore(cat.key);
                  const color = catColor(cat.key);
                  const answeredCount = cat.items.filter((it) => ghAnswers[`${cat.key}.${it.key}`]).length;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => ghOpenCategory(cat.key)}
                      data-testid={`gh-category-${cat.key}`}
                      className="v2-row"
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 14,
                        padding: "14px 16px", border: "none",
                        borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
                        background: "none", cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: hexToRgba(color, 0.14), display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={17} color={color} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: T.ink }}>{cat.label}</span>
                        <span style={{ display: "block", height: 5, borderRadius: 999, background: T.surfaceAlt, marginTop: 7, overflow: "hidden" }}>
                          <span style={{ display: "block", height: "100%", width: `${score || 0}%`, borderRadius: 999, background: color, transition: "width 0.4s ease" }} />
                        </span>
                      </span>
                      <span style={{ textAlign: "right", flexShrink: 0 }}>
                        <span data-testid={`gh-score-${cat.key}`} style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: score === null ? T.inkFaint : color }}>
                          {score === null ? "—" : score}
                        </span>
                        <span data-testid={`gh-progress-${cat.key}`} style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.inkFaint, marginTop: 1 }}>
                          {answeredCount}/{cat.items.length}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ---------- The check-ins for one pillar ---------- */}
          {ghScreen === "items" && ghActiveCategory && (() => {
            const cat = GH_CATEGORIES.find((c) => c.key === ghActiveCategory);
            const Icon = cat.icon;
            const score = ghCategoryScore(cat.key);
            const color = catColor(cat.key);
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 42, height: 42, borderRadius: 13, background: catSoft(cat.key), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={19} color={color} />
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, flex: 1, minWidth: 0 }}>{cat.label}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: score === null ? T.inkFaint : color }}>
                    {score === null ? "—" : score}
                  </div>
                </div>

                <div style={{ borderRadius: T.radiusLg, background: T.surface, overflow: "hidden", boxShadow: T.shadowCard }}>
                  {cat.items.map((item, i) => {
                    const ItemIcon = item.icon;
                    const ans = ghAnswers[`${cat.key}.${item.key}`];
                    const locked = ghIsLocked(cat.key, item.key);
                    let statusText;
                    if (locked) {
                      statusText = ans.type === "yesno" ? `Locked — ${ans.value === "yes" ? "Yes" : "No"}` : `Locked — ${ans.value}`;
                    } else if (!ans) {
                      statusText = "Not answered yet";
                    } else if (ans.type === "yesno") {
                      statusText = `${ans.value === "yes" ? "Yes" : "No"}${ans.day === ghTodayKey() ? " · today" : " · tap to refresh"}`;
                    } else {
                      statusText = `${ans.value} (${ans.correct ? "correct" : "not quite"})${ans.day === ghTodayKey() ? " · today" : " · tap to refresh"}`;
                    }
                    return (
                      <button
                        key={item.key}
                        onClick={() => ghOpenQuestion(cat.key, item)}
                        data-testid={`gh-item-${cat.key}-${item.key}`}
                        disabled={locked}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 14,
                          padding: "14px 16px", border: "none",
                          borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
                          background: "none", cursor: locked ? "default" : "pointer", textAlign: "left",
                          opacity: locked ? 0.72 : 1,
                        }}
                      >
                        <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <ItemIcon size={15} color={T.inkSoft} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink }}>{item.label}</span>
                          <span style={{ display: "block", fontSize: 11, color: T.inkFaint, marginTop: 1 }}>{statusText}</span>
                        </span>
                        {locked ? (
                          <span data-testid={`gh-lock-${cat.key}-${item.key}`} style={{ display: "flex", flexShrink: 0 }} aria-hidden="true">
                            <Lock size={15} color={T.inkFaint} />
                          </span>
                        ) : ans ? (
                          <span data-testid={`gh-answered-${cat.key}-${item.key}`} style={{ display: "flex", flexShrink: 0 }} aria-hidden="true">
                            <Check size={16} color={T.positive} />
                          </span>
                        ) : (
                          <ChevronRightIcon />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {/* ---------- One question ---------- */}
          {ghScreen === "question" && ghActiveCategory && ghActiveItem && (() => {
            const cat = GH_CATEGORIES.find((c) => c.key === ghActiveCategory);
            const item = cat.items.find((it) => it.key === ghActiveItem);
            const color = catColor(cat.key);
            const nums = item.type === "math" ? ghMathNumsFor(cat.key, item) : null;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 6 }}>
                <span style={{ width: 48, height: 48, borderRadius: 15, background: catSoft(cat.key), display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {React.createElement(item.icon, { size: 21, color })}
                </span>
                <div data-testid="gh-question-text" style={{ fontSize: 18.5, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, lineHeight: 1.3 }}>
                  {item.type === "math" && nums
                    ? item.question.replace("{a}", nums.a).replace("{b}", nums.b)
                    : ghQuestionText(cat.key, item)}
                </div>

                {item.type === "yesno" && (
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={() => ghAnswerYesNo(cat.key, item.key, "yes")}
                      data-testid="gh-answer-yes"
                      className="v2-tap"
                      style={{ flex: 1, padding: "15px 0", borderRadius: T.radiusMd, border: "none", background: color, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: `0 8px 20px ${hexToRgba(color, 0.3)}` }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => ghAnswerYesNo(cat.key, item.key, "no")}
                      data-testid="gh-answer-no"
                      className="v2-tap"
                      style={{ flex: 1, padding: "15px 0", borderRadius: T.radiusMd, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontSize: 14, fontWeight: 800, cursor: "pointer" }}
                    >
                      No
                    </button>
                  </div>
                )}

                {item.type === "math" && (
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={ghMathInput}
                      onChange={(e) => setGhMathInput(e.target.value)}
                      placeholder="Your answer"
                      aria-label="Your answer"
                      data-testid="gh-math-input"
                      style={{
                        width: "100%", padding: "13px 16px", borderRadius: T.radiusMd, border: `1px solid ${T.line}`,
                        background: T.surface, fontSize: 16, fontWeight: 700, color: T.ink, boxSizing: "border-box",
                      }}
                    />
                    <button
                      onClick={() => ghSubmitMath(cat.key, item.key)}
                      data-testid="gh-submit-math"
                      disabled={ghMathInput === ""}
                      className="v2-tap"
                      style={{
                        padding: "15px 0", borderRadius: T.radiusMd, border: "none",
                        background: ghMathInput === "" ? T.surfaceAlt : color,
                        color: ghMathInput === "" ? T.inkFaint : "#fff", fontSize: 14, fontWeight: 800,
                        cursor: ghMathInput === "" ? "default" : "pointer",
                      }}
                    >
                      Submit
                    </button>
                  </>
                )}
              </div>
            );
          })()}

          {/* ---------- Complete: shown once, right after the last check-in ---------- */}
          {ghScreen === "complete" && (
            <div data-testid="gh-complete" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "12px 4px 24px", textAlign: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: T.accent, letterSpacing: 0.4, textTransform: "uppercase" }}>
                All check-ins complete
              </span>

              <GHSegmentedRing size={208} thickness={18} gapDeg={4} segments={ringSegments}>
                <div className="gh-score-reveal" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span data-testid="gh-score-value" style={{ fontSize: 46, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, lineHeight: 1 }}>
                    {ghRawTotal}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: T.inkFaint, marginTop: 3 }}>out of {ghMaxTotal}</span>
                  <span data-testid="gh-tier" style={{ fontSize: 14, fontWeight: 800, color: T.positive, marginTop: 5 }}>
                    {ghTier(ghOverallScore())}
                  </span>
                </div>
              </GHSegmentedRing>

              <p style={{ fontSize: 13, color: T.inkSoft, margin: 0, maxWidth: 280 }}>
                Your GH Score is ready. You can revisit any pillar any time — Self, Community, and Environment refresh daily.
              </p>

              <button
                onClick={() => setGhScreen("categories")}
                data-testid="gh-view-pillars"
                className="v2-tap"
                style={{
                  width: "100%", border: "none", borderRadius: T.radiusMd, padding: "16px 0", cursor: "pointer",
                  background: T.accent, color: "#fff", fontSize: 14, fontWeight: 800,
                  boxShadow: `0 10px 24px ${hexToRgba(T.accent, 0.3)}`,
                }}
              >
                View My Pillars
              </button>
            </div>
          )}
        </div>

        {/* ---------- Colour popover — anchored to the header icon ---------- */}
        <div
          onClick={() => setGhShowColorSheet(false)}
          style={{
            position: "absolute", inset: 0, zIndex: 40, background: "rgba(21,19,42,0.28)",
            opacity: ghShowColorSheet ? 1 : 0, pointerEvents: ghShowColorSheet ? "auto" : "none",
            transition: "opacity 0.25s ease",
          }}
        />
        {ghShowColorSheet && (
          <div
            data-testid="gh-color-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", top: 62, right: 18, width: "min(300px, calc(100% - 36px))", zIndex: 50,
              background: T.surface, borderRadius: T.radiusLg, padding: 16, boxShadow: T.shadowRaised,
              transformOrigin: "top right",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>Colours</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={ghResetColors}
                  data-testid="gh-color-reset"
                  aria-label="Reset colours to default"
                  style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <RefreshCw size={13} color={T.inkFaint} />
                </button>
                <button
                  onClick={() => setGhShowColorSheet(false)}
                  aria-label="Close colours"
                  style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <X size={14} color={T.inkFaint} />
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
              {GH_CATEGORIES.map((cat, i) => {
                const Icon = cat.icon;
                const selected = ghColorPickerCat === cat.key;
                const blob = GH_BLOB_SHAPES[i % GH_BLOB_SHAPES.length];
                return (
                  <button
                    key={cat.key}
                    onClick={() => setGhColorPickerCat(cat.key)}
                    data-testid={`gh-color-tab-${cat.key}`}
                    aria-label={cat.label}
                    aria-pressed={selected}
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
                  >
                    <span
                      style={{
                        width: 38, height: 38, borderRadius: blob.radius, transform: `rotate(${blob.rotate}deg)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: selected ? `2px solid ${catColor(cat.key)}` : "2px solid transparent",
                        background: hexToRgba(catColor(cat.key), selected ? 0.18 : 0.1),
                        transition: "border-color 0.2s ease, background 0.2s ease",
                      }}
                    >
                      <span style={{ display: "flex", transform: `rotate(${-blob.rotate}deg)` }}>
                        <Icon size={16} color={catColor(cat.key)} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <GHColorWheel
                size={180}
                hue={ghWheelHue}
                sat={ghWheelSat}
                onChange={(h, s) => {
                  setGhWheelHue(h);
                  setGhWheelSat(s);
                }}
              />
            </div>

            <button
              onClick={ghSaveColor}
              data-testid="gh-color-save"
              style={{
                width: "100%", border: "none", borderRadius: T.radiusMd, padding: "13px 0", cursor: "pointer",
                background: ghPendingColor, color: "#fff", fontSize: 13.5, fontWeight: 800,
                boxShadow: `0 8px 20px ${hexToRgba(ghPendingColor, 0.32)}`,
              }}
            >
              Save
            </button>
          </div>
        )}

        {toast && (
          <div
            data-testid="gh-toast"
            style={{
              position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
              background: T.ink, color: "#fff", padding: "11px 18px", borderRadius: 999,
              fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", boxShadow: T.shadowFloat, zIndex: 60,
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

export default GHScoreScreen;
