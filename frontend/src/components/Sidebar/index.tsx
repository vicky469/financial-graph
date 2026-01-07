import { useMemo } from "react";
import { CompanyList } from "./CompanyList";
import { CompanyDetail } from "./CompanyDetail";
import { useCompanyGraph } from "../../db/queries";

interface SidebarProps {
  onSelectNode: (id: string | null) => void;
  selectedNodeId: string | null;
}

export function Sidebar({ onSelectNode, selectedNodeId }: SidebarProps) {
  const { nodes } = useCompanyGraph(selectedNodeId);
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const sidebarStyle = {
    width: "208px",
    minWidth: "208px",
    maxWidth: "208px",
  };

  return (
    <aside
      className="border-r border-border/50 bg-card flex flex-col h-full overflow-hidden shrink-0"
      style={sidebarStyle}
    >
      {selectedNode ? (
        <CompanyDetail node={selectedNode} onBack={() => onSelectNode(null)} />
      ) : (
        <CompanyList onSelectNode={onSelectNode} />
      )}
    </aside>
  );
}
