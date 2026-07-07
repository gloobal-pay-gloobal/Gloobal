import { create } from "zustand";
import { TOP_COUNTRIES } from "../data/countries";
import type { RegistrationStage, ActiveScreen, DialCountry } from "../types";

// ---------------------------------------------------------------------------
// Single source of truth for state that used to live as scattered useState
// calls inside the 5,600-line root component. Only the fields genuinely
// shared across multiple screens live here — purely local UI state (a
// dropdown's open/closed flag, a single input's draft value) should stay as
// component-local useState; putting everything in one global store just
// trades one big component for one big store.
//
// NOTE: this store exists but RootApp.tsx does not consume it yet — it
// still manages the same fields via local useState. Wiring RootApp onto
// this store is the next real step (see refactor notes), kept separate so
// this pass stays reviewable as "add types," not "add types AND silently
// change where state lives."
// ---------------------------------------------------------------------------

export type { RegistrationStage, ActiveScreen, DialCountry };

interface AppState {
  stage: RegistrationStage;
  setStage: (s: RegistrationStage) => void;

  activeScreen: ActiveScreen;
  setActiveScreen: (s: ActiveScreen) => void;

  dialCountry: DialCountry;
  setDialCountry: (c: DialCountry) => void;

  phoneNumber: string;
  setPhoneNumber: (v: string) => void;

  secureId: string;
  setSecureId: (v: string) => void;

  referralCode: string;
  setReferralCode: (v: string) => void;

  pin: string;
  setPin: (v: string) => void;

  reset: () => void;
}

const initial = {
  stage: "phone" as RegistrationStage,
  activeScreen: null as ActiveScreen,
  dialCountry: TOP_COUNTRIES[0] as DialCountry,
  phoneNumber: "",
  secureId: "",
  referralCode: "",
  pin: "",
};

export const useAppStore = create<AppState>((set) => ({
  ...initial,
  setStage: (stage) => set({ stage }),
  setActiveScreen: (activeScreen) => set({ activeScreen }),
  setDialCountry: (dialCountry) => set({ dialCountry }),
  setPhoneNumber: (phoneNumber) => set({ phoneNumber }),
  setSecureId: (secureId) => set({ secureId }),
  setReferralCode: (referralCode) => set({ referralCode }),
  setPin: (pin) => set({ pin }),
  // Used on logout — walks every registration/session field back to its
  // starting point in one call instead of six separate setters.
  reset: () => set({ ...initial }),
}));
