// ---------------------------------------------------------------------------
// The one file that knows every feature module exists. App.tsx/Navigation
// imports *this* file (for its registration side-effects) and then builds
// routes purely from `featureRegistry.getEnabled()` — it never imports
// DashboardScreen, SendMoneyScreen, etc. directly. Add a feature by adding
// an entry here; Navigation picks it up automatically.
//
// "Registration" and "Identity" (Secure ID / PIN / login) aren't listed
// here: they're not standalone routed screens today — they're stages
// inside RootApp's own flip-card sequence. Registering them as top-level
// routed features is a real follow-up (part of the RootApp decomposition
// work), not something to fake here just to fill out the list.
// ---------------------------------------------------------------------------

import { featureRegistry } from "./featureRegistry";

featureRegistry.register({
  key: "dashboard",
  label: "Dashboard",
  path: "/dashboard",
  load: () => import("../screens/dashboard/DashboardScreen").then((m) => ({ default: m.DashboardScreen })),
});

featureRegistry.register({
  key: "banking",
  label: "Banking",
  path: "/banking",
  load: () => import("../screens/bank/AddBankScreen").then((m) => ({ default: m.AddBankScreen })),
});

featureRegistry.register({
  key: "send",
  label: "Send",
  path: "/send",
  load: () => import("../screens/send/SendMoneyScreen").then((m) => ({ default: m.SendMoneyScreen })),
});

featureRegistry.register({
  key: "receive",
  label: "Receive",
  path: "/receive",
  load: () => import("../screens/receive/ReceiveScreen").then((m) => ({ default: m.ReceiveScreen })),
});

featureRegistry.register({
  key: "coverage",
  label: "Global Coverage",
  path: "/coverage",
  load: () => import("../screens/coverage/GlobalCoverageScreen").then((m) => ({ default: m.GlobalCoverageScreen })),
});

// Declared but not built yet — `enabled: false` keeps it out of any
// navigation/menu built from getEnabled(), without needing an if/else
// somewhere else in the app to hide it. Flip to true the day it ships.
featureRegistry.register({
  key: "settings",
  label: "Settings",
  path: "/settings",
  load: () => import("../screens/dashboard/DashboardScreen").then((m) => ({ default: m.DashboardScreen })), // placeholder target
  enabled: false,
});
