
import type { DialSymbol } from "../types";

// Each symbol gets its own consistent color when shown in the clear (not
// masked) — so a run of the same symbol, like "+++++", visibly reads as
// that symbol's color rather than plain text.
export const SYMBOL_COLORS: Record<DialSymbol, string> = {
  "−": "#F97316", // minus — orange
  "+": "#3B82F6", // plus — blue
  "×": "#EF4444", // multiply — red
  "=": "#10B981", // equals — green
  "○": "#7C3AED", // hollow circle — violet (app accent)
  "●": "#EC4899", // filled circle — pink
  "□": "#06B6D4", // hollow square — cyan
  "■": "#F59E0B", // filled square — amber
};
