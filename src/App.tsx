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
  const [showEntities, setShowEntities] = useState(true);
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
  const handleFocusEntity = useCallback(
    (id: string) => send({ type: "FOCUS_ENTITY", entityId: id }),
    [send]
  );
  const handleClear = useCallback(() => send({ type: "CLEAR_FOCUS" }), [send]);

  const handleSelectEntity = useCallback(
    (id: string | null) => send({ type: "SELECT_ENTITY", entityId: id }),
    [send]
  );

  return (
    <div className="app">
      <Sidebar
        context={ctx}
        onFocusTrigger={handleFocus}
        onFocusEntity={handleFocusEntity}
        onSelectEvent={handleSelect}
        onSelectEntity={handleSelectEntity}
        onSelectEdge={(id) => send({ type: "SELECT_EDGE", edgeId: id })}
        showEntities={showEntities}
        onToggleEntities={() => setShowEntities(!showEntities)}
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
          onSelectEdge={(id) => send({ type: "SELECT_EDGE", edgeId: id })}
          onSelectEntity={handleSelectEntity}
          onFocusTrigger={handleFocus}
          onFocusEntity={handleFocusEntity}
          onClearFocus={handleClear}
          showEntities={showEntities}
          showTriggersOnGraph={showTriggersOnGraph}
          showNonTriggersOnGraph={showNonTriggersOnGraph}
        />
      </main>
    </div>
  );
}

export default App;
