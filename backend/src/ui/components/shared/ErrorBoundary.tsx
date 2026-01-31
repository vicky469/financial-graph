import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: '24px',
            background: '#1a1a1a',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            margin: '16px',
          }}
        >
          <h2 style={{ color: '#ef4444', marginBottom: '16px', fontSize: '18px' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '16px', fontSize: '14px' }}>
            An error occurred in the application. Please try refreshing the page or contact support if the problem persists.
          </p>
          
          {this.state.error && (
            <details style={{ marginBottom: '16px' }}>
              <summary
                style={{
                  cursor: 'pointer',
                  color: '#e5e7eb',
                  fontSize: '13px',
                  marginBottom: '8px',
                  userSelect: 'none',
                }}
              >
                Error Details
              </summary>
              <div
                style={{
                  background: '#0a0a0a',
                  padding: '12px',
                  borderRadius: '4px',
                  marginTop: '8px',
                  overflow: 'auto',
                }}
              >
                <pre
                  style={{
                    color: '#ef4444',
                    fontSize: '12px',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre
                    style={{
                      color: '#9ca3af',
                      fontSize: '11px',
                      marginTop: '12px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleReset}
              className="btn btn-primary"
              style={{ fontSize: '14px' }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-secondary"
              style={{ fontSize: '14px' }}
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
