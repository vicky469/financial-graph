import { useState } from "react";
import { JurisdictionTreemap } from "../JurisdictionTreemap";

interface DesktopMainContentProps {
  selectedCompanyId: string;
  handleSelectSubsidiary: (subsidiaryId: string | null) => void;
}

export function DesktopMainContent({
  selectedCompanyId,
  handleSelectSubsidiary,
}: DesktopMainContentProps) {
  const [isTreemapExpanded, setIsTreemapExpanded] = useState(true);

  return (
    <div className="flex-1 overflow-hidden flex flex-col" style={{ width: "100%", maxWidth: "100%" }}>
      {/* Collapseable Treemap Section - Desktop */}
      <div className="hide-on-mobile" style={{ flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "8px 24px 12px 24px",
            cursor: "pointer",
            background: "rgba(255,255,255,0.02)",
            transition: "background 0.15s",
          }}
          onClick={() => setIsTreemapExpanded(!isTreemapExpanded)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
          }}
        >
          <h3
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "rgba(255,255,255,0.7)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              paddingTop: "4px",
            }}
          >
            Jurisdiction Distribution
          </h3>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isTreemapExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              marginTop: "2px",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {isTreemapExpanded && (
          <div style={{ background: "hsl(240 6% 6%)" }}>
            <JurisdictionTreemap
              companyId={selectedCompanyId}
              onSubsidiaryClick={handleSelectSubsidiary}
            />
          </div>
        )}
      </div>

      {/* Treemap Section - Mobile only */}
      <div className="hide-on-desktop" style={{ flexShrink: 0 }}>
        <JurisdictionTreemap
          companyId={selectedCompanyId}
          onSubsidiaryClick={handleSelectSubsidiary}
        />
      </div>
      
      {/* Empty space - Desktop */}
      <div className="hide-on-mobile" style={{ 
        flex: 1,
        minHeight: 0,
        width: "100%",
        background: "hsl(240 6% 4%)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch"
      }}>
        {/* Empty space for future content */}
      </div>
    </div>
  );
}
