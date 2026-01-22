import { useState, useRef } from "react";
import { ExternalLink } from "lucide-react";
import type { CompanyDetail, PropertyValue } from "../../types/domain";
import { CompanyType } from "financial-graph-shared";

import { useCompanyDetail } from "../../db/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

// Helper function to format fiscal year end from MMDD to MM/DD
function formatFiscalYearEnd(fiscalYearEnd?: string): string | undefined {
  if (!fiscalYearEnd || fiscalYearEnd.length !== 4) return fiscalYearEnd;
  
  const month = fiscalYearEnd.substring(0, 2);
  const day = fiscalYearEnd.substring(2, 4);
  
  return `${month}/${day}`;
}

interface DetailPanelProps {
  node: CompanyDetail | { id: string; isSubsidiary: boolean; name?: string } | null;
  isPublic?: boolean;
  parentCompanyId?: string | null;
  hideTabs?: boolean; // New prop to hide tabs for mobile
}

// Extracted common content component
function DetailContent({
  isSubsidiaryNode,
  subsidiary,
  parentEdge,
  companyNode,
  handleParentCompanyClick,
}: {
  isSubsidiaryNode: boolean;
  subsidiary: any;
  parentEdge: any;
  companyNode: CompanyDetail | null;
  handleParentCompanyClick: () => void;
}) {
  return (
    <>
      {/* Subsidiary Information */}
      {isSubsidiaryNode && subsidiary && (
        <>
          <Section title="Identity">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px 16px",
              }}
            >
              <FieldRow label="CIK" value={subsidiary.cik} mono />
              <FieldRow label="Jurisdiction" value={subsidiary.jurisdiction} />
              <FieldRow
                label="Ownership %"
                value={parentEdge?.ownership_percent ? `${parentEdge.ownership_percent}%` : "-"}
              />
            </div>

            {/* Parent Company Link */}
            {parentEdge?.parentCompany && (
              <div style={{ marginTop: "10px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: "2px",
                  }}
                >
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
                    fontSize: "12px",
                    color: "#60a5fa",
                    fontWeight: 500,
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
        </>
      )}
      
      {/* Company Information */}
      {companyNode && (
        <>
          <Section title="Identity">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px 16px",
              }}
            >
              <FieldRow label="CIK" value={companyNode.cik} mono />
              <FieldRow
                label="Entity Type"
                value={companyNode.identity?.entityType}
                capitalize
              />

              <TickerField
                tickers={companyNode.identity?.tickers}
              />
              <FieldRow label="Exchange" value={companyNode.identity?.exchanges} />

              <FieldRow label="S&P 500" value={companyNode.identity?.sp500} />
            </div>
          </Section>

          <Section title="Classification">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px 16px",
              }}
            >
              <FieldRow label="SIC" value={companyNode.identity?.sic} mono />
              <FieldRow label="Owner Org" value={companyNode.identity?.ownerOrg} />
              
              <div style={{ gridColumn: "span 2" }}>
                <FieldRow label="SIC Description" value={companyNode.identity?.sicDescription} />
              </div>
              
              <FieldRow label="Category" value={companyNode.identity?.category} />
              <FieldRow label="Jurisdiction" value={companyNode.jurisdiction} />
            </div>
          </Section>

          <Section title="Tax & Legal">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px 16px",
              }}
            >
              <FieldRow label="EIN" value={companyNode.identity?.ein} mono />
            </div>
          </Section>

          {companyNode.companyInfo && (
            <Section title="Company Details" noBorder>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px 16px",
                }}
              >
                <FieldRow
                  label="Fiscal Year End"
                  value={formatFiscalYearEnd(companyNode.companyInfo.fiscal_year_end)}
                />
                <FieldRow label="Phone" value={companyNode.companyInfo.phone} />

                {companyNode.companyInfo.addresses?.mailing && (
                  <div style={{ gridColumn: "span 2" }}>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.5)",
                        marginBottom: "4px",
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                      }}
                    >
                      Mailing Address
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.9)",
                        lineHeight: "1.5",
                        fontWeight: 400,
                        fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
                      }}
                    >
                      {companyNode.companyInfo.addresses.mailing.street1}
                      {companyNode.companyInfo.addresses.mailing.street2 && (
                        <><br />{companyNode.companyInfo.addresses.mailing.street2}</>
                      )}
                      <br />
                      {companyNode.companyInfo.addresses.mailing.city}, {companyNode.companyInfo.addresses.mailing.stateOrCountry} {companyNode.companyInfo.addresses.mailing.zipCode}
                    </div>
                  </div>
                )}

                {companyNode.companyInfo.addresses?.business && (
                  <div style={{ gridColumn: "span 2" }}>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.5)",
                        marginBottom: "4px",
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                      }}
                    >
                      Business Address
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.9)",
                        lineHeight: "1.5",
                        fontWeight: 400,
                        fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
                      }}
                    >
                      {(() => {
                        const mailing = companyNode.companyInfo.addresses.mailing;
                        const business = companyNode.companyInfo.addresses.business;
                        
                        // Check if addresses are the same
                        if (mailing && 
                            business.street1 === mailing.street1 &&
                            business.street2 === mailing.street2 &&
                            business.city === mailing.city &&
                            business.stateOrCountry === mailing.stateOrCountry &&
                            business.zipCode === mailing.zipCode) {
                          return <span style={{ fontStyle: "italic", color: "rgba(255,255,255,0.6)" }}>Same as mailing address</span>;
                        }
                        
                        return (
                          <>
                            {business.street1}
                            {business.street2 && (
                              <><br />{business.street2}</>
                            )}
                            <br />
                            {business.city}, {business.stateOrCountry} {business.zipCode}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                {companyNode.companyInfo.former_names &&
                  Array.isArray(companyNode.companyInfo.former_names) &&
                  companyNode.companyInfo.former_names.length > 0 && (
                    <div style={{ gridColumn: "span 2" }}>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "rgba(255,255,255,0.5)",
                          marginBottom: "4px",
                          fontWeight: 500,
                          letterSpacing: "0.02em",
                        }}
                      >
                        Former Names
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {companyNode.companyInfo.former_names.map((n: any, i: number) => {
                          const formatDate = (d: string) => {
                            if (!d || typeof d !== "string") return "";
                            // Check if it matches ISO format to avoid parsing random strings
                            if (!d.includes("T")) return d;

                            try {
                              const date = new Date(d);
                              if (isNaN(date.getTime())) return d;

                              return date.toLocaleDateString("en-CA", {
                                timeZone: "America/New_York",
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              });
                            } catch (e) {
                              return d;
                            }
                          };

                          const from = formatDate(n.from);
                          const to = formatDate(n.to);

                          return (
                            <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                              <div
                                style={{
                                  fontSize: "12px",
                                  lineHeight: "1.4",
                                  color: "rgba(255,255,255,0.9)",
                                  fontWeight: 400,
                                  fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
                                }}
                              >
                                {n.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "rgba(255,255,255,0.5)",
                                  marginTop: "1px",
                                  fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
                                  fontWeight: 400,
                                }}
                              >
                                ({from} - {to})
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>
            </Section>
          )}
        </>
      )}
    </>
  );
}

export function DetailPanel({
  node,
  isPublic: _isPublic, // Unused but kept for API compatibility
  parentCompanyId,
  hideTabs = false,
}: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"info" /* | "audit" */>("info");
  const panelRef = useRef<HTMLDivElement>(null);

  // Check if this is a subsidiary (either from the flag or if it's not a full CompanyDetail)
  const isSubsidiaryNode = node && 'isSubsidiary' in node ? node.isSubsidiary : false;
  
  // Fetch subsidiary details if it's a subsidiary
  const {
    company: subsidiary,
    parentEdge,
    isLoading: loadingSubsidiary,
  } = useCompanyDetail(isSubsidiaryNode && node ? node.id : null, true);

  // For Company nodes, the full data is already passed in via the node prop
  const displayNode = node;
  const isLoading = loadingSubsidiary;

  if (!node) return null;

  // Check if this is a full company entity (has type field from shared Company)
  const isEntity = displayNode && 'type' in displayNode && typeof displayNode.type === 'number';

  const companyNode = isEntity ? (displayNode as CompanyDetail) : null;
  const fullNodeData = displayNode;

  // Handle subsidiary navigation to parent company
  const handleParentCompanyClick = () => {
    if (parentCompanyId) {
      // Navigate to parent company (don't open new tab)
      window.location.href = `/company/${parentCompanyId}`;
    }
  };

  const panelPadding = "16px";

  return (
    <aside
      ref={panelRef}
      className={`detail-panel w-[340px] min-w-[340px] shrink-0 h-full bg-card border-l border-border/40 flex flex-col ${hideTabs ? 'overflow-visible' : 'overflow-hidden'}`}
    >
      {/* Header - only show if not hiding tabs (desktop mode) */}
      {!hideTabs && (
        <div style={{ padding: `8px ${panelPadding} 0 ${panelPadding}` }}>
          <div className="flex items-center gap-2 mb-1 justify-end">
            {isEntity && companyNode && (
              <Badge variant={companyNode.type === CompanyType.PUBLIC || companyNode.type === CompanyType.ISSUER ? "success" : "default"}>
                {companyNode.type === CompanyType.PUBLIC || companyNode.type === CompanyType.ISSUER ? "PUB" : "PVT"}
              </Badge>
            )}
            {isSubsidiaryNode && <Badge variant="muted">SUB</Badge>}
            {isLoading && (
              <span className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            )}
          </div>
          <h2
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "rgba(255,255,255,0.95)",
              lineHeight: "1.3",
              wordBreak: "break-word",
              marginBottom: "0",
            }}
          >
            {isSubsidiaryNode ? subsidiary?.name || "Loading..." : node?.name || "Unknown"}
          </h2>
          {(fullNodeData && 'updated_at' in fullNodeData && fullNodeData.updated_at) || (isSubsidiaryNode && subsidiary?.updated_at) ? (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "2px",
                paddingRight: "4px",
                marginBottom: "0",
              }}
            >
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                Updated:{" "}
                {new Date(
                  (fullNodeData && 'updated_at' in fullNodeData ? fullNodeData.updated_at : null) || subsidiary?.updated_at || ""
                ).toLocaleDateString()}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Content */}
      {hideTabs ? (
        // Mobile version - show content directly without tabs
        <div className="flex-1 overflow-y-auto px-0 mobile-detail-content" style={{ 
          scrollbarWidth: "thin", 
          scrollbarGutter: "stable",
          WebkitOverflowScrolling: "touch" // Enable smooth scrolling on iOS
        }}>
          <DetailContent
            isSubsidiaryNode={isSubsidiaryNode}
            subsidiary={subsidiary}
            parentEdge={parentEdge}
            companyNode={companyNode}
            handleParentCompanyClick={handleParentCompanyClick}
          />
        </div>
      ) : (
        // Desktop version - show with tabs
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "info" /* | "audit" */)}
          className="flex-1 flex flex-col overflow-hidden min-w-0"
        >
          <div style={{ width: "100%", boxSizing: "border-box", padding: "0 16px" }}>
            <TabsList
              style={{
                display: "flex",
                width: "100%",
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: "0",
                borderRadius: "4px",
                boxSizing: "border-box",
              }}
            >
              <TabsTrigger
                value="info"
                className="cursor-pointer select-none"
                style={{
                  flex: 1,
                  backgroundColor: activeTab === "info" ? "rgba(255,255,255,0.1)" : "transparent",
                  color: activeTab === "info" ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.5)",
                  fontWeight: activeTab === "info" ? "600" : "400",
                  transition: "all 0.2s ease",
                  padding: "10px 16px",
                  fontSize: "11px",
                  borderBottom: activeTab === "info" ? "2px solid #3b82f6" : "2px solid transparent",
                }}
              >
                {isSubsidiaryNode ? "Company Info" : "Company Info"}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="info"
            className="flex-1 overflow-y-auto mt-0"
            style={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}
          >
            <DetailContent
              isSubsidiaryNode={isSubsidiaryNode}
              subsidiary={subsidiary}
              parentEdge={parentEdge}
              companyNode={companyNode}
              handleParentCompanyClick={handleParentCompanyClick}
            />
          </TabsContent>
          </Tabs>
        )}
    </aside>
  );
}

