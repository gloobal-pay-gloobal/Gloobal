import React from "react";
import { BankAvatar } from "./BankAvatar";
import { Check, ChevronRight } from "lucide-react";
import type { Bank } from "../../types";

interface BankRowProps {
  bank: Bank;
  index: number;
  accent?: boolean;
  isLinked: boolean;
  onSelect: (bank: Bank) => void;
}

// Defined at module scope (not inside AddBankScreen) so its component
// identity stays stable across re-renders — e.g. every keystroke while
// searching. Nesting a component definition inside another component's
// body makes React treat it as a brand-new component type on every
// render, forcing every row to unmount/remount and replay its entrance
// animation, which is what caused rows to "blink" while typing.
export function BankRow({ bank, index, accent, isLinked, onSelect }: BankRowProps) {
  return (
    <button
      onClick={() => !isLinked && onSelect(bank)}
      className={`ab-bank-row relative w-full flex items-center gap-4 px-4 py-4 rounded-3xl border text-left transition-all ${
        isLinked
          ? "border-green-200 bg-green-50/50"
          : accent
          ? "border-violet-100 bg-gradient-to-r from-blue-50/70 to-violet-50/70 shadow-sm hover:shadow-md active:scale-[0.99]"
          : "border-slate-100 bg-white shadow-sm hover:shadow-md active:scale-[0.99]"
      }`}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <BankAvatar bank={bank} size={54} />
      <span className="flex-1 min-w-0 text-slate-800 text-[15.5px] font-semibold truncate">
        {bank.name}
      </span>
      {isLinked ? (
        <span className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
          <Check size={14} className="text-white" strokeWidth={3} />
        </span>
      ) : (
        <ChevronRight size={20} className="text-slate-300 flex-shrink-0" />
      )}
    </button>
  );
}
