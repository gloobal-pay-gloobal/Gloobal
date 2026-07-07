import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RootApp } from "./app/RootApp";
import { NotificationProvider } from "./app/notifications";
// Registration side effect only — this import's return value is never
// used, it just runs featureManifest.ts's top-level featureRegistry.register()
// calls so every feature listed there is registered before anything reads
// featureRegistry.getEnabled(). An explicit `import "..."` with no binding
// is the standard, intentional way to say "I need this module's side
// effects, not its exports" — not an accidental unused import.
import "./app/featureManifest";

// ---------------------------------------------------------------------------
// Honest status of the Feature Registry / Navigation wiring:
//
// REAL today: featureManifest.ts registers every standalone screen with a
// typed definition and a genuine `() => import(...)` lazy loader.
// RootApp.tsx now consumes those exact registry entries (`featureRegistry
// .get(key).Component`) instead of statically importing DashboardScreen /
// SendMoneyScreen / AddBankScreen / GlobalCoverageScreen / ReceiveScreen —
// each is fetched as its own chunk the first time RootApp's internal
// stage/activeScreen state reaches it, wrapped in a feature-level
// ErrorBoundary + Suspense (ScreenFallback skeleton) at each render site.
//
// STILL NOT real: those lazy components are reached through RootApp's own
// internal stage/activeScreen state, not through <Route> elements/real
// URLs — Routes below only ever matches "*" to <RootApp/>. Send Money,
// Add Bank, etc. aren't deep-linkable (no back-button history entry, no
// shareable URL) yet. Why: they're presentational components that get
// dialCountry/onClose/etc. as props from RootApp's internal state; making
// them real routes needs that state to live somewhere routes can reach
// too (the shared store), which is the next decomposition step — this
// file's code-splitting win is real and independent of that, not blocked
// on it, but the routing/deep-linking gap itself is still open.
// ---------------------------------------------------------------------------
export function App() {
  return (
    <NotificationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<RootApp />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  );
}
