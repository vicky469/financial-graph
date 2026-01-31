/**
 * Execution Details Modal
 *
 * Shows execution logs and status in our UI
 */

import React, { useState, useEffect } from "react";

interface ExecutionLog {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message: string;
  metadata?: any;
}

interface ExecutionDetailsProps {
  executionId: string;
  onClose: () => void;
}

export function ExecutionDetailsModal({
  executionId,
  onClose,
}: ExecutionDetailsProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    execution: any;
    logs: ExecutionLog[];
  } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDetails = async () => {
    try {
      const response = await fetch(`/api/executions/${executionId}/details`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch execution details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();

    // Auto-refresh every 2 seconds if execution is running
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        if (data?.execution?.status === "running") {
          fetchDetails();
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [executionId, autoRefresh, data?.execution?.status]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "#10b981";
      case "running":
      case "executing":
        return "#f59e0b";
      case "failed":
        return "#ef4444";
      case "queued":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case "ERROR":
        return "#ef4444";
      case "WARN":
        return "#f59e0b";
      case "INFO":
        return "#3b82f6";
      case "DEBUG":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "900px", width: "90%" }}
        >
          <div style={{ padding: "40px", textAlign: "center" }}>
            <div className="spinner"></div>
            <p>Loading execution details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h2>Execution Not Found</h2>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    );
  }

  const { execution, logs } = data;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "1000px",
          width: "95%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, marginBottom: "8px" }}>
              Execution Details
            </h2>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: "600",
                  background: getStatusColor(execution.status),
                  color: "white",
                }}
              >
                {execution.status}
              </span>
              <span style={{ fontSize: "14px", color: "#6b7280" }}>
                ID: {executionId.slice(0, 8)}...
              </span>
              <label
                style={{
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Auto-refresh
              </label>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
          {/* Execution Info */}
          <div
            style={{
              marginBottom: "24px",
              padding: "16px",
              background: "#f9fafb",
              borderRadius: "8px",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>
              Execution Info
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                fontSize: "14px",
              }}
            >
              <div>
                <strong>Started:</strong>{" "}
                {new Date(execution.started_at).toLocaleString()}
              </div>
              {execution.completed_at && (
                <div>
                  <strong>Completed:</strong>{" "}
                  {new Date(execution.completed_at).toLocaleString()}
                </div>
              )}
              <div>
                <strong>Trigger:</strong> {execution.trigger_type}
              </div>
              <div>
                <strong>Items Processed:</strong>{" "}
                {execution.items_processed || 0}
              </div>
              {execution.items_succeeded > 0 && (
                <div>
                  <strong>Succeeded:</strong>{" "}
                  <span style={{ color: "#10b981" }}>
                    {execution.items_succeeded}
                  </span>
                </div>
              )}
              {execution.items_failed > 0 && (
                <div>
                  <strong>Failed:</strong>{" "}
                  <span style={{ color: "#ef4444" }}>
                    {execution.items_failed}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {execution.error_message && (
            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
              }}
            >
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "16px",
                  color: "#dc2626",
                }}
              >
                Error
              </h3>
              <pre
                style={{
                  margin: 0,
                  fontSize: "13px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {execution.error_message}
              </pre>
            </div>
          )}

          {/* Logs */}
          <div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>
              Execution Logs {logs.length > 0 && `(${logs.length})`}
            </h3>
            {logs.length === 0 ? (
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "#6b7280",
                  background: "#f9fafb",
                  borderRadius: "8px",
                }}
              >
                No logs available yet. Logs will appear as the task executes.
              </div>
            ) : (
              <div
                style={{
                  background: "#1f2937",
                  borderRadius: "8px",
                  padding: "16px",
                  maxHeight: "400px",
                  overflow: "auto",
                  fontFamily: "monospace",
                  fontSize: "13px",
                }}
              >
                {logs.map((log, index) => (
                  <div
                    key={index}
                    style={{
                      marginBottom: "8px",
                      paddingBottom: "8px",
                      borderBottom:
                        index < logs.length - 1 ? "1px solid #374151" : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          color: "#9ca3af",
                          fontSize: "11px",
                          minWidth: "140px",
                        }}
                      >
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        style={{
                          color: getLogLevelColor(log.level),
                          fontWeight: "600",
                          minWidth: "50px",
                        }}
                      >
                        {log.level}
                      </span>
                      <span style={{ color: "#e5e7eb", flex: 1 }}>
                        {log.message}
                      </span>
                    </div>
                    {log.metadata && (
                      <div
                        style={{
                          marginTop: "4px",
                          marginLeft: "164px",
                          color: "#9ca3af",
                          fontSize: "12px",
                        }}
                      >
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .spinner {
          border: 3px solid #f3f4f6;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
