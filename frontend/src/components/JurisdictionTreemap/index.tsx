import { useMemo, useRef, useState } from "react";
import { useCompanyHierarchy } from "../../db/queries";
import { getJurisdictionColor } from "../../utils/jurisdictionColors";

interface JurisdictionTreemapProps {
  companyId: string | null;
  onSubsidiaryClick?: (subsidiaryId: string) => void;
}

interface TreemapState {
  mode: 'jurisdictions' | 'companies';
  selectedJurisdiction?: string;
}

interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  jurisdiction: string;
  count: number;
  scaledValue: number;
  color: string;
}

// Squarify algorithm for better aspect ratios
function squarify(
  items: { jurisdiction: string; count: number; scaledValue: number; color: string }[],
  x: number,
  y: number,
  width: number,
  height: number
): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{
      x, y, width, height,
      jurisdiction: items[0].jurisdiction,
      count: items[0].count,
      scaledValue: items[0].scaledValue,
      color: items[0].color,
    }];
  }

  const totalValue = items.reduce((sum, item) => sum + item.scaledValue, 0);
  if (totalValue === 0) return [];

  const rects: TreemapRect[] = [];
  let currentX = x;
  let currentY = y;
  let remainingWidth = width;
  let remainingHeight = height;

  // Sort by scaled value descending for better layout
  const sorted = [...items].sort((a, b) => b.scaledValue - a.scaledValue);

  // Simple strip layout - alternate between horizontal and vertical strips
  const isHorizontal = width >= height;

  sorted.forEach((item) => {
    const ratio = item.scaledValue / totalValue;

    if (isHorizontal) {
      const rectWidth = remainingWidth * ratio;
      rects.push({
        x: currentX,
        y: currentY,
        width: Math.max(rectWidth, 1),
        height: remainingHeight,
        jurisdiction: item.jurisdiction,
        count: item.count,
        scaledValue: item.scaledValue,
        color: item.color,
      });
      currentX += rectWidth;
    } else {
      const rectHeight = remainingHeight * ratio;
      rects.push({
        x: currentX,
        y: currentY,
        width: remainingWidth,
        height: Math.max(rectHeight, 1),
        jurisdiction: item.jurisdiction,
        count: item.count,
        scaledValue: item.scaledValue,
        color: item.color,
      });
      currentY += rectHeight;
    }
  });

  return rects;
}

