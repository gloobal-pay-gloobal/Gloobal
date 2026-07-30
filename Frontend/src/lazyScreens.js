import { lazy } from "react";

// Named exports need a small adapter since React.lazy expects a module
// with a default export.
export const DashboardScreen = lazy(() =>
  import("./components/dashboard/DashboardScreen").then((m) => ({ default: m.DashboardScreen }))
);
export const SendMoneyScreen = lazy(() =>
  import("./components/sendMoney/SendMoneyScreen").then((m) => ({ default: m.SendMoneyScreen }))
);
export const PaymentReceiptScreen = lazy(() =>
  import("./components/sendMoney/PaymentReceiptScreen").then((m) => ({ default: m.PaymentReceiptScreen }))
);
export const AddBankScreen = lazy(() =>
  import("./components/bank/AddBankScreen").then((m) => ({ default: m.AddBankScreen }))
);
export const GloobalCoverageScreen = lazy(() =>
  import("./components/coverage/GloobalCoverageScreen").then((m) => ({ default: m.GloobalCoverageScreen }))
);
