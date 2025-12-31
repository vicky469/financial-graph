import { useCallback, useEffect, useState } from "react";
import { useMachine } from "@xstate/react";
import FinancialGraph from "./components/FinancialGraph";
import Sidebar from "./components/Sidebar";
import TopRightPanel from "./components/TopRightPanel";
import { appMachine } from "./machines/appMachine";
import { updateUserSelection, setCurrentUser } from "./db";
import "./App.css";

function App() {
  const [state, send] = useMachine(appMachine);
  const [showNodes, setShowNodes] = useState(true);
  const [showTriggersOnGraph, setShowTriggersOnGraph] = useState(true);
  const [showNonTriggersOnGraph, setShowNonTriggersOnGraph] = useState(true);
  const ctx = state.context;

  // Set current user for edit tracking
  useEffect(() => {
    setCurrentUser(ctx.userId, ctx.userName);
  }, [ctx.userId, ctx.userName]);

  // Sync selection to InstantDB for collaboration
  useEffect(() => {
    updateUserSelection(ctx.userId, ctx.userName, ctx.selectedEventId, ctx.userColor);
  }, [ctx.userId, ctx.userName, ctx.selectedEventId, ctx.userColor]);

  const handleSelect = useCallback(
    (id: string | null) => send({ type: "SELECT_EVENT", eventId: id }),
    [send]
  );
  const handleFocus = useCallback(
    (id: string) => send({ type: "FOCUS_TRIGGER", triggerId: id }),
    [send]
  );
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
      <Sidebar
        context={ctx}
        onFocusTrigger={handleFocus}
        onFocusNode={handleFocusNode}
        onSelectEvent={handleSelect}
        onSelectNode={handleSelectNode}
        onSelectEdge={(id: string | null) => send({ type: "SELECT_EDGE", edgeId: id })}
        showNodes={showNodes}
        onToggleNodes={() => setShowNodes(!showNodes)}
        showTriggersOnGraph={showTriggersOnGraph}
        setShowTriggersOnGraph={setShowTriggersOnGraph}
        showNonTriggersOnGraph={showNonTriggersOnGraph}
        setShowNonTriggersOnGraph={setShowNonTriggersOnGraph}
      />
      <main className="main-content">
        <TopRightPanel context={ctx} />

        <FinancialGraph
          context={ctx}
          onSelectEvent={handleSelect}
          onSelectEdge={(id: string | null) => send({ type: "SELECT_EDGE", edgeId: id })}
          onSelectNode={handleSelectNode}
          onFocusTrigger={handleFocus}
          onFocusNode={handleFocusNode}
          onClearFocus={handleClear}
          showNodes={showNodes}
          showTriggersOnGraph={showTriggersOnGraph}
          showNonTriggersOnGraph={showNonTriggersOnGraph}
        />
      </main>
    </div>
  );
}

export default App;
