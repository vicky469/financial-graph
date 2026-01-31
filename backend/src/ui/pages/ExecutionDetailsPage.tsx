import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

interface ExecutionDetailsPageProps {}

export function ExecutionDetailsPage({}: ExecutionDetailsPageProps) {
  const { executionId } = useParams<{ executionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    execution: any;
    logs: any[];
    triggerStatus?: string;
    triggerOutput?: any;
    triggerError?: any;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!executionId) return;

    const fetchExecutionDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/executions/${executionId}/details`);
        if (!response.ok) {
          throw new Error("Failed to fetch execution details");
        }
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExecutionDetails();
  }, [executionId]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: "16px", color: "#9ca3af" }}>
          Loading execution details...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "40px" }}>
        <button
          onClick={() => navigate("/")}
          className="btn btn-secondary"
          style={{ marginBottom: "20px" }}
        >
          ← Back to Jobs
        </button>
        <div style={{ color: "#ef4444", fontSize: "16px" }}>
          Error: {error || "No data available"}
        </div>
      </div>
    );
  }

  const { execution, logs, triggerStatus, triggerOutput, triggerError } = data;

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <button
          onClick={() => navigate("/")}
          className="btn btn-secondary"
          style={{ marginBottom: "16px" }}
        >
          ← Back to Jobs
        </button>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "600",
            color: "#e5e7eb",
            marginBottom: "8px",
          }}
        >
          Execution Details
        </h1>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>
          Execution ID: {executionId}
        </p>
      </div>

      {/* Execution Summary */}
      <div
        style={{
          background: "#1f2937",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "24px",
          border: "1px solid #374151",
        }}
      >
        <h2
          style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#e5e7eb",
            marginBottom: "16px",
          }}
        >
          Summary
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                marginBottom: "4px",
              }}
            >
              Status
            </div>
            <div
              style={{ fontSize: "14px", color: "#e5e7eb", fontWeight: "500" }}
            >
              {execution.status || "Unknown"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                marginBottom: "4px",
              }}
            >
              Trigger Type
            </div>
            <div style={{ fontSize: "14px", color: "#e5e7eb" }}>
              {execution.trigger_type || "N/A"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                marginBottom: "4px",
              }}
            >
              Started At
            </div>
            <div style={{ fontSize: "14px", color: "#e5e7eb" }}>
              {execution.started_at
                ? new Date(execution.started_at).toLocaleString()
                : "N/A"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                marginBottom: "4px",
              }}
            >
              Completed At
            </div>
            <div style={{ fontSize: "14px", color: "#e5e7eb" }}>
              {execution.completed_at
                ? new Date(execution.completed_at).toLocaleString()
                : "In Progress"}
            </div>
          </div>
          {execution.workflow_id && (
            <div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  marginBottom: "4px",
                }}
              >
                Workflow ID
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#e5e7eb",
                  fontFamily: "monospace",
                }}
              >
                {execution.workflow_id}
              </div>
            </div>
          )}
          {execution.run_id && (
            <div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  marginBottom: "4px",
                }}
              >
                Run ID
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#e5e7eb",
                  fontFamily: "monospace",
                }}
              >
                {execution.run_id}
              </div>
            </div>
          )}
        </div>

        {/* Items Processed */}
        {(execution.items_processed !== undefined ||
          execution.items_succeeded !== undefined ||
          execution.items_failed !== undefined) && (
          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #374151",
            }}
          >
            <div style={{ display: "flex", gap: "24px" }}>
              {execution.items_processed !== undefined && (
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                      marginBottom: "4px",
                    }}
                  >
                    Items Processed
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      color: "#e5e7eb",
                      fontWeight: "600",
                    }}
                  >
                    {execution.items_processed}
                  </div>
                </div>
              )}
              {execution.items_succeeded !== undefined && (
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                      marginBottom: "4px",
                    }}
                  >
                    Succeeded
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      color: "#10b981",
                      fontWeight: "600",
                    }}
                  >
                    {execution.items_succeeded}
                  </div>
                </div>
              )}
              {execution.items_failed !== undefined && (
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                      marginBottom: "4px",
                    }}
                  >
                    Failed
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      color: "#ef4444",
                      fontWeight: "600",
                    }}
                  >
                    {execution.items_failed}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {execution.error_message && (
          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #374151",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                marginBottom: "8px",
              }}
            >
              Error Message
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "#ef4444",
                background: "#1f1f1f",
                padding: "12px",
                borderRadius: "4px",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
              }}
            >
              {execution.error_message}
            </div>
          </div>
        )}
      </div>

      {/* Trigger.dev Status */}
      {triggerStatus && (
        <div
          style={{
            background: "#1f2937",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "24px",
            border: "1px solid #374151",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#e5e7eb",
              marginBottom: "16px",
            }}
          >
            Trigger.dev Status
          </h2>
          <div style={{ fontSize: "14px", color: "#e5e7eb" }}>
            Status: <span style={{ fontWeight: "500" }}>{triggerStatus}</span>
          </div>
          {triggerError && (
            <div style={{ marginTop: "12px" }}>
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  marginBottom: "8px",
                }}
              >
                Error
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#ef4444",
                  background: "#1f1f1f",
                  padding: "12px",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                }}
              >
                {JSON.stringify(triggerError, null, 2)}
              </div>
            </div>
          )}
          {triggerOutput && (
            <div style={{ marginTop: "12px" }}>
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  marginBottom: "8px",
                }}
              >
                Output
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#e5e7eb",
                  background: "#1f1f1f",
                  padding: "12px",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  maxHeight: "300px",
                  overflow: "auto",
                }}
              >
                {JSON.stringify(triggerOutput, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      <div
        style={{
          background: "#1f2937",
          borderRadius: "8px",
          padding: "24px",
          border: "1px solid #374151",
        }}
      >
        <h2
          style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#e5e7eb",
            marginBottom: "16px",
          }}
        >
          Execution Logs
        </h2>
        {logs && logs.length > 0 ? (
          <div
            style={{
              background: "#1f1f1f",
              borderRadius: "4px",
              padding: "16px",
              maxHeight: "600px",
              overflow: "auto",
              fontFamily: "monospace",
              fontSize: "13px",
            }}
          >
            {logs.map((log: any, index: number) => (
              <div
                key={index}
                style={{
                  padding: "8px 0",
                  borderBottom:
                    index < logs.length - 1 ? "1px solid #374151" : "none",
                  color:
                    log.level === "error"
                      ? "#ef4444"
                      : log.level === "warn"
                        ? "#f59e0b"
                        : "#9ca3af",
                }}
              >
                <span style={{ color: "#6b7280", marginRight: "12px" }}>
                  {log.timestamp
                    ? new Date(log.timestamp).toLocaleTimeString()
                    : ""}
                </span>
                <span style={{ color: "#3b82f6", marginRight: "12px" }}>
                  [{log.level || "info"}]
                </span>
                <span>{log.message || JSON.stringify(log)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              fontSize: "14px",
              color: "#9ca3af",
              textAlign: "center",
              padding: "40px",
            }}
          >
            No logs available for this execution
          </div>
        )}
      </div>

      {/* Execution Metadata */}
      {execution.execution_metadata && (
        <div
          style={{
            background: "#1f2937",
            borderRadius: "8px",
            padding: "24px",
            marginTop: "24px",
            border: "1px solid #374151",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#e5e7eb",
              marginBottom: "16px",
            }}
          >
            Execution Metadata
          </h2>
          <div
            style={{
              background: "#1f1f1f",
              borderRadius: "4px",
              padding: "16px",
              maxHeight: "400px",
              overflow: "auto",
              fontFamily: "monospace",
              fontSize: "13px",
              color: "#9ca3af",
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(execution.execution_metadata, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}
