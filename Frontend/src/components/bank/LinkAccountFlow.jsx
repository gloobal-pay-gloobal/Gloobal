import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  ArrowLeft,
  Smartphone,
  RotateCw,
} from "lucide-react";
import { BankAvatar } from "./BankAvatar";

export const OTP_LENGTH = 6;
export const DEMO_CODE = "246813";
export function OtpBoxes({ value, onChange, autoFocus }) {
  const refs = React.useRef([]);

  const setDigit = (i, val) => {
    const digits = value.split("");
    digits[i] = val;
    const joined = digits.join("").slice(0, OTP_LENGTH);
    onChange(joined);
    if (val && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
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
          ref={(el) => (refs.current[i] = el)}
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
export function LinkAccountFlow({ bank, onClose, onLinked }) {
  const [step, setStep] = useState("confirm"); // confirm -> sent -> verifying -> success -> error
  const [otp, setOtp] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [attemptError, setAttemptError] = useState(false);

  const phone = bank.phone || "+1 •••• •• 00";

  React.useEffect(() => {
    if (step !== "sent") return;
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, seconds]);

  const sendCode = () => {
    setStep("sent");
    setSeconds(30);
    setOtp("");
  };

  const resend = () => {
    setSeconds(30);
    setOtp("");
    setAttemptError(false);
  };

  React.useEffect(() => {
    if (otp.length === OTP_LENGTH && step === "sent") {
      setStep("verifying");
      setTimeout(() => {
        if (otp === DEMO_CODE) {
          setStep("success");
        } else {
          setAttemptError(true);
          setStep("sent");
          setOtp("");
        }
      }, 1100);
    }
  }, [otp, step]);

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col">
      <div className="flex items-center px-4 pt-3 pb-2">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-700" />
        </button>
      </div>

      {step === "confirm" && (
        <div className="flex-1 px-6 pt-6 flex flex-col items-center">
          <BankAvatar bank={bank} size={72} />
          <h2 className="text-[20px] font-bold text-slate-900 mt-4 text-center leading-snug">
            {bank.name}
          </h2>

          <div className="w-full flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-4 mt-6">
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
              <Smartphone size={18} className="text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] text-slate-400 font-medium">Linked mobile number</p>
              <p className="text-[15px] font-bold text-slate-900 truncate">{phone}</p>
            </div>
            <Check size={16} className="text-green-500 flex-shrink-0" />
          </div>

          <div className="flex-1" />

          <button
            onClick={sendCode}
            className="w-full rounded-2xl py-4 text-[16px] font-semibold mb-8 bg-violet-600 text-white active:bg-violet-700 transition-colors"
          >
            Send code
          </button>
        </div>
      )}

      {(step === "sent" || step === "verifying") && (
        <div className="flex-1 px-6 pt-4 flex flex-col">
          <h2 className="text-[22px] font-bold text-slate-900 leading-snug">Enter verification code</h2>
          <p className="text-slate-500 text-[14px] mt-1 mb-7">
            We sent a 6-digit code to <span className="font-semibold text-slate-700">{phone}</span>
          </p>

          <OtpBoxes value={otp} onChange={(v) => { setOtp(v); setAttemptError(false); }} autoFocus />

          {attemptError && (
            <p className="text-center text-red-500 text-[13px] font-medium mt-3">Incorrect code. Try again.</p>
          )}

          {step === "verifying" && (
            <div className="flex items-center justify-center gap-2 mt-5 text-slate-500 text-[13.5px]">
              <RotateCw size={14} className="animate-spin" />
              Verifying…
            </div>
          )}

          <div className="flex-1" />

          <div className="text-center mb-8">
            {seconds > 0 ? (
              <p className="text-slate-400 text-[13.5px]">Resend code in 0:{String(seconds).padStart(2, "0")}</p>
            ) : (
              <button onClick={resend} className="text-violet-600 text-[14px] font-semibold">
                Resend code
              </button>
            )}
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="v2-success-pop w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
            <Check size={30} className="text-green-600" strokeWidth={3} />
          </div>
          <h2 className="text-[20px] font-bold text-slate-900 mb-1.5">Account linked</h2>
          <p className="text-slate-500 text-[14px] mb-8 leading-snug">
            {bank.name} is now connected to your Gloobal ID.
          </p>
          <button
            onClick={() => onLinked(bank)}
            className="w-full bg-violet-600 text-white rounded-2xl py-4 text-[16px] font-semibold active:bg-violet-700 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
