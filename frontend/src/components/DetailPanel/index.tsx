import { useState, useRef, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import type { Node, PropertyValue } from "../../types";

import { useCompanyDetails, /* useCompanyAudits, */ useSubsidiaryDetails } from "../../db/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

// Helper function to format fiscal year end from MMDD to MM/DD
function formatFiscalYearEnd(fiscalYearEnd?: string): string | undefined {
  if (!fiscalYearEnd || fiscalYearEnd.length !== 4) return fiscalYearEnd;
  
  const month = fiscalYearEnd.substring(0, 2);
  const day = fiscalYearEnd.substring(2, 4);
  
  return `${month}/${day}`;
}

interface DetailPanelProps {
  node: Node | { id: string; type: string; name?: string } | null;
  onClose: () => void;
  isPublic?: boolean;
  parentCompanyId?: string | null;
  hideTabs?: boolean; // New prop to hide tabs for mobile
}

export function DetailPanel({
  node,
  onClose,
  isPublic,
  parentCompanyId,
  hideTabs = false,
}: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"info" /* | "audit" */>("info");
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch company details if it's a company
  const { node: fullNode, isLoading: loadingCompany } = useCompanyDetails(
    node?.type === "Company" ? node.id : null
  );

  // Fetch subsidiary details if it's a subsidiary
  const {
    subsidiary,
    parentEdge,
    isLoading: loadingSubsidiary,
  } = useSubsidiaryDetails(node?.type === "Subsidiary" ? node.id : null);

  // const { audits, isLoading: loadingAudits } = useCompanyAudits(
  //   node?.type === "Company" ? node.id : null
  // );

  const displayNode = fullNode || node;
  const isLoading = loadingCompany || loadingSubsidiary;

  if (!node) return null;

  const isEntity = displayNode?.type === "Company";
  const isBrand = displayNode?.type === "Brand";
  const isSubsidiaryNode = node?.type === "Subsidiary";

  const companyNode = isEntity ? (displayNode as Node) : null;
  const brandNode = isBrand ? (displayNode as Node) : null;
  const fullNodeData = displayNode as Node;

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
        <div style={{ padding: `5px ${panelPadding} 0 ${panelPadding}` }}>
          <div className="flex items-center gap-3 mb-3 justify-end">
            {isEntity && (
              <Badge variant={isPublic ? "success" : "default"}>{isPublic ? "PUB" : "PVT"}</Badge>
            )}
            {isBrand && <Badge variant="purple">BRD</Badge>}
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
            }}
          >
            {isSubsidiaryNode ? subsidiary?.name || "Loading..." : node?.name || "Unknown"}
          </h2>
          {(fullNodeData?.updatedAt || (isSubsidiaryNode && subsidiary?.updatedAt)) && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "2px",
                paddingRight: "4px",
              }}
            >
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                Updated:{" "}
                {new Date(
                  fullNodeData?.updatedAt || subsidiary?.updatedAt || ""
                ).toLocaleDateString()}
              </span>
            </div>
          )}
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
          {isEntity && companyNode && (
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

                  <div style={{ gridColumn: "span 2" }}>
                    <TickerField
                      tickers={companyNode.properties?.tickers as string | string[] | undefined}
                    />
                  </div>

                  <FieldRow label="Jurisdiction" value={companyNode.jurisdiction} />
                  <FieldRow label="Exchange" value={companyNode.properties?.exchange} />

                  <FieldRow label="S&P 500" value={companyNode.identity?.sp500} />
                  <FieldRow label="Owner Org" value={companyNode.identity?.ownerOrg} />

                  <FieldRow label="SIC" value={companyNode.identity?.sic} mono />
                  <FieldRow label="SIC Description" value={companyNode.identity?.sicDescription} />
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
                            marginBottom: "2px",
                          }}
                        >
                          Mailing Address
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "rgba(255,255,255,0.95)",
                            lineHeight: "1.3",
                            fontWeight: 500,
                          }}
                        >
                          {companyNode.companyInfo.addresses.mailing.city},{" "}
                          {companyNode.companyInfo.addresses.mailing.stateOrCountry}
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
                                      lineHeight: "1.3",
                                      color: "rgba(255,255,255,0.95)",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {n.name}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "rgba(255,255,255,0.5)",
                                      marginTop: "1px",
                                      fontFamily: "monospace",
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

          {isBrand && brandNode && (
            <Section title="Brand Info">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px 16px",
                }}
              >
                <FieldRow label="Type" value={brandNode.properties?.brand_type} />
                <FieldRow label="Sector" value={brandNode.properties?.sector} />
                <FieldRow label="Industry" value={brandNode.properties?.industry} />
                <FieldRow label="Owner" value={brandNode.properties?.entity_id} mono />
              </div>
            </Section>
          )}

          {/* Data Quality */}
          {fullNodeData?.metadata && (
            <Section title="Data Quality">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px 16px",
                }}
              >
                <FieldRow label="Method" value={fullNodeData.metadata.parsingMethod} />
                <FieldRow
                  label="Confidence"
                  value={
                    fullNodeData.metadata.confidenceScore
                      ? `${(fullNodeData.metadata.confidenceScore * 100).toFixed(0)}%`
                      : undefined
                  }
                />
              </div>
            </Section>
          )}
        </div>
      ) : (
        // Desktop version - show with tabs
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "info" /* | "audit" */)}
          className="flex-1 flex flex-col overflow-hidden min-w-0"
        >
          <div style={{ width: "100%", boxSizing: "border-box", padding: `0 ${panelPadding}` }}>
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
                  padding: "8px 12px",
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
            {/* Same content as above but wrapped in TabsContent */}
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
            {isEntity && companyNode && (
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

                    <div style={{ gridColumn: "span 2" }}>
                      <TickerField
                        tickers={companyNode.properties?.tickers as string | string[] | undefined}
                      />
                    </div>

                    <FieldRow label="Jurisdiction" value={companyNode.jurisdiction} />
                    <FieldRow label="Exchange" value={companyNode.properties?.exchange} />

                    <FieldRow label="S&P 500" value={companyNode.identity?.sp500} />
                    <FieldRow label="Owner Org" value={companyNode.identity?.ownerOrg} />

                    <FieldRow label="SIC" value={companyNode.identity?.sic} mono />
                    <FieldRow label="SIC Description" value={companyNode.identity?.sicDescription} />
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
                              marginBottom: "2px",
                            }}
                          >
                            Mailing Address
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "rgba(255,255,255,0.95)",
                              lineHeight: "1.3",
                              fontWeight: 500,
                            }}
                          >
                            {companyNode.companyInfo.addresses.mailing.city},{" "}
                            {companyNode.companyInfo.addresses.mailing.stateOrCountry}
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
                                        lineHeight: "1.3",
                                        color: "rgba(255,255,255,0.95)",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {n.name}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "rgba(255,255,255,0.5)",
                                        marginTop: "1px",
                                        fontFamily: "monospace",
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

            {isBrand && brandNode && (
              <Section title="Brand Info">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px 16px",
                  }}
                >
                  <FieldRow label="Type" value={brandNode.properties?.brand_type} />
                  <FieldRow label="Sector" value={brandNode.properties?.sector} />
                  <FieldRow label="Industry" value={brandNode.properties?.industry} />
                  <FieldRow label="Owner" value={brandNode.properties?.entity_id} mono />
                </div>
              </Section>
            )}

            {/* Data Quality */}
            {fullNodeData?.metadata && (
              <Section title="Data Quality">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px 16px",
                  }}
                >
                  <FieldRow label="Method" value={fullNodeData.metadata.parsingMethod} />
                  <FieldRow
                    label="Confidence"
                    value={
                      fullNodeData.metadata.confidenceScore
                        ? `${(fullNodeData.metadata.confidenceScore * 100).toFixed(0)}%`
                        : undefined
                    }
                  />
                </div>
                </Section>
              )}
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
        padding: "0 16px 12px 16px",
        marginLeft: "8px",
        borderBottom: noBorder ? "none" : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <h3
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "10px",
          marginTop: "12px",
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
          marginBottom: "2px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.95)",
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-word",
          lineHeight: "1.3",
          fontWeight: 500,
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
          marginBottom: "2px",
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
                fontSize: "10px",
                fontFamily: "monospace",
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: "4px",
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
