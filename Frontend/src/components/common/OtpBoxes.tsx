import React, { useRef } from "react";

export const OTP_LENGTH = 6;
export const DEMO_CODE = "246813";

interface OtpBoxesProps {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}

export function OtpBoxes({ value, onChange, autoFocus }: OtpBoxesProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const setDigit = (i: number, val: string) => {
    const digits = value.split("");
    digits[i] = val;
    const joined = digits.join("").slice(0, OTP_LENGTH);
    onChange(joined);
    if (val && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (text) {
      e.preventDefault();
      onChange(text.padEnd(value.length, ""));
    }
  };

  return (
    <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          autoFocus={autoFocus && i === 0}
          value={value[i] || ""}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={(e) => handleKeyDown(i, e)}
          inputMode="numeric"
          maxLength={1}
          className="w-11 h-13 aspect-square rounded-2xl bg-slate-100 text-center text-[20px] font-bold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500/40 focus:bg-white"
        />
      ))}
    </div>
  );
}
