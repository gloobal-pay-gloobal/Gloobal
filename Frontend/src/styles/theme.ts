
// ---------------------------------------------------------------------------
// Version 2 design tokens — the single shared palette/typography/shadow
// system every screen below pulls from. This file's *visuals* were rebuilt
// around these tokens; none of the state, handlers, validation, navigation,
// or data flow anywhere in this file changed as part of that pass.
// ---------------------------------------------------------------------------
export const T = {
  bg: "#F6F5FC",
  surface: "#FFFFFF",
  surfaceAlt: "#F3F1FA",
  surfaceSunk: "#EEEBF9",
  ink: "#15132A",
  inkSoft: "#6B6580",
  inkFaint: "#9C96AF",
  line: "#EAE6F7",
  lineSoft: "rgba(21,19,42,0.06)",
  accent: "#7C3AED",
  accentDeep: "#4C1D95",
  accent2: "#3B6EF5",
  accentSoft: "#F1ECFC",
  gradPrimary: "linear-gradient(135deg,#4338CA 0%,#7C3AED 55%,#C026D3 100%)",
  gradWallet: "linear-gradient(150deg,#1E1B4B 0%,#3E2E8E 42%,#7C3AED 80%,#C026D3 100%)",
  gradButton: "linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)",
  gradButtonDisabled: "linear-gradient(135deg,#D9D3F3,#E6DFF8)",
  positive: "#0FA372",
  positiveSoft: "#E3F8EE",
  negative: "#E23F45",
  negativeSoft: "#FCEAEA",
  radiusXl: 28,
  radiusLg: 22,
  radiusMd: 16,
  radiusSm: 12,
  shadowCard: "0 6px 20px rgba(76,29,149,0.07)",
  shadowRaised: "0 14px 34px rgba(76,29,149,0.16)",
  shadowFloat: "0 20px 48px rgba(30,20,70,0.24)",
  fontDisplay: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  fontBody: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif",
};
