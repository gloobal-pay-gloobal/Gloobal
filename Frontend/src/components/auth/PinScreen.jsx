import React from "react";
import { PhoneDialPad } from "../common/DialPads";
import { T } from "../../styles/theme";
import { PinScreenHeader, PinChipCard } from "./PinScreenShell";

// The dedicated, full-screen PIN step: shown after the Referral step,
// overlaying the whole stage the same way the country picker does. Gives
// the person a dial pad to type their PIN rather than a keyboard.
export function PinScreen({ value, length, onChange, onSubmit, onBack, revealed, onToggleReveal }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: T.fontBody,
      }}
    >
      <PinScreenHeader onBack={onBack} title="Set your PIN" />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 24,
          padding: "40px 24px 40px",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <PinChipCard length={length} value={value} revealed={revealed} onToggleReveal={onToggleReveal} />
        <PhoneDialPad value={value} onChange={onChange} minLength={length} maxLength={length} onSubmit={onSubmit} />
      </div>
    </div>
  );
}
