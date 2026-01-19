import { useState, useRef, useEffect } from "react";
import { X, Clock, User, GitBranch, Sparkles, ExternalLink } from "lucide-react";
import type { Node } from "../../types";
import { useCompanyDetails, useCompanyAudits, useSubsidiaryDetails } from "../../db/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface DetailPanelProps {
  node: Node | { id: string; type: string } | null;
  onClose: () => void;
  isPublic?: boolean;
  isSubsidiary?: boolean;
  parentCompanyId?: string | null;
}

export function DetailPanel({ node, onClose, isPublic, isSubsidiary: _isSubsidiary, parentCompanyId }: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"info" | "audit">("info");
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Fetch company details if it's a company
  const { node: fullNode, isLoading: loadingCompany } = useCompanyDetails(
    node?.type === "Company" ? node.id : null
  );
  
  // Fetch subsidiary details if it's a subsidiary
  const { subsidiary, parentEdge, isLoading: loadingSubsidiary } = useSubsidiaryDetails(
    node?.type === "Subsidiary" ? node.id : null,
    parentCompanyId
  );
  
  const { audits, isLoading: loadingAudits } = useCompanyAudits(
    node?.type === "Company" ? node.id : null
  );
  
  const displayNode = fullNode || node;
  const isLoading = loadingCompany || loadingSubsidiary;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as HTMLElement)) {
        onClose();
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (!node) return null;

  const isEntity = displayNode?.type === "Company";
  const isBrand = displayNode?.type === "Brand";
  const isSubsidiaryNode = node?.type === "Subsidiary";

  // Handle subsidiary navigation to parent company
  const handleParentCompanyClick = () => {
    if (parentCompanyId) {
      // Navigate to parent company (don't open new tab)
      window.location.href = `/company/${parentCompanyId}`;
    }
  };

  return (
    <aside
      ref={panelRef}
      className="w-[340px] min-w-[340px] shrink-0 h-full bg-card border-l border-border/40 flex flex-col"
    >
      {/* Header */}
      <div className="p-5 border-b border-border/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-foreground leading-tight">
                {isSubsidiaryNode ? (subsidiary?.name || "Loading...") : (node?.name || "Unknown")}
              </h2>
              {isLoading && (
                <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin shrink-0" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEntity && (
              <Badge variant={isPublic ? "success" : "default"}>
                {isPublic ? "PUB" : "PVT"}
              </Badge>
            )}
            {isBrand && <Badge variant="purple">BRD</Badge>}
            {isSubsidiaryNode && <Badge variant="muted">SUB</Badge>}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "info" | "audit")}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid w-full grid-cols-2 mx-5 mt-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '8px' }}>
          <TabsTrigger 
            value="info"
            className="cursor-pointer select-none"
            style={{
              backgroundColor: activeTab === 'info' ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: activeTab === 'info' ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.5)',
              fontWeight: activeTab === 'info' ? '600' : '400',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              padding: '12px 16px',
              fontSize: '14px',
            }}
          >
            {isSubsidiaryNode ? "Company Info" : "Company Info"}
          </TabsTrigger>
          <TabsTrigger 
            value="audit"
            className="cursor-pointer select-none"
            style={{
              backgroundColor: activeTab === 'audit' ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: activeTab === 'audit' ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.5)',
              fontWeight: activeTab === 'audit' ? '600' : '400',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              padding: '12px 16px',
              fontSize: '14px',
            }}
          >
            Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="flex-1 overflow-y-auto mt-0">
          {/* Subsidiary Information */}
          {isSubsidiaryNode && subsidiary && (
            <>
              <Section title="Identity">
                <FieldRow label="CIK" value={subsidiary.cik} mono />
                <FieldRow label="Jurisdiction" value={subsidiary.jurisdiction} />
                <FieldRow 
                  label="Ownership %" 
                  value={parentEdge?.ownership_percent ? `${parentEdge.ownership_percent}%` : "-"} 
                />
                
                {/* Parent Company Link */}
                {parentEdge?.parentCompany && (
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>
                      Parent Company
                    </div>
                    <button
                      onClick={handleParentCompanyClick}
                      className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        fontSize: "14px",
                        color: "#60a5fa",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#93c5fd")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#60a5fa")}
                    >
                      {parentEdge.parentCompany.name}
                      <ExternalLink size={12} />
                    </button>
                  </div>
                )}
              </Section>

              {/* Metadata for subsidiaries */}
              {subsidiary && (
                <div style={{ padding: "20px" }}>
                  <h3
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.4)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "12px",
                    }}
                  >
                    Metadata
                  </h3>
                  <div style={{ display: "flex", gap: "24px" }}>
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.4)",
                          marginBottom: "2px",
                        }}
                      >
                        Updated At
                      </div>
                      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
                        {subsidiary.updatedAt ? new Date(subsidiary.updatedAt).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.4)",
                          marginBottom: "2px",
                        }}
                      >
                        Updated By
                      </div>
                      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
                        {subsidiary.updatedBy || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Company Information */}
          {isEntity && displayNode && (
            <>
              <Section title="Identity">
                <FieldRow label="CIK" value={displayNode.cik} mono />
                <TickerField tickers={displayNode.properties?.tickers as string | undefined} />
                <FieldRow label="Exchange" value={displayNode.properties?.exchange} />
                <FieldRow label="Jurisdiction" value={displayNode.jurisdiction} />
              </Section>
            </>
          )}

          {isBrand && displayNode && (
            <Section title="Brand Info">
              <FieldRow label="Type" value={displayNode.properties?.brand_type} />
              <FieldRow label="Sector" value={displayNode.properties?.sector} />
              <FieldRow label="Industry" value={displayNode.properties?.industry} />
              <FieldRow label="Owner" value={displayNode.properties?.entity_id} mono />
            </Section>
          )}

          {/* Metadata - compact two column layout, no bottom border */}
          {displayNode && !isSubsidiaryNode && (
            <div style={{ padding: "20px" }}>
              <h3
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "12px",
                }}
              >
                Metadata
              </h3>
              <div style={{ display: "flex", gap: "24px" }}>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.4)",
                      marginBottom: "2px",
                    }}
                  >
                    Updated At
                  </div>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
                    {new Date(displayNode.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.4)",
                      marginBottom: "2px",
                    }}
                  >
                    Updated By
                  </div>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
                    {displayNode.updatedBy || "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data Quality */}
          {displayNode?.metadata && (
            <Section title="Data Quality">
              <FieldRow label="Method" value={displayNode.metadata.parsingMethod} />
              <FieldRow
                label="Confidence"
                value={
                  displayNode.metadata.confidenceScore
                    ? `${(displayNode.metadata.confidenceScore * 100).toFixed(0)}%`
                    : undefined
                }
              />
            </Section>
          )}
        </TabsContent>

        <TabsContent value="audit" className="flex-1 overflow-y-auto mt-0">
          <div style={{ padding: "20px" }}>
            <h3
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "16px",
              }}
            >
              Change History
            </h3>
            {loadingAudits ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
                <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : audits.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "48px 24px",
                  gap: "8px",
                }}
              >
                <GitBranch size={32} style={{ color: "rgba(255,255,255,0.2)" }} />
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                  No audit records
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {audits.map((audit) => (
                  <AuditEntry key={audit.id} audit={audit} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
      <h3
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "16px",
        }}
      >
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | number | boolean | null;
  mono?: boolean;
}) {
  if (value === undefined || value === null || value === "") return null;
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: "14px",
          color: "rgba(255,255,255,0.9)",
          fontFamily: mono ? "monospace" : "inherit",
        }}
      >
        {display}
      </div>
    </div>
  );
}

