import {
  Zap,
  Smartphone,
  Home,
} from "lucide-react";
import { AddBankIcon, ReceiveIcon, ScannerIcon, SendIcon } from "../components/common/Icons";

export const DASHBOARD_ACTIONS = [
  { key: "send", label: "Send", Icon: SendIcon },
  { key: "bank", label: "Add Bank", Icon: AddBankIcon },
  { key: "scan", label: "Scanner", Icon: ScannerIcon },
  { key: "receive", label: "Receive", Icon: ReceiveIcon },
];
// Everyday bill payments — a quiet secondary row under the main actions,
// not another grid, so the dashboard doesn't get busier than it needs to.
export const BILL_ACTIONS = [
  { key: "recharge", label: "Recharge", Icon: Smartphone },
  { key: "electricity", label: "Electricity", Icon: Zap },
  { key: "rent", label: "Rent", Icon: Home },
];

// ---------------------------------------------------------------------------
// Ambient dashboard motion: floating financial symbols, drifting dots, and
// slow-turning geometric outlines. Everything here is decorative (aria-hidden,
// pointer-events: none) and driven entirely by CSS keyframes + custom
// properties rather than a JS animation loop, so it stays GPU-composited
// (transform/opacity only) and cheap on battery. Randomized per-particle
// parameters are generated once via useMemo on mount, never per frame.
// ---------------------------------------------------------------------------
export const PROFILE_ROWS = ["Security", "Notifications", "Help & Support"];
// A pool of illustrative referred members — bigger than the 5 shown at
// once, so "My Referral Network" can be filled with a different random
// set of 5 people (name, country, status, today's + all-time earnings)
// each time the screen loads, without a real referrals backend.
export const REFERRAL_NAME_POOL = [
  { name: "Amara K.", flag: "🇳🇬" },
  { name: "Diego R.", flag: "🇲🇽" },
  { name: "Priya S.", flag: "🇮🇳" },
  { name: "Tom W.", flag: "🇬🇧" },
  { name: "Lina F.", flag: "🇩🇪" },
  { name: "Kenji T.", flag: "🇯🇵" },
  { name: "Fatima Z.", flag: "🇪🇬" },
  { name: "Carlos M.", flag: "🇨🇴" },
  { name: "Sofia B.", flag: "🇧🇷" },
  { name: "Aiden P.", flag: "🇵🇭" },
  { name: "Noah S.", flag: "🇿🇦" },
  { name: "Mei L.", flag: "🇸🇬" },
];
// Picks 5 distinct people from the pool and gives each a random status and
// earnings — mostly active with an occasional pending invite, today's
// earnings a modest slice of a larger all-time total.
export function generateReferralNetwork() {
  const shuffled = [...REFERRAL_NAME_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5).map((person) => {
    const isActive = Math.random() > 0.15;
    const earnedToday = isActive ? Math.round((Math.random() * 4 + 0.3) * 100) / 100 : 0;
    const earned = isActive ? Math.round((earnedToday + Math.random() * 30) * 100) / 100 : 0;
    return { ...person, status: isActive ? "Active" : "Pending", earned, earnedToday };
  });
}
