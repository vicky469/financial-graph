import { useMemo, useState, useRef, useEffect } from "react";
import { CompanyList } from "./CompanyList";
import { Company } from "./Company";
import { useCompanyGraph } from "../../db/queries";

interface SidebarProps {
  onSelectNode: (id: string | null) => void;
  selectedNodeId: string | null;
  onSubsidiaryClick?: (subsidiaryId: string) => void;
  showSP500Only: boolean;
  onFilterChange: (showSP500Only: boolean) => void;
}

export function Sidebar({ onSelectNode, selectedNodeId, onSubsidiaryClick, showSP500Only, onFilterChange }: SidebarProps) {
  const MIN_WIDTH = 280;
  const MAX_WIDTH = 420;
  const DEFAULT_LIST_WIDTH = MIN_WIDTH;
  const DEFAULT_COMPANY_WIDTH = 420;

  const [width, setWidth] = useState(DEFAULT_LIST_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { nodes } = useCompanyGraph(selectedNodeId);
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (selectedNode) {
      if (width < DEFAULT_COMPANY_WIDTH && !isCollapsed) {
        setWidth(DEFAULT_COMPANY_WIDTH);
      }
    } else {
      setIsCollapsed(false);
      if (width > DEFAULT_LIST_WIDTH) {
        setWidth(DEFAULT_LIST_WIDTH);
      }
    }
  }, [selectedNode, isCollapsed, width]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const currentWidth = isCollapsed ? 12 : width;

  return (
    <aside
      ref={sidebarRef}
      className="border-r border-border/50 bg-card flex flex-col h-full overflow-hidden shrink-0 relative group/sidebar"
      style={{
        width: `${currentWidth}px`,
        minWidth: `${currentWidth}px`,
        maxWidth: `${currentWidth}px`,
        transition: isResizing ? "none" : "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div
        className={`flex-1 overflow-hidden ${
          isCollapsed ? "opacity-0 invisible" : "opacity-100 visible"
        } transition-opacity duration-200`}
      >
        {selectedNode ? (
          <Company 
            node={selectedNode} 
            onBack={() => onSelectNode(null)} 
            onSubsidiaryClick={onSubsidiaryClick}
          />
        ) : (
          <CompanyList 
            onSelectNode={onSelectNode} 
            showSP500Only={showSP500Only}
            onFilterChange={onFilterChange}
          />
        )}
      </div>

      {/* Resize Handle (only active when not collapsed) */}
      {!isCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors group"
          style={{ zIndex: 10 }}
        >
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-primary/30" />
        </div>
      )}

      {/* Collapse Toggle Button - Only show when company component is open (selectedNode) */}
      {selectedNode && (
        <button
          onClick={toggleCollapse}
          style={{
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
            right: "-14px",
            zIndex: 50,
            width: "28px",
            height: "28px",
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: isCollapsed ? "rgba(255,255,255,0.95)" : "rgba(30,30,35,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isCollapsed ? "#ffffff" : "rgba(50,50,60,0.95)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isCollapsed ? "rgba(255,255,255,0.95)" : "rgba(30,30,35,0.95)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
          }}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          )}
        </button>
      )}
    </aside>
  );
}
