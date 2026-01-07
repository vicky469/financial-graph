// Right Detail Panel - Read-only view of Entity/Brand details
// Based on schema from 7-Data-Strategy.md and 8-Technical-Architecture.md

import { useRef, useEffect } from "react";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { ScrollArea } from "../ui/scroll-area";
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

  return (
    <aside ref={panelRef} className="detail-panel">
      <ScrollArea className="h-full">
        <div className="detail-panel-content">
          {/* Header */}
          <div className="detail-panel-header">
            <div className="flex-1">
              <div className="detail-panel-title-row">
                <h2 className="detail-panel-title capitalize">{node.name.toLowerCase()}</h2>
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                )}
                <div className="flex gap-2 mt-2">
                  {isEntity ? (
                    <>
                      <Badge className={isPublic ? "badge public" : "badge private"}>
                        {isPublic ? "Public Company" : "Private Company"}
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
                <Field label="Jurisdiction" value={displayNode.jurisdiction} />
                <Field label="Sector" value={displayNode.properties?.primary_sector} />
                <Field label="Industry" value={displayNode.properties?.primary_industry} />
              </Section>

              <Separator className="my-6" />

              {/* Hierarchy */}
              <Section title="Hierarchy">
                <Field label="Company Group" value={displayNode.properties?.company_group_id} mono />
                <Field label="Parent Entity" value={displayNode.properties?.parent_id} mono />
                <Field label="Ownership %" value={displayNode.properties?.ownership_percent} />
              </Section>

              <Separator className="my-6" />

              {/* Enrichment Data */}
              <Section title="External Identifiers">
                <Field label="LEI" value={displayNode.properties?.lei} mono />
                <Field label="FIGI" value={displayNode.properties?.figi} mono />
              </Section>

              <Separator className="my-6" />

              {/* Data Quality */}
              <Section title="Data Quality">
                <div className="detail-quality-indicator">
                  {displayNode.properties?.is_complete === "true" ? (
                    <CheckCircle2 className="detail-icon-success" />
                  ) : (
                    <AlertCircle className="detail-icon-warning" />
                  )}
                  <span className="detail-quality-text">
                    {displayNode.properties?.is_complete === "true" ? "Complete" : "Partial Data"}
                  </span>
                </div>
                <Field label="Parsing Method" value={displayNode.properties?.parsing_method} />
                <Field label="Confidence Score" value={displayNode.properties?.confidence_score} />
                <Field label="Data Source" value={displayNode.properties?.data_source_id} mono />
              </Section>
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
          {displayNode && (
            <Section title="Temporal Data">
              <Field
                label="Valid From"
                value={displayNode.validFrom ? new Date(displayNode.validFrom).toLocaleDateString() : undefined}
              />
              <Field
                label="Valid To"
                value={displayNode.validTo ? new Date(displayNode.validTo).toLocaleDateString() : "Current"}
              />
            </Section>
          )}

          <Separator className="my-6" />

          {/* Links */}
          {displayNode?.url && (
            <Section title="External Links">
              <a href={displayNode.url} target="_blank" rel="noopener noreferrer" className="detail-link">
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
                <Field
                  label="Is Complete"
                  value={displayNode.metadata.isComplete}
                />
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
                <Field label="Created At" value={new Date(displayNode.createdAt).toLocaleString()} />
              </Section>
            </>
          )}
        </div>
      </ScrollArea>
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