export function JurisdictionTreemap({ companyId, onSubsidiaryClick }: JurisdictionTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Fixed dimensions for compact treemap
  const treemapWidth = 400;
  const treemapHeight = 280;
  const { flatHierarchy, isLoading } = useCompanyHierarchy(companyId);

  // State for drill-down functionality
  const [treemapState, setTreemapState] = useState<TreemapState>({ mode: 'jurisdictions' });

  // Group by jurisdiction and apply sqrt scaling - use all subsidiaries from hierarchy
  const { treemapData, companiesByJurisdiction } = useMemo(() => {
    // Exclude the root company (level 0), only count subsidiaries
    const subsidiaries = flatHierarchy.filter((node) => node.level > 0);

    if (subsidiaries.length === 0) {
      return { treemapData: [], companiesByJurisdiction: {} };
    }

    // Group by jurisdiction
    const groups: Record<string, number> = {};
    const companiesByJurisdiction: Record<string, any[]> = {};

    subsidiaries.forEach((sub) => {
      const jurisdiction = sub.jurisdiction || "Unknown";
      groups[jurisdiction] = (groups[jurisdiction] || 0) + 1;
      
      if (!companiesByJurisdiction[jurisdiction]) {
        companiesByJurisdiction[jurisdiction] = [];
      }
      companiesByJurisdiction[jurisdiction].push(sub);
    });

    // Convert to array with sqrt-scaled values for better visibility of small counts
    const entries = Object.entries(groups).map(([jurisdiction, count]) => ({
      jurisdiction,
      count,
      // Use sqrt scaling so small values remain visible
      // e.g., 400 -> 20, 1 -> 1 (ratio goes from 400:1 to 20:1)
      scaledValue: Math.sqrt(count),
      color: getJurisdictionColor(jurisdiction), // Use predefined coloring for consistency
    }));

    return {
      treemapData: entries,
      companiesByJurisdiction,
    };
  }, [flatHierarchy]);

  // Calculate treemap layout
  const rects = useMemo(() => {
    if (treemapState.mode === 'jurisdictions') {
      // Show jurisdiction summary
      if (treemapData.length === 0) return [];
      return squarify(treemapData, 0, 0, treemapWidth, treemapHeight);
    } else {
      // Show companies in selected jurisdiction
      const companies = companiesByJurisdiction[treemapState.selectedJurisdiction!] || [];
      if (companies.length === 0) return [];

      const companyData = companies.map((company) => ({
        jurisdiction: company.name, // Use name as the label
        count: 1, // Each company counts as 1
        scaledValue: 1, // Equal size for all companies
        color: getJurisdictionColor(treemapState.selectedJurisdiction!), // Same color as jurisdiction
        companyId: company.id, // Store company ID for click handling
      }));

      return squarify(companyData, 0, 0, treemapWidth, treemapHeight);
    }
  }, [treemapData, treemapState, companiesByJurisdiction, treemapWidth, treemapHeight]);

  // Handle clicks on treemap rectangles
  const handleRectClick = (rect: TreemapRect) => {
    if (treemapState.mode === 'jurisdictions') {
      // Drill down to companies in this jurisdiction
      setTreemapState({
        mode: 'companies',
        selectedJurisdiction: rect.jurisdiction,
      });
    } else {
      // Click on a company - call the subsidiary click handler
      const companyId = (rect as any).companyId;
      if (companyId && onSubsidiaryClick) {
        onSubsidiaryClick(companyId);
      }
    }
  };

  // Handle back navigation
  const handleBackClick = () => {
    setTreemapState({ mode: 'jurisdictions' });
  };

  if (isLoading) {
    return (
      <div ref={containerRef} className="p-6">
        <div className="flex items-center justify-center" style={{ height: treemapHeight }}>
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading subsidiaries...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div ref={containerRef} className="p-6">
        <div className="flex items-center justify-center text-muted-foreground/60" style={{ height: treemapHeight }}>
          <p className="text-sm">Select a company to view subsidiary distribution</p>
        </div>
      </div>
    );
  }

  if (treemapData.length === 0) {
    return (
      <div ref={containerRef} className="p-6">
        <div className="flex items-center justify-center text-muted-foreground/60" style={{ height: treemapHeight }}>
          <p className="text-sm">No subsidiaries found</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-6">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-3">
          {treemapState.mode === 'companies' && (
            <button
              onClick={handleBackClick}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              ← Back
            </button>
          )}
          <h2 className="text-base font-semibold text-foreground">
            {treemapState.mode === 'jurisdictions'
              ? 'Subsidiaries by Jurisdiction'
              : `Companies in ${treemapState.selectedJurisdiction}`}
          </h2>
        </div>
      </div>

      {/* Horizontal layout: Treemap + List */}
      <div className="flex" style={{ height: treemapHeight, gap: 80 }}>
        {/* Left: Treemap */}
        <div className="flex-shrink-0">
          <svg
            width={treemapWidth}
            height={treemapHeight}
            className="rounded-lg overflow-hidden"
          >
            {rects.map((rect) => {
              const fontSize = Math.min(
                Math.max(9, rect.width / 10),
                Math.max(9, rect.height / 4),
                14
              );
              const showLabel = rect.width > 50 && rect.height > 35;
              const showCount = rect.width > 35 && rect.height > 22;

              return (
                <g key={rect.jurisdiction}>
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill={rect.color}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={1}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    rx={3}
                    onClick={() => handleRectClick(rect)}
                  />

                  {showLabel && (
                    <text
                      x={rect.x + rect.width / 2}
                      y={rect.y + rect.height / 2 - (showCount ? fontSize * 0.3 : 0)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={fontSize}
                      fontWeight="500"
                      className="pointer-events-none select-none"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                    >
                      {rect.jurisdiction.length > 15
                        ? rect.jurisdiction.substring(0, 13) + "..."
                        : rect.jurisdiction}
                    </text>
                  )}

                  {showCount && (
                    <text
                      x={rect.x + rect.width / 2}
                      y={rect.y + rect.height / 2 + (showLabel ? fontSize * 0.7 : 0)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="rgba(255,255,255,0.9)"
                      fontSize={fontSize * 0.8}
                      fontWeight="600"
                      className="pointer-events-none select-none"
                    >
                      {rect.count}
                    </text>
                  )}

                  {!showLabel && (
                    <title>{`${rect.jurisdiction}: ${rect.count}`}</title>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right: Scrollable compact list */}
        <div className="flex-1 overflow-y-auto min-w-0 ml-8" style={{ maxWidth: 280 }}>
          {treemapState.mode === 'jurisdictions' ? (
            <div className="space-y-0">
              {treemapData
                .sort((a, b) => b.count - a.count)
                .map((item) => (
                  <div
                    key={item.jurisdiction}
                    className="flex items-center justify-between py-0.5 px-1 hover:bg-accent/20 cursor-pointer transition-colors rounded"
                    onClick={() =>
                      setTreemapState({
                        mode: 'companies',
                        selectedJurisdiction: item.jurisdiction,
                      })
                    }
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-foreground truncate">
                        {item.jurisdiction}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground ml-2 flex-shrink-0 tabular-nums">
                      {item.count}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="space-y-0">
              {companiesByJurisdiction[treemapState.selectedJurisdiction!]?.map(
                (company) => (
                  <div
                    key={company.id}
                    onClick={() => onSubsidiaryClick?.(company.id)}
                    className="flex items-center justify-between py-0.5 px-1 hover:bg-accent/20 cursor-pointer transition-colors rounded"
                  >
                    <span className="text-xs text-foreground truncate">
                      {company.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                      L{company.level}
                    </span>
                  </div>
                )
              ) || []}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
