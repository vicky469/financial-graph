// Right Detail Panel - Read-only view of Entity/Brand details
// Based on schema from 7-Data-Strategy.md and 8-Technical-Architecture.md

import { useRef, useEffect } from "react";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { ScrollArea } from "../ui/scroll-area";
import { ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import type { Node } from "../../types";

interface DetailPanelProps {
  node: Node | null;
  onClose: () => void;
  isPublic?: boolean;
  isSubsidiary?: boolean;
}

export function DetailPanel({ node, onClose, isPublic, isSubsidiary }: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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

  const isEntity = node.type === "Company";
  const isBrand = node.type === "Brand";

  return (
    <aside ref={panelRef} className="detail-panel">
      <ScrollArea className="h-full">
        <div className="detail-panel-content">
          {/* Header */}
          <div className="detail-panel-header">
            <div className="flex-1">
              <div className="detail-panel-title-row">
                <h2 className="detail-panel-title">{node.name}</h2>
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
                      {node.type}
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
          {isEntity && (
            <>
              {/* Core Identity */}
              <Section title="Core Identity">
                <Field label="CIK" value={node.cik} mono />
                <Field label="Jurisdiction" value={node.jurisdiction} />
                <Field label="Sector" value={node.properties?.primary_sector} />
                <Field label="Industry" value={node.properties?.primary_industry} />
              </Section>

              <Separator className="my-6" />

              {/* Hierarchy */}
              <Section title="Hierarchy">
                <Field label="Company Group" value={node.properties?.company_group_id} mono />
                <Field label="Parent Entity" value={node.properties?.parent_id} mono />
                <Field label="Ownership %" value={node.properties?.ownership_percent} />
              </Section>

              <Separator className="my-6" />

              {/* Enrichment Data */}
              <Section title="External Identifiers">
                <Field label="LEI" value={node.properties?.lei} mono />
                <Field label="FIGI" value={node.properties?.figi} mono />
              </Section>

              <Separator className="my-6" />

              {/* Data Quality */}
              <Section title="Data Quality">
                <div className="detail-quality-indicator">
                  {node.properties?.is_complete === "true" ? (
                    <CheckCircle2 className="detail-icon-success" />
                  ) : (
                    <AlertCircle className="detail-icon-warning" />
                  )}
                  <span className="detail-quality-text">
                    {node.properties?.is_complete === "true" ? "Complete" : "Partial Data"}
                  </span>
                </div>
                <Field label="Parsing Method" value={node.properties?.parsing_method} />
                <Field label="Confidence Score" value={node.properties?.confidence_score} />
                <Field label="Data Source" value={node.properties?.data_source_id} mono />
              </Section>
            </>
          )}

          {/* Brand-specific fields */}
          {isBrand && (
            <>
              <Section title="Brand Information">
                <Field label="Brand Type" value={node.properties?.brand_type} />
                <Field label="Sector" value={node.properties?.sector} />
                <Field label="Industry" value={node.properties?.industry} />
                <Field label="Owner Entity" value={node.properties?.entity_id} mono />
              </Section>

              <Separator className="my-6" />
            </>
          )}

          {/* Temporal Data (both Entity and Brand) */}
          <Section title="Temporal Data">
            <Field
              label="Valid From"
              value={node.validFrom ? new Date(node.validFrom).toLocaleDateString() : undefined}
            />
            <Field
              label="Valid To"
              value={node.validTo ? new Date(node.validTo).toLocaleDateString() : "Current"}
            />
          </Section>

          <Separator className="my-6" />

          {/* Links */}
          {node.url && (
            <Section title="External Links">
              <a href={node.url} target="_blank" rel="noopener noreferrer" className="detail-link">
                <ExternalLink className="w-4 h-4" />
                <span>Corporate Website</span>
              </a>
              {node.cik && (
                <a
                  href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${node.cik}`}
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

          {/* Metadata */}
          <Separator className="my-6" />
          <Section title="Metadata">
            <Field label="Created By" value={node.createdBy} />
            <Field label="Created At" value={new Date(node.createdAt).toLocaleString()} />
          </Section>
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

function Field({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;

  return (
    <div className="detail-field">
      <dt className="detail-field-label">{label}</dt>
      <dd className={`detail-field-value ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
