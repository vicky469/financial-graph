import { useMemo } from "react";
import { MapPin } from "lucide-react";

interface JurisdictionData {
  jurisdiction: string;
  count: number;
  subsidiaries: { id: string; name: string }[];
}

interface JurisdictionChartProps {
  data: JurisdictionData[];
  onJurisdictionClick?: (jurisdiction: string) => void;
  onSubsidiaryClick?: (subsidiaryId: string) => void;
}

export function JurisdictionChart({
  data,
  onJurisdictionClick,
  onSubsidiaryClick,
}: JurisdictionChartProps) {
  // Sort by count descending
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.count - a.count);
  }, [data]);

  // Smart scaling: use sqrt to make small values visible
  const maxCount = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);
  const scaledMax = Math.sqrt(maxCount);

  const getBarWidth = (count: number): number => {
    // sqrt scaling so small numbers are visible
    return (Math.sqrt(count) / scaledMax) * 100;
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.2)",
            marginBottom: "12px",
          }}
        >
          <MapPin size={24} />
        </div>
        <p style={{ fontSize: "11px !important", color: "rgba(255,255,255,0.4)" }}>
          No jurisdiction data
        </p>
      </div>
    );
  }

  const totalSubsidiaries = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <h2 style={{ fontSize: "13px !important", fontWeight: "600", color: "rgba(255,255,255,0.9)" }}>
          Subsidiaries by Jurisdiction
        </h2>
        <p style={{ fontSize: "11px !important", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
          {totalSubsidiaries} subsidiaries across {data.length} jurisdictions
        </p>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 8px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {sortedData.map((item, index) => (
            <JurisdictionRow
              key={item.jurisdiction}
              item={item}
              barWidth={getBarWidth(item.count)}
              colorIndex={index}
              onJurisdictionClick={onJurisdictionClick}
              onSubsidiaryClick={onSubsidiaryClick}
            />
          ))}
        </div>
      </div>

      {/* Scale legend */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "9px !important",
          color: "rgba(255,255,255,0.35)",
        }}
      >
        <span>Scale: sqrt (small values visible)</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "2px",
              background: "rgba(99, 102, 241, 0.6)",
            }}
          />
          <span>Count</span>
        </div>
      </div>
    </div>
  );
}

function JurisdictionRow({
  item,
  barWidth,
  colorIndex,
  onJurisdictionClick,
  onSubsidiaryClick,
}: {
  item: JurisdictionData;
  barWidth: number;
  colorIndex: number;
  onJurisdictionClick?: (jurisdiction: string) => void;
  onSubsidiaryClick?: (subsidiaryId: string) => void;
}) {
  // Color palette
  const colors = [
    "rgba(99, 102, 241, 0.7)",   // Indigo
    "rgba(34, 197, 94, 0.7)",    // Green
    "rgba(249, 115, 22, 0.7)",   // Orange
    "rgba(236, 72, 153, 0.7)",   // Pink
    "rgba(14, 165, 233, 0.7)",   // Sky
    "rgba(168, 85, 247, 0.7)",   // Purple
    "rgba(234, 179, 8, 0.7)",    // Yellow
    "rgba(239, 68, 68, 0.7)",    // Red
  ];
  const color = colors[colorIndex % colors.length];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "8px 12px",
        borderRadius: "6px",
        background: "rgba(255,255,255,0.02)",
        cursor: onJurisdictionClick ? "pointer" : "default",
        transition: "background 0.15s ease",
      }}
      onClick={() => onJurisdictionClick?.(item.jurisdiction)}
      onMouseEnter={(e) => {
        if (onJurisdictionClick) {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
      }}
    >
      {/* Jurisdiction name and count */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            fontSize: "11px !important",
            fontWeight: "500",
            color: "rgba(255,255,255,0.8)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.jurisdiction || "Unknown"}
        </span>
        <span
          style={{
            fontSize: "10px !important",
            fontWeight: "600",
            color: "rgba(255,255,255,0.6)",
            fontFamily: "monospace",
          }}
        >
          {item.count}
        </span>
      </div>

      {/* Bar */}
      <div
        style={{
          height: "6px",
          borderRadius: "3px",
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${barWidth}%`,
            borderRadius: "3px",
            background: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Subsidiary list (collapsed by default, show first few) */}
      {item.subsidiaries.length > 0 && item.subsidiaries.length <= 5 && (
        <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {item.subsidiaries.map((sub) => (
            <span
              key={sub.id}
              style={{
                fontSize: "9px !important",
                color: "rgba(255,255,255,0.45)",
                padding: "2px 6px",
                borderRadius: "3px",
                background: "rgba(255,255,255,0.03)",
                cursor: onSubsidiaryClick ? "pointer" : "default",
                maxWidth: "150px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSubsidiaryClick?.(sub.id);
              }}
              onMouseEnter={(e) => {
                if (onSubsidiaryClick) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
            >
              {sub.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
