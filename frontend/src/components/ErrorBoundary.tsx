import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "hsl(240 6% 6%)",
            color: "rgba(255,255,255,0.9)",
            padding: "24px",
          }}
        >
          <div
            style={{
              maxWidth: "600px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "12px",
              padding: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "600",
                marginBottom: "12px",
                color: "#ef4444",
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "rgba(255,255,255,0.7)",
                marginBottom: "16px",
              }}
            >
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 20px",
                background: "rgba(99, 102, 241, 0.2)",
                border: "1px solid rgba(99, 102, 241, 0.4)",
                borderRadius: "8px",
                color: "#818cf8",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
