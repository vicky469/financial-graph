import { useState } from "react";
import { ChevronRight, ChevronDown, Building2 } from "lucide-react";

interface SubsidiaryNode {
  id: string;
  name: string;
  ownership_percent: number | null;
  children: SubsidiaryNode[];
}

interface SubsidiaryTreeProps {
  subsidiaries: SubsidiaryNode[];
  onSelectNode?: (id: string) => void;
}

export function SubsidiaryTree({ subsidiaries, onSelectNode }: SubsidiaryTreeProps) {
  if (subsidiaries.length === 0) {
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
          No subsidiaries
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {subsidiaries.map((sub) => (
        <TreeNode key={sub.id} node={sub} level={0} onSelectNode={onSelectNode} />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  level,
  onSelectNode,
}: {
  node: SubsidiaryNode;
  level: number;
  onSelectNode?: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          paddingLeft: `${8 + level * 16}px`,
          borderRadius: "4px",
          transition: "background 0.15s ease",
          cursor: hasChildren || onSelectNode ? "pointer" : "default",
        }}
        onClick={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded);
          }
          if (onSelectNode) {
            onSelectNode(node.id);
          }
        }}
        onMouseEnter={(e) => {
          if (hasChildren || onSelectNode) {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          }
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
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </div>
        ) : (
          <div style={{ width: "14px" }} />
        )}

        {/* Node Indicator */}
        <div
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            backgroundColor: hasChildren ? "#60a5fa" : "rgba(255,255,255,0.3)",
            flexShrink: 0,
          }}
        />

        {/* Name */}
        <span
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.75)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "Arial, sans-serif",
            fontWeight: "400",
            lineHeight: "1.3",
          }}
        >
          {node.name}
        </span>

        {/* Ownership Percentage */}
        {node.ownership_percent !== null && (
          <span
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "Arial, sans-serif",
              fontWeight: "400",
              flexShrink: 0,
            }}
          >
            {node.ownership_percent}%
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} onSelectNode={onSelectNode} />
          ))}
        </div>
      )}
    </div>
  );
}
