import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { Node } from "../../types";
import { useCompanyDetails } from "../../db/queries";

interface DetailPanelProps {
  node: Node | null;
  onClose: () => void;
  isPublic?: boolean;
  isSubsidiary?: boolean;
}

export function DetailPanel({ node, onClose, isPublic, isSubsidiary }: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { node: fullNode, isLoading } = useCompanyDetails(
    node?.type === "Company" ? node.id : null
  );
  const displayNode = fullNode || node;

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

  return (
    <aside
      ref={panelRef}
      className="w-[340px] min-w-[340px] shrink-0 h-full bg-card border-l border-border/40 flex flex-col"
    >
      {/* Header */}
      <div className="p-5 border-b border-border/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-foreground leading-tight">
                {node.name}
              </h2>
              {isLoading && (
                <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin shrink-0" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isEntity && (
                <>
                  <Badge variant={isPublic ? "success" : "default"}>
                    {isPublic ? "PUB" : "PVT"}
                  </Badge>
                </>
              )}
              {isBrand && <Badge variant="purple">BRD</Badge>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 -mt-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
        {displayNode && (
          <div style={{ padding: "20px" }}>
            <h3 style={{ 
              fontSize: "11px", 
              fontWeight: 500, 
              color: "rgba(255,255,255,0.4)", 
              textTransform: "uppercase", 
              letterSpacing: "0.05em",
              marginBottom: "12px" 
            }}>
              Metadata
            </h3>
            <div style={{ display: "flex", gap: "24px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "2px" }}>
                  Created At
                </div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
                  {new Date(displayNode.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "2px" }}>
                  Created By
                </div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
                  {displayNode.createdBy || "—"}
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
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
      <h3 style={{ 
        fontSize: "11px", 
        fontWeight: 500, 
        color: "rgba(255,255,255,0.4)", 
        textTransform: "uppercase", 
        letterSpacing: "0.05em",
        marginBottom: "16px" 
      }}>
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
      <div style={{ 
        fontSize: "14px", 
        color: "rgba(255,255,255,0.9)",
        fontFamily: mono ? "monospace" : "inherit"
      }}>
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
