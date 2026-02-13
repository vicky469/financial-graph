import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Building2, Search } from "lucide-react";
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
  selectedNodeId?: string | null;
  onNodeClick?: (nodeId: string) => void;
}

export function HierarchicalTree({ hierarchy, selectedNodeId, onNodeClick }: HierarchicalTreeProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter hierarchy based on search query
  const filteredHierarchy = useMemo(() => {
    if (!searchQuery.trim()) return hierarchy;
    
    const query = searchQuery.toLowerCase();
    return hierarchy.filter((node) => {
      // Always include root company
      if (node.level === 0) return true;
      
      // Filter subsidiaries by name or jurisdiction
      return (
        node.name.toLowerCase().includes(query) ||
        (node.jurisdiction && node.jurisdiction.toLowerCase().includes(query))
      );
    });
  }, [hierarchy, searchQuery]);

  // Count of subsidiaries (excluding root)
  const subsidiaryCount = hierarchy.filter(node => node.level > 0).length;
  const filteredSubsidiaryCount = filteredHierarchy.filter(node => node.level > 0).length;

  // Initialize with all nodes collapsed by default
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

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
    const node = filteredHierarchy[nodeIndex];
    if (node.level === 0) return true; // Root is always visible

    // When searching, show all matching subsidiaries directly under root
    if (searchQuery.trim()) {
      return true; // Show all filtered results
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
          // When searching, don't indent subsidiaries as much
          const indentWidth = searchQuery.trim() ? (node.level === 0 ? 0 : 4) : node.level * 8;

          return (
            <HierarchyNodeItem
              key={node.id}
              node={node}
              indentWidth={indentWidth}
              isExpanded={isExpanded}
              isSelected={selectedNodeId === node.id}
              onToggle={() => toggleNode(node.id)}
              onClick={() => onNodeClick?.(node.id)}
              isSearching={!!searchQuery.trim()}
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
  isSearching,
}: {
  node: HierarchyNode;
  indentWidth: number;
  isExpanded: boolean;
  isSelected?: boolean;
  onToggle: () => void;
  onClick: () => void;
  isSearching?: boolean;
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
        paddingLeft: `${4 + indentWidth}px`,
        borderRadius: "4px",
        transition: "background 0.15s ease",
        cursor: "pointer",
        background: isSelected ? "rgba(99, 102, 241, 0.15)" : "transparent",
        border: isSelected ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
      }}
      onClick={(e) => {
        // If node has children and not searching, toggle expansion
        if (hasChildren && !isSearching) {
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
      {hasChildren && !isSearching ? (
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
