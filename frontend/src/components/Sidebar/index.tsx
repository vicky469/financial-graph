import { useMemo, useState, useRef, useEffect } from "react";
import { CompanyList } from "./CompanyList";
import { Company } from "./Company";
import { useCompanyGraph } from "../../db/queries";

interface SidebarProps {
  onSelectNode: (id: string | null) => void;
  selectedNodeId: string | null;
}

export function Sidebar({ onSelectNode, selectedNodeId }: SidebarProps) {
  const MIN_WIDTH = 208;
  const MAX_WIDTH = 350;
  const DEFAULT_LIST_WIDTH = 208;
  const DEFAULT_COMPANY_WIDTH = 350;

  const [width, setWidth] = useState(DEFAULT_LIST_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { nodes } = useCompanyGraph(selectedNodeId);
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-resize when switching between list and company view
  useEffect(() => {
    if (selectedNode) {
      if (width < DEFAULT_COMPANY_WIDTH && !isCollapsed) {
        setWidth(DEFAULT_COMPANY_WIDTH);
      }
    } else {
      // Reset collapse state when going back to list
      setIsCollapsed(false);
      if (width > DEFAULT_LIST_WIDTH) {
        setWidth(DEFAULT_LIST_WIDTH);
      }
    }
  }, [selectedNode, isCollapsed]); // Remove width from dependency to avoid loop

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

    const handleMouseUp = () => {
      setIsResizing(false);
    };

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

  const sidebarStyle = {
    width: `${currentWidth}px`,
    minWidth: `${currentWidth}px`,
    maxWidth: `${currentWidth}px`,
    transition: isResizing ? "none" : "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
  };

  return (
    <aside
      ref={sidebarRef}
      className="border-r border-border/50 bg-card flex flex-col h-full overflow-hidden shrink-0 relative group/sidebar"
      style={sidebarStyle}
    >
      <div
        className={`flex-1 overflow-hidden ${
          isCollapsed ? "opacity-0 invisible" : "opacity-100 visible"
        } transition-opacity duration-200`}
      >
        {selectedNode ? (
          <Company node={selectedNode} onBack={() => onSelectNode(null)} />
        ) : (
          <CompanyList onSelectNode={onSelectNode} />
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
          className="absolute top-1/2 -translate-y-1/2 -right-3 z-50 w-6 h-6 bg-border rounded-full flex items-center justify-center border border-border/50 shadow-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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
              stroke="currentColor"
              strokeWidth="2"
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