function TickerField({ tickers }: { tickers?: string | string[] | null }) {
  if (!tickers) return null;
  const list = Array.isArray(tickers)
    ? tickers
    : tickers
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
  if (list.length === 0) return null;

  // Colorful badge styles
  const colorStyles = [
    { bg: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.4)" },
    { bg: "rgba(168, 85, 247, 0.2)", color: "#c084fc", border: "rgba(168, 85, 247, 0.4)" },
    { bg: "rgba(236, 72, 153, 0.2)", color: "#f472b6", border: "rgba(236, 72, 153, 0.4)" },
    { bg: "rgba(6, 182, 212, 0.2)", color: "#22d3ee", border: "rgba(6, 182, 212, 0.4)" },
    { bg: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.4)" },
    { bg: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "rgba(16, 185, 129, 0.4)" },
    { bg: "rgba(244, 63, 94, 0.2)", color: "#fb7185", border: "rgba(244, 63, 94, 0.4)" },
    { bg: "rgba(99, 102, 241, 0.2)", color: "#818cf8", border: "rgba(99, 102, 241, 0.4)" },
  ];

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", marginBottom: "8px" }}>
        Tickers
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {list.map((ticker, index) => {
          const style = colorStyles[index % colorStyles.length];
          return (
            <span
              key={ticker}
              style={{
                display: "inline-block",
                fontSize: "12px",
                fontFamily: "monospace",
                padding: "6px 10px",
                borderRadius: "6px",
                backgroundColor: style.bg,
                color: style.color,
                border: `1px solid ${style.border}`,
              }}
            >
              {ticker}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "muted" | "purple";
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      backgroundColor: "rgba(100, 100, 100, 0.3)",
      color: "#a1a1aa",
      border: "1px solid rgba(100, 100, 100, 0.5)",
    },
    success: {
      backgroundColor: "rgba(34, 197, 94, 0.3)",
      color: "#4ade80",
      border: "1px solid rgba(34, 197, 94, 0.5)",
    },
    muted: {
      backgroundColor: "rgba(100, 100, 100, 0.3)",
      color: "#a1a1aa",
      border: "1px solid rgba(100, 100, 100, 0.5)",
    },
    purple: {
      backgroundColor: "rgba(168, 85, 247, 0.3)",
      color: "#c084fc",
      border: "1px solid rgba(168, 85, 247, 0.5)",
    },
  };

  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "11px",
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: "4px",
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

// Audit Entry Component
function AuditEntry({ audit }: { audit: any }) {
  const getOperationColor = (op: string) => {
    switch (op) {
      case "CREATE":
        return "#34d399";
      case "UPDATE":
        return "#60a5fa";
      case "DELETE":
        return "#f87171";
      default:
        return "rgba(255,255,255,0.3)";
    }
  };

  const getAgentIcon = (agent: string) => {
    switch (agent) {
      case "heuristic":
        return <GitBranch size={12} />;
      case "llm":
        return <Sparkles size={12} />;
      case "human":
        return <User size={12} />;
      default:
        return null;
    }
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <div
      style={{
        padding: "12px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "#1a1a1a",
            background: getOperationColor(audit.operation),
            padding: "3px 8px",
            borderRadius: "4px",
          }}
        >
          {audit.operation}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          {getAgentIcon(audit.changed_by)}
          <span style={{ fontSize: "11px" }}>{audit.changed_by}</span>
        </div>
        <span style={{ flex: 1 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <Clock size={11} />
          <span style={{ fontSize: "11px" }}>{formatTimestamp(audit.changed_at)}</span>
        </div>
      </div>

      {/* Fields Changed */}
      {audit.fields_changed && audit.fields_changed.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {audit.fields_changed.map((change: any, idx: number) => (
            <div
              key={idx}
              style={{
                fontSize: "11px",
                padding: "6px 8px",
                borderRadius: "4px",
                background: "rgba(255,255,255,0.03)",
                fontFamily: "monospace",
              }}
            >
              <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: "2px" }}>
                {change.field}
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ color: "#f87171" }}>{formatValue(change.old_value)}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>→</span>
                <span style={{ color: "#34d399" }}>{formatValue(change.new_value)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
