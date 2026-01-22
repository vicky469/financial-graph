import { useMemo, useRef, useState, useEffect } from "react";
import { useCompanyHierarchy } from "../../db/queries";
import { getJurisdictionColor } from "../../utils/jurisdictionColors";

interface JurisdictionTreemapProps {
  companyId: string | null;
  onSubsidiaryClick?: (subsidiaryId: string) => void;
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
    return [
      {
        x,
        y,
        width,
        height,
        jurisdiction: items[0].jurisdiction,
        count: items[0].count,
        scaledValue: items[0].scaledValue,
        color: items[0].color,
      },
    ];
  }

  const totalValue = items.reduce((sum, item) => sum + item.scaledValue, 0);
  if (totalValue === 0) return [];

  const rects: TreemapRect[] = [];
  let currentX = x;
  let currentY = y;

  // Sort by scaled value descending for better layout
  const sorted = [...items].sort((a, b) => b.scaledValue - a.scaledValue);

  // Simple strip layout - alternate between horizontal and vertical strips
  const isHorizontal = width >= height;

  sorted.forEach((item) => {
    const ratio = item.scaledValue / totalValue;

    if (isHorizontal) {
      const rectWidth = width * ratio;
      rects.push({
        x: currentX,
        y: y,
        width: Math.max(rectWidth, 1),
        height: height,
        jurisdiction: item.jurisdiction,
        count: item.count,
        scaledValue: item.scaledValue,
        color: item.color,
      });
      currentX += rectWidth;
    } else {
      const rectHeight = height * ratio;
      rects.push({
        x: x,
        y: currentY,
        width: width,
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

// Layout constraints
const CHART_MIN_WIDTH = 280;
const CHART_HEIGHT = 280;
const MOBILE_BREAKPOINT = 768;

export function JurisdictionTreemap({ companyId, onSubsidiaryClick }: JurisdictionTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(CHART_MIN_WIDTH);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const { flatHierarchy, isLoading } = useCompanyHierarchy(companyId);

  // Resize observer to adjust chart width based on container
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const containerWidth = entry.contentRect.width;
        const mobile = containerWidth < MOBILE_BREAKPOINT;
        setIsMobile(mobile);

        if (mobile) {
          // On mobile, chart takes full container width (padding already applied to container)
          const newWidth = Math.max(CHART_MIN_WIDTH, containerWidth);
          setChartWidth(newWidth);
        } else {
          // On desktop, calculate available width for chart (container width - list width - gap)
          // List takes ~220px, gap is 24px
          const listWidth = 220;
          const gap = 24;
          const availableForChart = containerWidth - listWidth - gap;
          const newWidth = Math.max(CHART_MIN_WIDTH, availableForChart);
          setChartWidth(newWidth);
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Group by jurisdiction and apply sqrt scaling
  const { treemapData, companiesByJurisdiction } = useMemo(() => {
    const subsidiaries = flatHierarchy.filter((node) => node.level > 0);

    if (subsidiaries.length === 0) {
      return { treemapData: [], companiesByJurisdiction: {} };
    }

    const groups: Record<string, number> = {};
    const companiesByJurisdiction: Record<string, Array<{ id: string; name: string; level: number; jurisdiction?: string }>> = {};

    subsidiaries.forEach((sub) => {
      const jurisdiction = sub.jurisdiction || "Unknown";
      groups[jurisdiction] = (groups[jurisdiction] || 0) + 1;

      if (!companiesByJurisdiction[jurisdiction]) {
        companiesByJurisdiction[jurisdiction] = [];
      }
      companiesByJurisdiction[jurisdiction].push(sub);
    });

    const entries = Object.entries(groups).map(([jurisdiction, count]) => ({
      jurisdiction,
      count,
      scaledValue: Math.sqrt(count),
      color: getJurisdictionColor(jurisdiction),
    }));

    return { treemapData: entries, companiesByJurisdiction };
  }, [flatHierarchy]);

  // Calculate chart height based on mobile state
  const chartHeight = isMobile ? 200 : CHART_HEIGHT;

  // Calculate treemap layout
  const rects = useMemo(() => {
    if (treemapData.length === 0) return [];
    return squarify(treemapData, 0, 0, chartWidth, chartHeight);
  }, [treemapData, chartWidth, chartHeight]);

  // Get companies to display in list
  const listItems = useMemo(() => {
    if (selectedJurisdiction && companiesByJurisdiction[selectedJurisdiction]) {
      return companiesByJurisdiction[selectedJurisdiction];
    }
    return null;
  }, [selectedJurisdiction, companiesByJurisdiction]);

  if (isLoading) {
    return (
      <div ref={containerRef} style={{ padding: "24px", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: CHART_HEIGHT,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"
              style={{ margin: "0 auto 12px" }}
            />
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
              Loading subsidiaries...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!companyId || treemapData.length === 0) {
    return (
      <div ref={containerRef} style={{ padding: "24px", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: CHART_HEIGHT,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <p style={{ fontSize: "13px" }}>
            {!companyId
              ? "Select a company to view subsidiary distribution"
              : "No subsidiaries found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ padding: isMobile ? "16px" : "24px", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
        {selectedJurisdiction && (
          <button
            onClick={() => setSelectedJurisdiction(null)}
            style={{
              fontSize: "12px",
              color: "#60a5fa",
              background: "rgba(96, 165, 250, 0.1)",
              border: "1px solid rgba(96, 165, 250, 0.3)",
              borderRadius: "6px",
              cursor: "pointer",
              padding: "6px 12px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(96, 165, 250, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(96, 165, 250, 0.1)";
            }}
          >
            ← Back
          </button>
        )}
        <h2
          style={{
            fontSize: "11px",
            fontWeight: "600",
            color: "rgba(255,255,255,0.5)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {selectedJurisdiction
            ? `Companies in ${selectedJurisdiction}`
            : "Subsidiaries by Jurisdiction"}
        </h2>
      </div>

      {/* Main layout: Stack on mobile, side-by-side on desktop */}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? "12px" : "24px",
          alignItems: isMobile ? "stretch" : "flex-start",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        {/* Left: Chart (takes remaining space on desktop, full width on mobile) */}
        <div style={{ 
          flexShrink: 0, 
          width: isMobile ? "100%" : "auto",
          flex: isMobile ? "0 0 auto" : "1 1 auto",
          minWidth: 0,
        }}>
          <svg
            width={isMobile ? "100%" : chartWidth}
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="xMinYMin meet"
            style={{ borderRadius: "8px", overflow: "hidden", display: "block", maxWidth: "100%", width: "100%" }}
          >
            {rects.map((rect) => {
              const fontSize = Math.min(
                Math.max(9, rect.width / 10),
                Math.max(9, rect.height / 4),
                14
              );
              // Stricter visibility rules for mobile to avoid clutter
              const minWidth = isMobile ? 60 : 50;
              const minHeight = isMobile ? 40 : 35;
              const showLabel = rect.width > minWidth && rect.height > minHeight;
              const showCount =
                rect.width > (isMobile ? 45 : 35) && rect.height > (isMobile ? 30 : 22);
              const isSelected = selectedJurisdiction === rect.jurisdiction;

              return (
                <g key={rect.jurisdiction}>
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill={rect.color}
                    stroke={isSelected ? "white" : "rgba(0,0,0,0.3)"}
                    strokeWidth={isSelected ? 2 : 1}
                    style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                    opacity={selectedJurisdiction && !isSelected ? 0.5 : 1}
                    rx={3}
                    onClick={() => setSelectedJurisdiction(rect.jurisdiction)}
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
                      style={{
                        pointerEvents: "none",
                        userSelect: "none",
                        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                      }}
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
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {rect.count}
                    </text>
                  )}

                  {!showLabel && <title>{`${rect.jurisdiction}: ${rect.count}`}</title>}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right: List (fixed width on desktop, scrollable) */}
        <div
          style={{
            flex: isMobile ? "1 1 auto" : "0 0 220px",
            minWidth: isMobile ? "auto" : "220px",
            maxWidth: isMobile ? "none" : "220px",
            maxHeight: isMobile ? "250px" : CHART_HEIGHT,
            overflowY: "auto",
          }}
        >
          {listItems ? (
            // Show companies in selected jurisdiction
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "rgba(255,255,255,0.7)",
                  marginBottom: "8px",
                  position: "sticky",
                  top: 0,
                  background: "#0f1115", // Match simplistic dark bg
                  padding: "4px 0",
                  zIndex: 1,
                }}
              >
                {listItems.length} Companies
              </div>
              {listItems.map((company) => (
                <div
                  key={company.id}
                  onClick={() => onSubsidiaryClick?.(company.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: isMobile ? "12px 8px" : "6px 8px", // Larger touch target
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    borderBottom: isMobile ? "1px solid rgba(255,255,255,0.05)" : "1px solid transparent",
                  }}
                  onMouseEnter={(e) =>
                    !isMobile && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
                  }
                  onMouseLeave={(e) =>
                    !isMobile && (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    style={{
                      fontSize:"12px",
                      color: "rgba(255,255,255,0.8)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {company.name}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.3)",
                      marginLeft: "8px",
                      flexShrink: 0,
                    }}
                  >
                    L{company.level}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            // Show jurisdiction summary
            <div>
              {treemapData
                .sort((a, b) => b.count - a.count)
                .map((item) => (
                  <div
                    key={item.jurisdiction}
                    onClick={() => setSelectedJurisdiction(item.jurisdiction)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: isMobile ? "12px 8px" : "6px 8px", // Larger touch target
                      borderRadius: "4px",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      borderBottom: isMobile ? "1px solid rgba(255,255,255,0.05)" : "1px solid transparent",
                    }}
                    onMouseEnter={(e) =>
                      !isMobile && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
                    }
                    onMouseLeave={(e) =>
                      !isMobile && (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "2px",
                          backgroundColor: item.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.8)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.jurisdiction}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "500",
                        color: "rgba(255,255,255,0.4)",
                        marginLeft: "12px",
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {item.count}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
