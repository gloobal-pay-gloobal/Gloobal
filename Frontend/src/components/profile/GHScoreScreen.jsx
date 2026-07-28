import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  HeartPulse,
  Leaf,
  Lock,
  Trophy,
  Users2,
  Wallet,
} from "lucide-react";
import { ChevronRightIcon } from "../common/Icons";
import { T } from "../../styles/theme";

// ---------------------------------------------------------------------------
// GH Score — the Gloobal Human Score.
//
// A wellness + financial check-in score across four pillars: Self, Community,
// Environment, and Finance. Similar in spirit to a credit score, but broader:
// it reads how someone is doing, not only what they owe.
//
// Two answering rules, set per pillar rather than per item:
//   dailyRotation   — Self / Community / Environment. The question behind an
//                     item changes every day and yesterday's answer does not
//                     carry over, so the check-in is answered fresh each day.
//   locksAfterAnswer — Finance. Answered once, locked permanently: these are
//                     statements of fact about the account holder's money
//                     habits, not a daily mood, so re-answering would only
//                     let the score be gamed.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Which day it is, as a stable integer. Both the daily question rotation and
 * "has this been answered today" read from this one value. */
export function ghDayIndex(now = Date.now()) {
  return Math.floor(now / MS_PER_DAY);
}

export const GH_CATEGORIES = [
  {
    key: "self",
    label: "Self",
    blurb: "Rest, movement, and how you're actually doing",
    Icon: HeartPulse,
    color: "#7C3AED",
    soft: "#F1ECFC",
    dailyRotation: true,
    locksAfterAnswer: false,
    items: [
      {
        key: "self-rest",
        label: "Rest",
        type: "yesno",
        questions: [
          "Did you sleep at least six hours last night?",
          "Did you wake up feeling rested today?",
          "Did you take a real break from screens yesterday?",
        ],
      },
      {
        key: "self-movement",
        label: "Movement",
        type: "yesno",
        questions: [
          "Did you move your body for 20 minutes today?",
          "Did you walk somewhere instead of riding today?",
          "Did you stretch or exercise in the last 24 hours?",
        ],
      },
      {
        key: "self-mind",
        label: "Mind",
        type: "yesno",
        questions: [
          "Did you have a calm moment to yourself today?",
          "Did you feel in control of your day today?",
          "Did you do one thing today just because you enjoy it?",
        ],
      },
    ],
  },
  {
    key: "community",
    label: "Community",
    blurb: "The people around you, and what you give back",
    Icon: Users2,
    color: "#3B6EF5",
    soft: "#E8EFFE",
    dailyRotation: true,
    locksAfterAnswer: false,
    items: [
      {
        key: "community-contact",
        label: "Contact",
        type: "yesno",
        questions: [
          "Did you speak with family or a close friend today?",
          "Did you check in on someone who lives alone this week?",
          "Did you reply to someone who needed you today?",
        ],
      },
      {
        key: "community-help",
        label: "Helping",
        type: "yesno",
        questions: [
          "Did you help someone without being asked today?",
          "Did you share something you had with someone this week?",
          "Did you give your time to someone else today?",
        ],
      },
      {
        key: "community-local",
        label: "Local",
        type: "yesno",
        questions: [
          "Did you buy from a local shop or seller this week?",
          "Did you support a neighbour or local business today?",
          "Did you take part in anything local this week?",
        ],
      },
    ],
  },
  {
    key: "environment",
    label: "Environment",
    blurb: "The footprint of an ordinary day",
    Icon: Leaf,
    color: "#0FA372",
    soft: "#E3F8EE",
    dailyRotation: true,
    locksAfterAnswer: false,
    items: [
      {
        key: "environment-travel",
        label: "Travel",
        type: "yesno",
        questions: [
          "Did you walk, cycle, or take public transport today?",
          "Did you share a ride instead of travelling alone today?",
          "Did you avoid an unnecessary trip today?",
        ],
      },
      {
        key: "environment-waste",
        label: "Waste",
        type: "yesno",
        questions: [
          "Did you avoid single-use plastic today?",
          "Did you separate your waste for recycling today?",
          "Did you finish your food without throwing any away today?",
        ],
      },
      {
        key: "environment-energy",
        label: "Energy",
        type: "yesno",
        questions: [
          "Did you switch off what you weren't using today?",
          "Did you keep your water use down today?",
          "Did you keep heating or cooling to what you actually needed today?",
        ],
      },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    blurb: "Answered once — these stay on your record",
    Icon: Wallet,
    color: "#C026D3",
    soft: "#FBEBFE",
    dailyRotation: false,
    locksAfterAnswer: true,
    items: [
      {
        key: "finance-budget",
        label: "Budget check",
        type: "math",
        prompt: "You spend {a} on bills and {b} on food this month. What's the total?",
        op: "add",
      },
      {
        key: "finance-saving",
        label: "Saving check",
        type: "math",
        prompt: "You earn {a} and spend {b}. How much is left to save?",
        op: "sub",
      },
      {
        key: "finance-repay",
        label: "Repayment check",
        type: "math",
        prompt: "You owe {a} and repay it over {b} months. What's each month's payment?",
        op: "div",
      },
    ],
  },
];

export const GH_ALL_ITEMS = GH_CATEGORIES.flatMap((c) => c.items.map((i) => ({ ...i, categoryKey: c.key })));

/** Total number of check-ins across all four pillars. */
export const ghTotalQuestions = GH_ALL_ITEMS.length;

// A small deterministic hash, so the same item on the same day always draws
// the same question and the same numbers — refreshing the page can never
// reroll a check-in into an easier one.
function ghHash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** The numbers behind one Finance math check-in, plus its correct answer.
 * Finance never rotates, so these are keyed on the item alone. */
export function ghMathNumsFor(item) {
  const seed = ghHash(item.key);
  if (item.op === "sub") {
    const b = 200 + (seed % 300);
    const a = b + 150 + (seed % 250);
    return { a, b, answer: a - b };
  }
  if (item.op === "div") {
    const b = 2 + (seed % 5); // 2–6 months
    const perMonth = 100 + (seed % 400);
    return { a: perMonth * b, b, answer: perMonth };
  }
  const a = 100 + (seed % 900);
  const b = 100 + ((seed >> 3) % 900);
  return { a, b, answer: a + b };
}

/** The question text shown for one item right now. Rotating pillars pick by
 * day; Finance renders its fixed prompt with today's numbers filled in. */
export function ghQuestionText(category, item, day = ghDayIndex()) {
  if (item.type === "math") {
    const { a, b } = ghMathNumsFor(item);
    return item.prompt.replace("{a}", String(a)).replace("{b}", String(b));
  }
  const list = item.questions || [];
  if (list.length === 0) return item.label;
  const offset = category.dailyRotation ? (day + ghHash(item.key)) % list.length : 0;
  return list[offset];
}

/** Is this item's stored answer still the live one? A locked (Finance) answer
 * always counts; a rotating one only counts on the day it was given. */
export function ghIsAnswered(category, answer, day = ghDayIndex()) {
  if (!answer) return false;
  if (category.locksAfterAnswer) return true;
  return answer.day === day;
}

/** Does this answer count as a point toward the score? */
function ghIsPositive(answer) {
  if (!answer) return false;
  if (answer.type === "math") return Boolean(answer.correct);
  return answer.value === "yes";
}

/** 0–100 for one pillar: how many of its check-ins came back positive. */
export function ghCategoryScore(category, answers, day = ghDayIndex()) {
  if (!category.items.length) return 0;
  const points = category.items.reduce(
    (sum, item) => sum + (ghIsAnswered(category, answers[item.key], day) && ghIsPositive(answers[item.key]) ? 1 : 0),
    0
  );
  return Math.round((points / category.items.length) * 100);
}

/** The headline GH Score — the flat average of the four pillar scores. */
export function ghOverallScore(answers, day = ghDayIndex()) {
  const total = GH_CATEGORIES.reduce((sum, c) => sum + ghCategoryScore(c, answers, day), 0);
  return Math.round(total / GH_CATEGORIES.length);
}

/** How many check-ins are answered right now, across all four pillars. */
export function ghTotalAnswered(answers, day = ghDayIndex()) {
  return GH_CATEGORIES.reduce(
    (sum, c) => sum + c.items.filter((item) => ghIsAnswered(c, answers[item.key], day)).length,
    0
  );
}

/** The Generate button only lights up once every pillar is complete. */
export function ghCanGenerate(answers, day = ghDayIndex()) {
  return ghTotalAnswered(answers, day) === ghTotalQuestions;
}

export function ghTier(score) {
  if (score >= 80) return { label: "Excellent", color: "#0FA372" };
  if (score >= 60) return { label: "Good", color: "#3B6EF5" };
  if (score >= 40) return { label: "Fair", color: "#D97706" };
  return { label: "Building", color: T.inkSoft };
}

const ghStorageKey = (symbolId) => `gloobal.ghAnswers.${symbolId || "guest"}`;

// --- Radial gauge -----------------------------------------------------------
// A dependency-free SVG dial: a faint full track, a coloured arc for the
// score, and the number itself in the middle.
export function GHRadialGauge({ score = 0, size = 168, stroke = 14, color = T.accent, label = "GH Score" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(score) || 0)) / 100;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${score} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.line} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * pct).toFixed(2)} ${c.toFixed(2)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <span style={{ fontSize: size * 0.26, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, lineHeight: 1 }}>
          {Math.round(score)}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: T.inkFaint }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// --- Screen -----------------------------------------------------------------
