import React from "react";
import { T } from "../styles/theme";

// Error boundaries must be class components — there's still no hook
// equivalent in React. Kept deliberately minimal: catch, show a small
// branded "something went wrong" state with a retry, log it, done.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // No analytics/error-reporting service wired up in this demo app —
    // if you add one (Sentry, etc.), this is the one place to report
    // render errors from.
    console.error("Render error caught by ErrorBoundary:", error, info);
  }

  handleRetry = () => {
    // A reload is the reliable fix here: React.lazy caches a *rejected*
    // import on the component definition itself, so re-rendering the
    // same lazy reference in place would likely just replay the exact
    // same cached failure instead of truly retrying the network request.
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 190,
          background: T.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 24,
          textAlign: "center",
          fontFamily: T.fontBody,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>
          Something went wrong
        </span>
        <span style={{ fontSize: 13, color: T.inkFaint, maxWidth: 280, lineHeight: 1.5 }}>
          This screen couldn't load — check your connection and try again.
        </span>
        <button
          onClick={this.handleRetry}
          className="v2-tap"
          style={{
            marginTop: 6,
            border: "none",
            borderRadius: T.radiusMd,
            padding: "11px 26px",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 0.2,
            color: "#fff",
            background: T.gradButton,
            boxShadow: "0 8px 20px rgba(124,58,237,0.32)",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