function Section({
  title,
  children,
  noBorder = false,
}: {
  title: string;
  children: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div
      style={{
        padding: "0 16px 16px 16px",
        marginLeft: "0px",
        borderBottom: noBorder ? "none" : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <h3
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: "12px",
          marginTop: "16px",
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
  capitalize = false,
  className = "",
}: {
  label: string;
  value?: PropertyValue;
  mono?: boolean;
  capitalize?: boolean;
  className?: string;
}) {
  if (value === undefined || value === null || value === "") return null;

  let display: string;
  if (Array.isArray(value)) {
    display = value.join(", ");
  } else if (typeof value === "boolean") {
    display = value ? "Yes" : "No";
  } else {
    display = String(value);
  }

  if (capitalize && display) {
    display = display.charAt(0).toUpperCase() + display.slice(1);
  }

  return (
    <div className={className}>
      <div
        style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.5)",
          marginBottom: "4px",
          fontWeight: 500,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "12px",
          color: mono ? "#60a5fa" : "rgba(255,255,255,0.9)",
          fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
          wordBreak: "break-word",
          lineHeight: "1.4",
          fontWeight: 400,
          letterSpacing: "0",
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
    <div>
      <div
        style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.5)",
          marginBottom: "4px",
          fontWeight: 500,
          letterSpacing: "0.02em",
        }}
      >
        Tickers
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {list.map((ticker, index) => {
          const style = colorStyles[index % colorStyles.length];
          return (
            <span
              key={ticker}
              style={{
                display: "inline-block",
                fontSize: "11px",
                fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
                fontWeight: 600,
                padding: "3px 7px",
                borderRadius: "4px",
                backgroundColor: style.bg,
                color: style.color,
                border: `1px solid ${style.border}`,
                letterSpacing: "0.01em",
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
        fontSize: "10px",
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: "4px",
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

/*
// Audit Entry Component - commented out until we have audit data to show
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
*/
