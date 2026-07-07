// ---------------------------------------------------------------------------
// Referral link sharing. Important distinction worth being explicit about:
// a plain PWA (this app) is just a web page — sharing it always means
// sharing a URL. It can NEVER turn into a .apk on its own; that only
// happens if the app is separately wrapped for the Play Store via a tool
// like Bubblewrap/PWABuilder (Trusted Web Activity), which is a distinct,
// optional packaging step this project doesn't do. If an .apk showed up
// when sharing, that's almost certainly a third-party "PWA to APK"
// converter/testing tool in the loop, not something this codebase produces.
// What we control, and what's built here: a real, plain https:// link
// carrying the referral code as a query param, shared via the Web Share
// API (native iOS/Android share sheet) with a clipboard-copy fallback for
// desktop browsers that don't support it.
// ---------------------------------------------------------------------------

import { commandBus } from "./commandBus";

export const REFERRAL_QUERY_PARAM = "ref";

/** Builds a real, shareable https:// URL carrying this person's referral
 * code — nothing more than a plain query param on the app's own origin. */
export function buildReferralLink(referralCode: string): string {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set(REFERRAL_QUERY_PARAM, referralCode);
  return url.toString();
}

/** Reads a referral code from the current URL, if the app was opened via
 * someone else's shared link — call once on startup. */
export function readReferralCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(REFERRAL_QUERY_PARAM);
}

/** Shares the link through the native share sheet (Web Share API) where
 * available; otherwise copies it to the clipboard and shows a toast via
 * the Notification System (through the Command Bus, so this plain
 * function doesn't need to import/know about the notification UI at all). */
export async function shareReferralLink(referralCode: string): Promise<void> {
  const url = buildReferralLink(referralCode);
  const shareData: ShareData = {
    title: "Join me on Global ID",
    text: "Use my referral link to get started on Global ID:",
    url,
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      // AbortError just means the person closed the native share sheet —
      // not a real failure, so it shouldn't fall through to the clipboard
      // fallback or show an error toast.
      if (err instanceof Error && err.name === "AbortError") return;
      // Any other failure (permissions, unsupported data on this platform)
      // falls through to the clipboard fallback below.
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    commandBus.dispatch("notification/show", { message: "Referral link copied", tone: "success" });
  } catch {
    commandBus.dispatch("notification/show", { message: "Couldn't copy the link — try again", tone: "error" });
  }
}