export function GHScoreScreen({ symbolId, onClose }) {
  // "categories" | "items" | "question" | "result"
  const [ghScreen, setGhScreen] = useState("categories");
  const [ghCategory, setGhCategory] = useState(null);
  const [ghItem, setGhItem] = useState(null);
  const [ghAnswers, setGhAnswers] = useState({});
  const [ghMathInput, setGhMathInput] = useState("");
  const [ghMathFeedback, setGhMathFeedback] = useState(null);
  const [day] = useState(() => ghDayIndex());

  // Answers survive a refresh — they are the whole point of a daily check-in,
  // and a page reload is not a reason to make somebody answer twice.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ghStorageKey(symbolId));
      if (raw) setGhAnswers(JSON.parse(raw) || {});
    } catch {
      // corrupt or unavailable storage — start clean rather than crash
    }
  }, [symbolId]);

  const persist = useCallback(
    (next) => {
      setGhAnswers(next);
      try {
        window.localStorage.setItem(ghStorageKey(symbolId), JSON.stringify(next));
      } catch {
        // private mode / quota — the in-memory answers still work this session
      }
    },
    [symbolId]
  );

  const overall = useMemo(() => ghOverallScore(ghAnswers, day), [ghAnswers, day]);
  const answered = useMemo(() => ghTotalAnswered(ghAnswers, day), [ghAnswers, day]);
  const canGenerate = answered === ghTotalQuestions;
  const tier = ghTier(overall);

  const ghOpenCategory = (category) => {
    setGhCategory(category);
    setGhScreen("items");
  };

  const ghOpenQuestion = (item) => {
    // A locked Finance item is not a question any more, it's a record.
    if (ghCategory?.locksAfterAnswer && ghAnswers[item.key]) return;
    setGhItem(item);
    setGhMathInput("");
    setGhMathFeedback(null);
    setGhScreen("question");
  };

  const ghAnswerYesNo = (value) => {
    if (!ghItem) return;
    persist({
      ...ghAnswers,
      [ghItem.key]: { type: "yesno", value, day, at: new Date().toISOString() },
    });
    setGhScreen("items");
  };

  const ghSubmitMath = () => {
    if (!ghItem) return;
    const { answer } = ghMathNumsFor(ghItem);
    const given = Number(String(ghMathInput).trim());
    if (!Number.isFinite(given) || ghMathInput === "") {
      setGhMathFeedback("Enter a number to continue.");
      return;
    }
    const correct = given === answer;
    persist({
      ...ghAnswers,
      [ghItem.key]: { type: "math", value: given, correct, day, at: new Date().toISOString() },
    });
    setGhScreen("items");
  };

  const backFromQuestion = () => {
    setGhItem(null);
    setGhScreen("items");
  };

  const header = (title, onBack) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}>
      <button
        onClick={onBack}
        aria-label="Back"
        className="v2-tap"
        style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <ArrowLeft size={18} color={T.ink} />
      </button>
      <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>{title}</span>
    </div>
  );

  const shell = (title, onBack, children) => (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: T.fontBody }}>
      {header(title, onBack)}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 18px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </div>
    </div>
  );

  // --- 1. Categories overview ---------------------------------------------
  if (ghScreen === "categories") {
    return shell("GH Score", onClose, (
      <>
        <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "20px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <GHRadialGauge score={overall} color={tier.color} />
          <div style={{ fontSize: 13, fontWeight: 800, color: tier.color }}>{tier.label}</div>
          <div data-testid="gh-progress" style={{ fontSize: 12, color: T.inkFaint, fontWeight: 600 }}>
            {answered} of {ghTotalQuestions} check-ins answered
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {GH_CATEGORIES.map((category) => {
            const done = category.items.filter((item) => ghIsAnswered(category, ghAnswers[item.key], day)).length;
            const CatIcon = category.Icon;
            return (
              <button
                key={category.key}
                onClick={() => ghOpenCategory(category)}
                data-testid={`gh-category-${category.key}`}
                className="v2-row"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 16px", border: "none", borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: category.soft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CatIcon size={19} color={category.color} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: T.ink }}>{category.label}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>{category.blurb}</span>
                </span>
                <span
                  data-testid={`gh-progress-${category.key}`}
                  style={{ fontSize: 11.5, fontWeight: 800, color: done === category.items.length ? T.positive : T.inkFaint, flexShrink: 0, marginRight: 6 }}
                >
                  {done}/{category.items.length}
                </span>
                <ChevronRightIcon />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          data-testid="gh-generate"
          disabled={!canGenerate}
          onClick={() => setGhScreen("result")}
          className="v2-tap"
          style={{
            border: "none",
            borderRadius: T.radiusMd,
            padding: "15px 0",
            fontSize: 14,
            fontWeight: 800,
            color: canGenerate ? "#fff" : T.inkFaint,
            background: canGenerate ? T.gradButton : T.line,
            boxShadow: canGenerate ? "0 8px 20px rgba(124,58,237,0.32)" : "none",
            cursor: canGenerate ? "pointer" : "not-allowed",
          }}
        >
          {canGenerate ? "Generate Score" : `Generate Score · ${answered}/${ghTotalQuestions}`}
        </button>

        <p style={{ margin: "0 2px", fontSize: 11.5, color: T.inkFaint, lineHeight: 1.5 }}>
          Self, Community, and Environment check-ins refresh with a new question every day. Finance
          check-ins are answered once and stay on your record.
        </p>
      </>
    ));
  }

  // --- 2. Items inside one pillar -----------------------------------------
  if (ghScreen === "items" && ghCategory) {
    const CatIcon = ghCategory.Icon;
    const catScore = ghCategoryScore(ghCategory, ghAnswers, day);
    return shell(ghCategory.label, () => setGhScreen("categories"), (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 14, borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "16px 18px" }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: ghCategory.soft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CatIcon size={21} color={ghCategory.color} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.inkSoft }}>{ghCategory.label} score</span>
            <span style={{ display: "block", fontSize: 24, fontWeight: 800, color: ghCategory.color, fontFamily: T.fontDisplay }}>{catScore}</span>
          </span>
        </div>

        <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
          {ghCategory.items.map((item, i) => {
            const answer = ghAnswers[item.key];
            const isAnswered = ghIsAnswered(ghCategory, answer, day);
            const locked = Boolean(ghCategory.locksAfterAnswer && answer);
            return (
              <button
                key={item.key}
                onClick={() => ghOpenQuestion(item)}
                disabled={locked}
                data-testid={`gh-item-${item.key}`}
                aria-label={locked ? `${item.label} — locked` : item.label}
                className="v2-row"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "15px 16px",
                  border: "none",
                  borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
                  background: "none",
                  cursor: locked ? "default" : "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink }}>{item.label}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: T.inkFaint, marginTop: 2, lineHeight: 1.4 }}>
                    {ghQuestionText(ghCategory, item, day)}
                  </span>
                </span>
                {isAnswered && (
                  <span data-testid={`gh-answered-${item.key}`} style={{ display: "flex", flexShrink: 0 }}>
                    <Check size={16} color={T.positive} />
                  </span>
                )}
                {locked ? (
                  <span data-testid={`gh-lock-${item.key}`} style={{ display: "flex", flexShrink: 0 }} aria-hidden="true">
                    <Lock size={16} color={T.inkFaint} />
                  </span>
                ) : (
                  <ChevronRightIcon />
                )}
              </button>
            );
          })}
        </div>

        <p style={{ margin: "0 2px", fontSize: 11.5, color: T.inkFaint, lineHeight: 1.5 }}>
          {ghCategory.locksAfterAnswer
            ? "Answered once. Once you answer, this check-in locks permanently."
            : "A new question every day. You can answer again tomorrow."}
        </p>
      </>
    ));
  }

  // --- 3. One question ------------------------------------------------------
  if (ghScreen === "question" && ghCategory && ghItem) {
    const question = ghQuestionText(ghCategory, ghItem, day);
    const isMath = ghItem.type === "math";
    return shell(ghItem.label, backFromQuestion, (
      <>
        <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "22px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: ghCategory.color }}>
            {ghCategory.label}
          </div>
          <div data-testid="gh-question-text" style={{ fontSize: 18, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, marginTop: 10, lineHeight: 1.35 }}>
            {question}
          </div>
        </div>

        {isMath ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={ghMathInput}
              onChange={(e) => {
                setGhMathInput(e.target.value.replace(/[^0-9.]/g, ""));
                setGhMathFeedback(null);
              }}
              inputMode="decimal"
              aria-label="Your answer"
              placeholder="Your answer"
              style={{
                border: `1px solid ${T.line}`,
                borderRadius: T.radiusMd,
                background: T.surface,
                padding: "14px 16px",
                fontSize: 18,
                fontWeight: 800,
                color: T.ink,
                fontFamily: "inherit",
                outline: "none",
                boxShadow: T.shadowCard,
              }}
            />
            {ghMathFeedback && (
              <div style={{ fontSize: 12, fontWeight: 700, color: T.negative }}>{ghMathFeedback}</div>
            )}
            <button
              onClick={ghSubmitMath}
              data-testid="gh-submit-math"
              className="v2-tap"
              style={{ border: "none", borderRadius: T.radiusMd, padding: "15px 0", color: "#fff", fontSize: 14, fontWeight: 800, background: T.gradButton, boxShadow: "0 8px 20px rgba(124,58,237,0.32)", cursor: "pointer" }}
            >
              Submit
            </button>
            <p style={{ margin: "0 2px", fontSize: 11.5, color: T.inkFaint, lineHeight: 1.5 }}>
              Finance check-ins lock once submitted — this answer stays on your record.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => ghAnswerYesNo("yes")}
              data-testid="gh-answer-yes"
              className="v2-tap"
              style={{ flex: 1, border: "none", borderRadius: T.radiusLg, padding: "22px 0", color: "#fff", fontSize: 15, fontWeight: 800, background: T.gradButton, boxShadow: "0 8px 20px rgba(124,58,237,0.32)", cursor: "pointer" }}
            >
              Yes
            </button>
            <button
              onClick={() => ghAnswerYesNo("no")}
              data-testid="gh-answer-no"
              className="v2-tap"
              style={{ flex: 1, border: `1px solid ${T.line}`, borderRadius: T.radiusLg, padding: "22px 0", color: T.inkSoft, fontSize: 15, fontWeight: 800, background: T.surface, boxShadow: T.shadowCard, cursor: "pointer" }}
            >
              No
            </button>
          </div>
        )}
      </>
    ));
  }

  // --- 4. Overall result ----------------------------------------------------
  return shell("Your GH Score", () => setGhScreen("categories"), (
    <>
      <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, padding: "24px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <GHRadialGauge score={overall} size={196} stroke={16} color={tier.color} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Trophy size={16} color={tier.color} />
          <span data-testid="gh-tier" style={{ fontSize: 15, fontWeight: 800, color: tier.color }}>{tier.label}</span>
        </div>
        <div style={{ fontSize: 12, color: T.inkFaint, fontWeight: 600, textAlign: "center", lineHeight: 1.5 }}>
          Across Self, Community, Environment, and Finance.
        </div>
      </div>

      <div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden" }}>
        {GH_CATEGORIES.map((category, i) => {
          const score = ghCategoryScore(category, ghAnswers, day);
          const CatIcon = category.Icon;
          return (
            <div
              key={category.key}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i === 0 ? "none" : `1px solid ${T.line}` }}
            >
              <span style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, background: category.soft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CatIcon size={17} color={category.color} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink }}>{category.label}</span>
                <span style={{ display: "block", height: 6, borderRadius: 999, background: T.surfaceAlt, marginTop: 6, overflow: "hidden" }}>
                  <span style={{ display: "block", width: `${score}%`, height: "100%", borderRadius: 999, background: category.color }} />
                </span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: category.color, flexShrink: 0 }}>{score}</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setGhScreen("categories")}
        className="v2-tap"
        style={{ border: `1px solid ${T.line}`, borderRadius: T.radiusMd, background: T.surface, padding: "13px 0", fontSize: 13, fontWeight: 800, color: T.accent, cursor: "pointer" }}
      >
        Back to check-ins
      </button>
    </>
  ));
}
