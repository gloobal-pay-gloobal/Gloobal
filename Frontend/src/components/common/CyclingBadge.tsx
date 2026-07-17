import React, { useEffect, useState } from "react";

interface CyclingBadgeProps {
  words: string[];
  intervalMs?: number;
}

// Cycles through a fixed list of words inside a corner badge (e.g. the
// Secure ID / Log In stage labels), each swap popping in via the shared
// `badgePop` keyframe (see global.css). Purely decorative — memoized since
// it's rendered inside RootApp's registration flow, which itself re-renders
// on every particle-animation tick via FloatingFlagBackground.
function CyclingBadgeBase({ words, intervalMs = 2600 }: CyclingBadgeProps) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs);
    return () => clearInterval(id);
  }, [words, intervalMs]);
  return (
    <span key={index} style={{ display: "inline-block", animation: "badgePop 0.35s ease" }}>
      {words[index]}
    </span>
  );
}

export const CyclingBadge = React.memo(CyclingBadgeBase);
