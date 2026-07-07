import React from "react";
import { FlagEmoji } from "../icons/MiscIcons";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

type FlagChipSize = "lg" | "md" | "sm";

// Pixel sizes for each flag-chip size, matched 1:1 to the previous CSS
// (.flag-chip.lg/.md/.sm) so nothing visually shifts.
export const FLAG_CHIP_PX: Record<FlagChipSize, [number, number]> = { lg: [52, 40], md: [30, 23], sm: [24, 18] };

interface FlagProps {
  emoji: string;
  size?: FlagChipSize;
  badge?: "send" | "receive";
}

export function Flag({ emoji, size = "md", badge }: FlagProps) {
  const [w, h] = FLAG_CHIP_PX[size];
  return (
    <span className="flag-chip-wrap">
      <span className={`flag-chip ${size}`}>
        <FlagEmoji flag={emoji} width={w} height={h} radius={0} />
      </span>
      {badge && (
        <span className={`flag-badge ${badge}`}>
          {badge === "send" ? <ArrowUpRight size={11} strokeWidth={2.75} /> : <ArrowDownLeft size={11} strokeWidth={2.75} />}
        </span>
      )}
    </span>
  );
}
