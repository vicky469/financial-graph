import { useCallback, useEffect, useState } from "react";
import { useMachine } from "@xstate/react";
import FailureGraph from "./components/FailureGraph";
import Sidebar from "./components/Sidebar";
import EditHistory from "./components/EditHistory";
import { appMachine } from "./machines/appMachine";
import { updateUserSelection, setCurrentUser } from "./db";
import "./App.css";

function App() {
  const [state, send] = useMachine(appMachine);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showActors, setShowActors] = useState(true); // Toggle for entity visibility
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
        onSelectEntity={handleSelectEntity}
        showActors={showActors}
        onToggleActors={() => setShowActors(!showActors)}
      />
      <main className="main-content">
        <FailureGraph
          context={ctx}
          onSelectEvent={handleSelect}
          onSelectEdge={(id) => send({ type: "SELECT_EDGE", edgeId: id })}
          onSelectEntity={handleSelectEntity}
          onFocusTrigger={handleFocus}
          onClearFocus={handleClear}
          showActors={showActors}
        />

        {/* History toggle button */}
        <button
          className="history-toggle"
          onClick={() => setHistoryOpen(!historyOpen)}
          title="Edit History"
        >
          📜
        </button>

        <EditHistory isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      </main>
    </div>
  );
}

export default App;
