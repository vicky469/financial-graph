import { useState, useMemo } from "react";
import FinancialGraph from "./components/FinancialGraph";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { useCompanyGraph } from "./db/queries";

function App() {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null); // Selected from sidebar
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null); // Selected from graph
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const { nodes, edges, isLoading } = useCompanyGraph(selectedNodeId);

  // Find the selected graph node for DetailPanel
  const selectedGraphNode = useMemo(
    () => nodes.find((n) => n.id === selectedGraphNodeId) ?? null,
    [nodes, selectedGraphNodeId]
  );

  // Determine if selected node is public/subsidiary for DetailPanel
  const isPublic = selectedGraphNode?.cik ? true : false;
  const isSubsidiary = selectedGraphNode?.id !== selectedNodeId;

  return (
    <div className="flex flex-col h-screen w-screen max-w-screen bg-background text-foreground overflow-hidden font-sans p-3">
      <Header />

      {/* Horizontal divider under header */}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

      <div className="flex-1 flex overflow-hidden relative max-w-full">
        <Sidebar onSelectNode={setSelectedNodeId} selectedNodeId={selectedNodeId} />

        <main className="flex-1 min-w-0 relative bg-background flex flex-col overflow-hidden">
          {!selectedNodeId ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 gap-3">
              <div className="w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium mb-1">Search and select a company</p>
                <p className="text-xs text-muted-foreground/50">
                  Use the search box to find companies
                </p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">
              Loading Graph Data...
            </div>
          ) : (
            <FinancialGraph
              focusedNodeId={focusedNodeId}
              selectedNodeId={selectedNodeId}
              selectedGraphNodeId={selectedGraphNodeId}
              selectedEdgeId={selectedEdgeId}
              nodes={nodes}
              edges={edges}
              onSelectGraphNode={setSelectedGraphNodeId}
              onSelectEdge={setSelectedEdgeId}
              onClearFocus={() => setFocusedNodeId(null)}
              showNodes={true}
              showBrands={true}
            />
          )}
        </main>

        {/* Right Detail Panel */}
        {selectedGraphNode && (
          <DetailPanel
            node={selectedGraphNode}
            onClose={() => setSelectedGraphNodeId(null)}
            isPublic={isPublic}
            isSubsidiary={isSubsidiary}
          />
        )}
      </div>
    </div>
  );
}

export default App;
