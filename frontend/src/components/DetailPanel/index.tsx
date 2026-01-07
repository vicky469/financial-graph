// Right Detail Panel - Read-only view of Entity/Brand details
// Based on schema from 7-Data-Strategy.md and 8-Technical-Architecture.md

import { useRef, useEffect } from "react";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
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

  // Fetch full details only when panel is open
  const { node: fullNode, isLoading } = useCompanyDetails(
    node?.type === "Company" ? node.id : null
  );

  // Use full node data if available, otherwise fall back to minimal node data
  const displayNode = fullNode || node;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as HTMLElement)) {
        onClose();
      }
    };

    // Add event listener with a slight delay to avoid closing immediately on the click that opened it
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

  // When node is selected, show the detail panel
  return (
    <aside
      ref={panelRef}
      className="w-[380px] min-w-[380px] max-w-[380px] shrink-0 h-full bg-background border-l border-border/50 z-40 flex flex-col shadow-xl"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="p-5">
          <div className="flex items-start justify-between mb-5 pb-4 border-b border-border">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold text-foreground m-0 leading-tight">
                  {node.name}
                </h2>
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                )}
                <div className="flex gap-2 mt-2">
                  {isEntity ? (
                    <>
                      <Badge className={isPublic ? "badge public" : "badge private"}>
                        {isPublic ? "Public" : "Private"}
                      </Badge>
                      {isSubsidiary && <Badge className="badge subsidiary">Subsidiary</Badge>}
                    </>
                  ) : (
                    <Badge variant="secondary" className="detail-panel-badge">
                      {displayNode?.type}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="detail-panel-close" aria-label="Close panel">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Entity-specific fields */}
          {isEntity && displayNode && (
            <>
              {/* Core Identity */}
              <Section title="Core Identity">
                <Field label="CIK" value={displayNode.cik} mono />
                <TickerBadges tickers={displayNode.properties?.tickers as string | undefined} />
                <Field label="Exchange" value={displayNode.properties?.exchange} />
                <Field label="Jurisdiction" value={displayNode.jurisdiction} />
                <Field label="Sector" value={displayNode.properties?.primary_sector} />
                <Field label="Industry" value={displayNode.properties?.primary_industry} />
              </Section>

              <Separator className="my-6" />

              <Separator className="my-6" />

              {/* Enrichment Data */}
              <Section title="External Identifiers">
                <Field label="LEI" value={displayNode.properties?.lei} mono />
                <Field label="FIGI" value={displayNode.properties?.figi} mono />
              </Section>

              <Separator className="my-6" />
            </>
          )}

          {/* Brand-specific fields */}
          {isBrand && displayNode && (
            <>
              <Section title="Brand Information">
                <Field label="Brand Type" value={displayNode.properties?.brand_type} />
                <Field label="Sector" value={displayNode.properties?.sector} />
                <Field label="Industry" value={displayNode.properties?.industry} />
                <Field label="Owner Entity" value={displayNode.properties?.entity_id} mono />
              </Section>

              <Separator className="my-6" />
            </>
          )}

          {/* Temporal Data (both Entity and Brand) */}
          {displayNode && <Section title="Temporal Data"></Section>}

          <Separator className="my-6" />

          {/* Links */}
          {displayNode?.url && (
            <Section title="External Links">
              <a
                href={displayNode.url}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-link"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Corporate Website</span>
              </a>
              {displayNode.cik && (
                <a
                  href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${displayNode.cik}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="detail-link"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View on SEC.gov</span>
                </a>
              )}
            </Section>
          )}

          {/* Data Quality & Provenance */}
          {displayNode?.metadata && (
            <>
              <Separator className="my-6" />
              <Section title="Data Quality & Provenance">
                <Field label="Parsing Method" value={displayNode.metadata.parsingMethod} />
                <Field
                  label="Confidence Score"
                  value={displayNode.metadata.confidenceScore?.toFixed(2)}
                />
                <Field label="Is Complete" value={displayNode.metadata.isComplete} />
                <Field label="Data Source ID" value={displayNode.metadata.dataSourceId} mono />
                <Field label="Source Filing ID" value={displayNode.metadata.sourceFilingId} mono />
              </Section>
            </>
          )}

          {/* Metadata */}
          {displayNode && (
            <>
              <Separator className="my-6" />
              <Section title="Metadata">
                <Field label="Created By" value={displayNode.createdBy} />
                <Field
                  label="Created At"
                  value={new Date(displayNode.createdAt).toLocaleString()}
                />
              </Section>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

// Helper Components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="detail-section">
      <h3 className="detail-section-title">{title}</h3>
      <div className="detail-section-content">{children}</div>
    </div>
  );
}

type FieldValue = string | number | boolean | string[] | null | undefined;

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: FieldValue;
  mono?: boolean;
}) {
  if (value === undefined || value === null || value === "") return null;

  const display = Array.isArray(value)
    ? value.join(", ")
    : typeof value === "boolean"
    ? value
      ? "Yes"
      : "No"
    : String(value);

  return (
    <div className="detail-field">
      <dt className="detail-field-label">{label}</dt>
      <dd className={`detail-field-value ${mono ? "font-mono" : ""}`}>{display}</dd>
    </div>
  );
}

function TickerBadges({ tickers }: { tickers?: string | string[] | null }) {
  if (!tickers) return null;

  const tickerList = Array.isArray(tickers)
    ? tickers
    : typeof tickers === "string"
    ? tickers
        .split(/[,\s]+/) // Split by comma or spaces
        .map((t) => t.trim())
        .filter(Boolean) // Remove empty strings
    : [];

  if (tickerList.length === 0) return null;

  return (
    <div className="detail-field">
      <dt className="detail-field-label">Tickers</dt>
      <dd className="mt-2" style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        {tickerList.map((ticker) => (
          <Badge key={ticker} variant="outline" className="font-mono text-xs px-2.5 py-1">
            {ticker}
          </Badge>
        ))}
      </dd>
    </div>
  );
}
