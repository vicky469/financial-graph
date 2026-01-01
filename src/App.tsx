import { useCallback, useEffect, useState } from "react";
import { useMachine } from "@xstate/react";
import FinancialGraph from "./components/FinancialGraph";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import { appMachine } from "./machines/appMachine";
import { updateUserSelection, setCurrentUser } from "./db";
import "./App.css";

function App() {
  const [state, send] = useMachine(appMachine);
  const [editMode, setEditMode] = useState(true);
  const [showNodes, setShowNodes] = useState(true);
  const ctx = state.context;

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
        />
        <main className="main-content">
          <FinancialGraph
            context={ctx}
            onSelectEdge={(id: string | null) => send({ type: "SELECT_EDGE", edgeId: id })}
            onSelectNode={handleSelectNode}
            onFocusNode={handleFocusNode}
            onClearFocus={handleClear}
            showNodes={showNodes}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
