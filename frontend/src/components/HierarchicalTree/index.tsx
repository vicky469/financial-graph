import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Building2 } from "lucide-react";
import { getJurisdictionColor } from "../../utils/jurisdictionColors";

interface HierarchyNode {
  id: string;
  name: string;
  jurisdiction: string;
  level: number;
  ownership_percent?: number | null;
  hasChildren: boolean;
}

interface HierarchicalTreeProps {
  hierarchy: HierarchyNode[];
  onNodeClick?: (nodeId: string) => void;
}

export function HierarchicalTree({ hierarchy, onNodeClick }: HierarchicalTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Track which root company we've initialized for
  const rootId = hierarchy[0]?.id;

  // Auto-expand only the root node when hierarchy data loads or root changes
  useEffect(() => {
    if (hierarchy.length > 0) {
      const initialExpanded = new Set<string>();
      // Only expand the root node (level 0) by default
      hierarchy.forEach((node) => {
        if (node.level === 0 && node.hasChildren) {
          initialExpanded.add(node.id);
        }
      });
      setExpandedNodes(initialExpanded);
    }
  }, [rootId]); // Only re-run when root company changes

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return newExpanded;
    });
  };

  if (hierarchy.length === 0) {
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
          <Building2 size={20} />
        </div>
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
          No hierarchy data
        </span>
      </div>
    );
  }

  // Check if a node should be visible based on parent expanded state
  const isNodeVisible = (nodeIndex: number): boolean => {
    const node = hierarchy[nodeIndex];
    if (node.level === 0) return true; // Root is always visible

    // Find parent by looking backwards for the first node at level - 1
    for (let i = nodeIndex - 1; i >= 0; i--) {
      const parentNode = hierarchy[i];
      if (parentNode.level === node.level - 1) {
        // Found the parent - check if it's expanded
        const parentExpanded = expandedNodes.has(parentNode.id);
        // Recursively check if parent is visible
        return parentExpanded && isNodeVisible(i);
      }
    }
    return false; // No parent found, don't show it
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {hierarchy.map((node, index) => {
        // Skip rendering if parent is collapsed
        if (!isNodeVisible(index)) return null;

        const isExpanded = expandedNodes.has(node.id);
        const indentWidth = node.level * 16;

        return (
          <HierarchyNodeItem
            key={node.id}
            node={node}
            indentWidth={indentWidth}
            isExpanded={isExpanded}
            onToggle={() => toggleNode(node.id)}
            onClick={() => onNodeClick?.(node.id)}
          />
        );
      })}
    </div>
  );
}

function HierarchyNodeItem({
  node,
  indentWidth,
  isExpanded,
  onToggle,
  onClick,
}: {
  node: HierarchyNode;
  indentWidth: number;
  isExpanded: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  const isRoot = node.level === 0;
  const hasChildren = node.hasChildren;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 8px",
        paddingLeft: `${8 + indentWidth}px`,
        borderRadius: "4px",
        transition: "background 0.15s ease",
        cursor: "pointer",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Expand/Collapse Icon */}
      {hasChildren ? (
        <div
          style={{
            width: "14px",
            height: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.5)",
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      ) : (
        <div style={{ width: "14px" }} />
      )}

      {/* Circular Jurisdiction Indicator */}
      {/* Only show dot if company has jurisdiction data, or if it's a subsidiary (non-root) */}
      {(node.jurisdiction && node.jurisdiction !== "Unknown") && (
        <div
          style={{
            width: isRoot ? "8px" : "6px",
            height: isRoot ? "8px" : "6px",
            borderRadius: "50%", // Makes it perfectly round
            backgroundColor: isRoot 
              ? "#60a5fa" // Keep blue for root company (usually incorporated jurisdiction)
              : getJurisdictionColor(node.jurisdiction),
            flexShrink: 0,
            marginRight: "6px",
            // Add a subtle glow effect with the same color
            boxShadow: isRoot 
              ? "0 0 4px rgba(96, 165, 250, 0.4)"
              : `0 0 3px ${getJurisdictionColor(node.jurisdiction)}40`, // Add 40 for 25% opacity
          }}
        />
      )}

      {/* Company Name */}
      <span
        style={{
          fontSize: isRoot ? "13px" : "12px",
          fontWeight: isRoot ? "600" : "400",
          color: isRoot ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.7)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {node.name}
      </span>

      {/* Jurisdiction badge for non-root */}
      {!isRoot && node.jurisdiction && (
        <span
          style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.4)",
            flexShrink: 0,
          }}
        >
          {node.jurisdiction}
        </span>
      )}

      {/* Ownership percentage */}
      {node.ownership_percent !== null && node.ownership_percent !== undefined && (
        <span
          style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "monospace",
            flexShrink: 0,
          }}
        >
          {node.ownership_percent}%
        </span>
      )}
    </div>
  );
}