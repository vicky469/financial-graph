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
  const MAX_WIDTH = 600;
  const DEFAULT_LIST_WIDTH = 208;
  const DEFAULT_COMPANY_WIDTH = 400;

  const [width, setWidth] = useState(DEFAULT_LIST_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { nodes } = useCompanyGraph(selectedNodeId);
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  // Auto-resize when switching between list and company view
  useEffect(() => {
    if (selectedNode && width < DEFAULT_COMPANY_WIDTH) {
      setWidth(DEFAULT_COMPANY_WIDTH);
    } else if (!selectedNode && width > DEFAULT_LIST_WIDTH) {
      setWidth(DEFAULT_LIST_WIDTH);
    }
  }, [selectedNode, width]);

  const handleMouseDown = (e: React.MouseEvent) => {
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

  const sidebarStyle = {
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
  };

  return (
    <aside
      ref={sidebarRef}
      className="border-r border-border/50 bg-card flex flex-col h-full overflow-hidden shrink-0 relative"
      style={sidebarStyle}
    >
      {selectedNode ? (
        <Company node={selectedNode} onBack={() => onSelectNode(null)} />
      ) : (
        <CompanyList onSelectNode={onSelectNode} />
      )}

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors group"
        style={{ zIndex: 10 }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-primary/30" />
      </div>
    </aside>
  );
}
