import React, { useState } from "react";
import type { Bank } from "../../types";

interface BankAvatarProps {
  bank: Bank;
  size?: number;
}

export function BankAvatar({ bank, size = 48 }: BankAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (!bank.logo || failed) {
    return (
      <div
        className="rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold"
        style={{ width: size, height: size, background: bank.color, fontSize: size * 0.26 }}
      >
        {bank.initials}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-slate-100"
      style={{ width: size, height: size }}
    >
      <img
        src={bank.logo}
        alt={bank.name}
        onError={() => setFailed(true)}
        className="w-full h-full object-contain p-2"
      />
    </div>
  );
}
