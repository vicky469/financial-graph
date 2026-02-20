import { useState, useMemo, useEffect } from "react";
import { ChevronRight, ChevronDown, Building2, Search } from "lucide-react";
import { getJurisdictionColor } from "../../utils/jurisdictionColors";
import { hasFeature } from "../../config/featureFlags";

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
  selectedNodeId?: string | null;
  onNodeClick?: (nodeId: string) => void;
}

export function HierarchicalTree({ hierarchy, selectedNodeId, onNodeClick }: HierarchicalTreeProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const nestingEnabled = hasFeature("structureNesting");

  const subsidiariesOnly = useMemo(() => {
    // Always exclude root node (level 0) since it's shown in the header
    return hierarchy.filter((node) => node.level > 0);
  }, [hierarchy]);

  // Filter subsidiaries based on search query
  const filteredHierarchy = useMemo(() => {
    if (!searchQuery.trim()) return subsidiariesOnly;

    const query = searchQuery.toLowerCase();
    return subsidiariesOnly.filter((node) => {
      // Filter subsidiaries by name or jurisdiction
      return (
        node.name.toLowerCase().includes(query) ||
        (node.jurisdiction && node.jurisdiction.toLowerCase().includes(query))
      );
    });
  }, [subsidiariesOnly, searchQuery]);

  const subsidiaryCount = subsidiariesOnly.length;
  const filteredSubsidiaryCount = filteredHierarchy.length;

  // Default to expanded parents so subsidiaries are visible on first load in nested mode.
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!nestingEnabled || hierarchy.length === 0) return;

    const parentNodeIds = hierarchy
      .filter((node) => node.hasChildren)
      .map((node) => node.id);

    setExpandedNodes(new Set(parentNodeIds));
  }, [hierarchy, nestingEnabled]);

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
    if (!nestingEnabled) return true;

    const node = filteredHierarchy[nodeIndex];
    
    // Level 1 nodes (direct children of root) are always visible
    if (node.level === 1) return true;

    // When searching, show all matching subsidiaries
    if (searchQuery.trim()) {
      return true;
    }

    // Find parent by looking backwards for the first node at level - 1
    for (let i = nodeIndex - 1; i >= 0; i--) {
      const parentNode = filteredHierarchy[i];
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
      {/* Search Input */}
      {subsidiaryCount > 10 && ( // Only show search if there are more than 10 subsidiaries
        <div style={{ padding: "0 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search
              size={12}
              style={{
                position: "absolute",
                left: "12px",
                color: "rgba(255,255,255,0.3)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              name="subsidiary-search"
              placeholder="Search subsidiaries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "6px",
                padding: "8px 12px 8px 32px",
                fontSize: "11px",
                color: "rgba(255,255,255,0.9)",
                outline: "none",
                transition: "all 0.15s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.4)";
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
            />
          </div>
          {/* Search results count */}
          {searchQuery.trim() && (
            <div
              style={{
                fontSize: "10px",
                color: "rgba(255,255,255,0.4)",
                marginTop: "6px",
                textAlign: "center",
              }}
            >
              {filteredSubsidiaryCount} of {subsidiaryCount} subsidiaries
            </div>
          )}
        </div>
      )}

      {/* Hierarchy List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filteredHierarchy.map((node, index) => {
          // Skip rendering if parent is collapsed (unless searching)
          if (!isNodeVisible(index)) return null;

          const isExpanded = expandedNodes.has(node.id);
          const isSearching = !!searchQuery.trim();
          const showNestingControls = nestingEnabled && !isSearching;
          // In flat mode, keep all rows at one level.
          const adjustedLevel = node.level - 1; // Subtract 1 since root is hidden
          const indentWidth = showNestingControls ? adjustedLevel * 8 : 4;

          return (
            <HierarchyNodeItem
              key={node.id}
              node={node}
              indentWidth={indentWidth}
              isExpanded={isExpanded}
              isSelected={selectedNodeId === node.id}
              onToggle={() => toggleNode(node.id)}
              onClick={() => onNodeClick?.(node.id)}
              showNestingControls={showNestingControls}
            />
          );
        })}
        {/* No results message */}
        {searchQuery.trim() && filteredSubsidiaryCount === 0 && (
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
            <Search size={20} style={{ color: "rgba(255,255,255,0.15)" }} />
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
              No subsidiaries found
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function HierarchyNodeItem({
  node,
  indentWidth,
  isExpanded,
  isSelected,
  onToggle,
  onClick,
  showNestingControls,
}: {
  node: HierarchyNode;
  indentWidth: number;
  isExpanded: boolean;
  isSelected?: boolean;
  onToggle: () => void;
  onClick: () => void;
  showNestingControls: boolean;
}) {
  const hasChildren = node.hasChildren;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 8px",
        paddingLeft: `${4 + indentWidth}px`,
        borderRadius: "4px",
        transition: "background 0.15s ease",
        cursor: "pointer",
        background: isSelected ? "rgba(99, 102, 241, 0.15)" : "transparent",
        border: isSelected ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
      }}
      onClick={() => {
        // In nested mode, clicking a parent toggles expansion.
        if (hasChildren && showNestingControls) {
          onToggle();
        }
        // Always call onClick for selection/detail view
        onClick();
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {/* Expand/Collapse Icon */}
      {hasChildren && showNestingControls ? (
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
      {(node.jurisdiction && node.jurisdiction !== "Unknown") && (
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: getJurisdictionColor(node.jurisdiction),
            flexShrink: 0,
            marginRight: "6px",
            boxShadow: `0 0 3px ${getJurisdictionColor(node.jurisdiction)}40`,
          }}
        />
      )}

      {/* Company Name */}
      <span
        style={{
          fontSize: "12px",
          fontWeight: "400",
          color: "rgba(255,255,255,0.7)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {node.name}
      </span>

      {/* Jurisdiction badge */}
      {node.jurisdiction && (
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
