import React from "react";
import { T } from "../styles/theme";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Error Boundaries have to be class components — React doesn't offer a
// hook equivalent for getDerivedStateFromError/componentDidCatch, so this
// is the one deliberate exception to "components should be functions" in
// this codebase, not an oversight.
//
// Catches render-time errors anywhere below it in the tree (a screen
// throwing while rendering, a bad prop causing a crash) and shows a real
// fallback instead of a blank white screen — which is what a PWA shows by
// default on an uncaught render error, with zero indication anything went
// wrong or how to recover.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // TODO(production): send to a real error-tracking service (Sentry,
    // Bugsnag, etc.) — console.error is the honest placeholder for a
    // sandbox with no such service configured, not a real production path.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] caught a render error:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 32,
            background: T.bg,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, maxWidth: 280, lineHeight: 1.5 }}>
            This screen hit an unexpected error. Reloading usually fixes it — your data hasn't
            been affected.
          </div>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: 8,
              border: "none",
              borderRadius: T.radiusMd,
              padding: "11px 28px",
              background: T.gradButton,
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(124,58,237,0.32)",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
