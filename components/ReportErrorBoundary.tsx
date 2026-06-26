"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ReportErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="error-banner research" role="alert">
          <div>
            <p style={{ marginBottom: 8 }}>Something went wrong rendering this report.</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.7 }}>
              {this.state.error?.message || "Unknown error"}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: "none",
              border: "none",
              color: "var(--red)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              textDecoration: "underline",
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
