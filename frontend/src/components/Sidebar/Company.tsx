import { ArrowLeft, ExternalLink, Building2, Sparkles, FileText } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Node } from "../../types";
import { useCompanySubsidiaries, useCompanyBrands, useCompanyFilings } from "../../db/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

interface CompanyProps {
  node: Node;
  onBack: () => void;
}

export function Company({ node, onBack }: CompanyProps) {
  const { subsidiaries, isLoading: loadingSubsidiaries } = useCompanySubsidiaries(node.id);
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
          count={subsidiaries.length}
          loading={loadingSubsidiaries}
        >
          {loadingSubsidiaries ? (
            <LoadingState />
          ) : subsidiaries.length === 0 ? (
            <EmptyState icon={<Building2 size={20} />} text="No subsidiaries" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {subsidiaries.map((sub) => (
                <div
                  key={sub.id}
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
                      backgroundColor: sub.cik ? "#34d399" : "rgba(255,255,255,0.2)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.75)",
                      textTransform: "capitalize",
                    }}
                  >
                    {sub.name.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Brands */}
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
                        fontSize: "11px",
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

        {/* SEC Filings */}
        <Section
          icon={<FileText size={14} />}
          title="SEC Filings"
          count={filings.length}
          loading={loadingFilings}
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
                overflow: "hidden",
              }}
            >
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "rgba(255,255,255,0.03)" }}>
                    <TableHead
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.4)",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        padding: "10px 12px",
                      }}
                    >
                      Date
                    </TableHead>
                    <TableHead
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.4)",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        padding: "10px 12px",
                      }}
                    >
                      Type
                    </TableHead>
                    <TableHead
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.4)",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        padding: "10px 12px",
                      }}
                    >
                      Link
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filings.map((filing) => (
                    <TableRow
                      key={filing.id}
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <TableCell
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.6)",
                          padding: "12px",
                        }}
                      >
                        {new Date(filing.filingDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell style={{ padding: "12px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.8)",
                            background: "rgba(99, 102, 241, 0.15)",
                            padding: "4px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          {filing.formType}
                        </span>
                      </TableCell>
                      <TableCell style={{ padding: "12px" }}>
                        <a
                          href={filing.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                            color: "#818cf8",
                            textDecoration: "none",
                            transition: "color 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#a5b4fc")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#818cf8")}
                        >
                          View
                          <ExternalLink size={11} />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
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
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "14px 16px",
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
          <span
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.3)",
              fontWeight: 500,
            }}
          >
            {count}
          </span>
        )}
      </div>
      <div style={{ padding: "0 12px 16px" }}>{children}</div>
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
