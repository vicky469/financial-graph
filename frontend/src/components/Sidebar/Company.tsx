import { useState } from "react";
import { ArrowLeft, ExternalLink, Building2, Sparkles, FileText, ChevronDown } from "lucide-react";
import type { CompanyDetail } from "../../types/domain";
import { useCompanyHierarchy, useCompanyBrands, useCompanyFilings } from "../../db/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { HierarchicalTree } from "../HierarchicalTree";

interface CompanyProps {
  node: CompanyDetail;
  onBack: () => void;
  selectedSubsidiaryId?: string | null;
  onSubsidiaryClick?: (subsidiaryId: string | null) => void;
}

export function Company({ node, onBack, selectedSubsidiaryId, onSubsidiaryClick }: CompanyProps) {
  const { flatHierarchy, isLoading: loadingHierarchy } = useCompanyHierarchy(node.id);
  const { brands, isLoading: loadingBrands } = useCompanyBrands(node.id);
  const { filings, isLoading: loadingFilings } = useCompanyFilings(node.id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
          }}
        >
          <ArrowLeft size={16} color="rgba(255,255,255,0.6)" />
        </button>
        <span
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.9)",
            textTransform: "capitalize",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.name.toLowerCase()}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Company Structure */}
        <Section
          icon={<Building2 size={14} />}
          title="Structure"
          count={Math.max(0, flatHierarchy.length - 1)} // Subtract 1 to exclude the root company
          loading={loadingHierarchy}
        >
          {loadingHierarchy ? (
            <LoadingState />
          ) : (
            <HierarchicalTree
              hierarchy={flatHierarchy}
              selectedNodeId={selectedSubsidiaryId || node.id}
              onNodeClick={(nodeId) => {
                // Clicking the root company clears subsidiary selection
                if (nodeId === node.id) {
                  if (onSubsidiaryClick) {
                    onSubsidiaryClick(null);
                  }
                } else {
                  // Clicking a subsidiary selects it
                  if (onSubsidiaryClick) {
                    onSubsidiaryClick(nodeId);
                  }
                }
              }}
            />
          )}
        </Section>

        {/* Brands */}
        <div>
          <Section
            icon={<Sparkles size={14} />}
            title="Brands"
            count={brands.length}
            loading={loadingBrands}
          >
            {loadingBrands ? (
              <LoadingState />
            ) : brands.length === 0 ? (
              <EmptyState icon={<Sparkles size={20} />} text="No brands" />
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {brands.map((brand) => (
                <div
                  key={brand.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    transition: "background 0.15s ease",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: brand.status === "active" ? "#60a5fa" : "rgba(255,255,255,0.2)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.75)",
                      textTransform: "capitalize",
                      flex: 1,
                    }}
                  >
                    {brand.name.toLowerCase()}
                  </span>
                  {brand.category && (
                    <span
                      style={{
                        fontSize: "13px",
                        color: "rgba(255,255,255,0.35)",
                      }}
                    >
                      {brand.category}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          </Section>
        </div>

        {/* SEC Filings */}
        <Section
          icon={<FileText size={14} />}
          title="SEC Filings"
          count={filings.length}
          loading={loadingFilings}
          noBorder
        >
          {loadingFilings ? (
            <LoadingState />
          ) : filings.length === 0 ? (
            <EmptyState icon={<FileText size={20} />} text="No filings" />
          ) : (
            <div
              style={{
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.08)",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <Table style={{ width: "100%", tableLayout: "fixed" }}>
                <TableHeader>
                  <TableRow style={{ background: "rgba(255,255,255,0.03)" }}>
                    <TableHead style={{...tableHeadStyle, width: "20%"}}>Filing</TableHead>
                    <TableHead style={{...tableHeadStyle, width: "20%"}}>Period</TableHead>
                    <TableHead style={{...tableHeadStyle, width: "15%"}}>Type</TableHead>
                    <TableHead style={{...tableHeadStyle, width: "15%"}}>Index</TableHead>
                    <TableHead style={{...tableHeadStyle, width: "30%"}}>Attachments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filings.map((filing) => {
                    // Get all attachments
                    const attachments = Object.entries(filing.attachments || {})
                      .filter(([key]) => key.startsWith("EX-"))
                      .map(([key, url]) => ({ key, url }));

                    return (
                      <TableRow
                        key={filing.id}
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <TableCell style={tableCellStyle}>
                          {filing.filingDate}
                        </TableCell>
                        <TableCell style={tableCellStyle}>
                          {filing.periodOfReport || (
                            <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                          )}
                        </TableCell>
                        <TableCell style={tableCellStyle}>
                          {filing.filingUrl ? (
                            <a
                              href={filing.filingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "rgba(255,255,255,0.8)",
                                background: "rgba(99, 102, 241, 0.15)",
                                padding: "3px 6px",
                                borderRadius: "3px",
                                display: "inline-block",
                                textDecoration: "none",
                                transition: "all 0.15s ease",
                                cursor: "pointer",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(99, 102, 241, 0.25)";
                                e.currentTarget.style.color = "rgba(255,255,255,0.95)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(99, 102, 241, 0.15)";
                                e.currentTarget.style.color = "rgba(255,255,255,0.8)";
                              }}
                            >
                              {filing.formType}
                            </a>
                          ) : (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "rgba(255,255,255,0.8)",
                                background: "rgba(99, 102, 241, 0.15)",
                                padding: "3px 6px",
                                borderRadius: "3px",
                                display: "inline-block",
                              }}
                            >
                              {filing.formType}
                            </span>
                          )}
                        </TableCell>
                        <TableCell style={tableCellStyle}>
                          <FilingLink url={filing.fileUrl} />
                        </TableCell>
                        <TableCell style={tableCellStyle}>
                          {attachments.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              {attachments.map(({ key, url }) => (
                                <FilingLink key={key} url={url} label={key} />
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  loading,
  children,
  collapsed,
  onToggle,
  onHeaderClick,
  noBorder,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  loading?: boolean;
  children: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  onHeaderClick?: () => void;
  noBorder?: boolean;
}) {
  const isCollapsible = onToggle !== undefined;

  return (
    <div style={{ borderBottom: noBorder ? "none" : "1px solid rgba(255,255,255,0.05)" }}>
      <div
        onClick={() => {
          if (onToggle) onToggle();
          if (onHeaderClick) onHeaderClick();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "14px 16px",
          cursor: isCollapsible || onHeaderClick ? "pointer" : "default",
          transition: "background 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (isCollapsible || onHeaderClick) {
            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.35)" }}>{icon}</span>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.5)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {title}
        </span>
        <span style={{ flex: 1 }} />
        {loading ? (
          <div
            style={{
              width: "12px",
              height: "12px",
              border: "2px solid rgba(99, 102, 241, 0.2)",
              borderTopColor: "#818cf8",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        ) : (
          <>
            <span
              style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.3)",
                fontWeight: 500,
              }}
            >
              {count}
            </span>
            {isCollapsible && (
              <ChevronDown
                size={14}
                style={{
                  color: "rgba(255,255,255,0.3)",
                  transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            )}
          </>
        )}
      </div>
      {!collapsed && <div style={{ padding: "0 12px 16px" }}>{children}</div>}
    </div>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <div
        style={{
          width: "20px",
          height: "20px",
          border: "2px solid rgba(99, 102, 241, 0.2)",
          borderTopColor: "#818cf8",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        gap: "8px",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.2)",
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>{text}</span>
    </div>
  );
}

// Shared table styles
const tableHeadStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "rgba(255,255,255,0.4)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  padding: "6px 8px",
};

const tableCellStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "rgba(255,255,255,0.6)",
  padding: "6px 8px",
  whiteSpace: "nowrap",
};

// Filing link component
function FilingLink({ url, label = "View" }: { url: string; label?: string }) {
  // Transform .txt URLs to -index.html for better SEC viewer
  const displayUrl = url.replace(/\.txt$/, "-index.html");
  
  return (
    <a
      href={displayUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        fontSize: "12px",
        color: "#818cf8",
        textDecoration: "none",
        transition: "color 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#a5b4fc")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#818cf8")}
    >
      {label}
      <ExternalLink size={11} />
    </a>
  );
}
