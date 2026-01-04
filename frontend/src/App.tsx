import { useCallback, useEffect, useState } from "react";
import { useMachine } from "@xstate/react";
import FinancialGraph from "./components/FinancialGraph";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import { DetailPanel } from "./components/DetailPanel";
import { appMachine } from "./machines/appMachine";
import { updateUserSelection, setCurrentUser } from "./db";
import { useGraph } from "./db/queries";
import "./App.css";

function App() {
  const [state, send] = useMachine(appMachine);
  const [editMode, setEditMode] = useState(true);
  const [showNodes, setShowNodes] = useState(true);
  const [showBrands, setShowBrands] = useState(true);
  const ctx = state.context;
  const { nodes, edges } = useGraph();

  // Find the node for the detail panel (read-only view on right)
  const viewingNode = ctx.viewingNodeId
    ? nodes.find((n) => n.id === ctx.viewingNodeId) || null
    : null;

  // Determine viewing node properties for badges
  const isPublic = !!viewingNode?.cik;
  const isSubsidiary =
    !!viewingNode &&
    edges.some(
      (e) =>
        e.targetId === viewingNode.id && nodes.find((n) => n.id === e.sourceId)?.type === "Company"
    );

  // Set current user for edit tracking
  useEffect(() => {
    setCurrentUser(ctx.userId, ctx.userName);
  }, [ctx.userId, ctx.userName]);

  // Sync selection to InstantDB for collaboration
  useEffect(() => {
    updateUserSelection(ctx.userId, ctx.userName, ctx.selectedNodeId, ctx.userColor);
  }, [ctx.userId, ctx.userName, ctx.selectedNodeId, ctx.userColor]);

  const handleFocusNode = useCallback(
    (id: string) => send({ type: "FOCUS_NODE", nodeId: id }),
    [send]
  );
  const handleClear = useCallback(() => send({ type: "CLEAR_FOCUS" }), [send]);

  const handleViewNode = useCallback(
    (id: string) => send({ type: "VIEW_NODE", nodeId: id }),
    [send]
  );

  const handleSelectNode = useCallback(
    (id: string | null) => send({ type: "SELECT_NODE", nodeId: id }),
    [send]
  );

  return (
    <div className="app">
      <Header context={ctx} isEditMode={editMode} onToggleEditMode={() => setEditMode(!editMode)} />
      <div className="app-body">
        <Sidebar
          context={ctx}
          onFocusNode={handleFocusNode}
          onSelectNode={handleSelectNode}
          onSelectEdge={(id: string | null) => send({ type: "SELECT_EDGE", edgeId: id })}
          showNodes={showNodes}
          onToggleNodes={() => setShowNodes(!showNodes)}
          showBrands={showBrands}
          onToggleBrands={() => setShowBrands(!showBrands)}
        />
        <main className="main-content">
          <FinancialGraph
            context={ctx}
            onSelectEdge={(id: string | null) => send({ type: "SELECT_EDGE", edgeId: id })}
            onSelectNode={handleSelectNode}
            onFocusNode={handleFocusNode}
            onViewNode={handleViewNode}
            onClearFocus={handleClear}
            showNodes={showNodes}
            showBrands={showBrands}
          />
        </main>
        {/* Right Detail Panel - read-only view when viewing a node */}
        {viewingNode && (
          <DetailPanel
            node={viewingNode}
            onClose={() => send({ type: "CLEAR_VIEW" })}
            isPublic={isPublic}
            isSubsidiary={isSubsidiary}
          />
        )}
      </div>
    </div>
  );
}

export default App;
