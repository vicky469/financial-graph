import { useCallback } from "react";
import { useEditHistory, undoEdit, clearHistory } from "../db";
import type { EditHistoryEntry } from "../types";

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const actionLabels: Record<EditHistoryEntry["action"], string> = {
  create_event: "Created event",
  update_event: "Updated event",
  delete_event: "Deleted event",
  create_entity: "Created entity",
  update_entity: "Updated entity",
  delete_entity: "Deleted entity",
  create_edge: "Connected",
  update_edge: "Updated connection",
  delete_edge: "Removed connection",
  bulk_import: "Imported Sample Data",
};

const actionIcons: Record<EditHistoryEntry["action"], string> = {
  create_event: "➕",
  update_event: "✏️",
  delete_event: "🗑️",
  create_entity: "🏢",
  update_entity: "📝",
  delete_entity: "🗑️",
  create_edge: "🔗",
  update_edge: "🔧",
  delete_edge: "✂️",
  bulk_import: "📚",
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const EditHistory = ({ isOpen, onClose }: Props) => {
  const { history, isLoading } = useEditHistory(100); // Increased limit for better visibility

  const handleUndo = useCallback(async (entry: EditHistoryEntry) => {
    await undoEdit(entry);
  }, []);

  const handleClear = useCallback(async () => {
    if (history.length === 0) return;
    await clearHistory(history.map((h) => h.id));
  }, [history]);

  if (!isOpen) return null;

  return (
    <div className="history-panel">
      <header className="history-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2>📜 Edit History</h2>
          {history.length > 0 && (
            <button
              onClick={handleClear}
              className="btn-text"
              style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
            >
              Clear All
            </button>
          )}
        </div>
        <button onClick={onClose} className="close-btn">
          ✕
        </button>
      </header>

      <div className="history-content">
        {isLoading ? (
          <p className="history-loading">Loading...</p>
        ) : history.length === 0 ? (
          <p className="history-empty">No edits yet</p>
        ) : (
          <ul className="history-list">
            {history.map((entry) => (
              <li key={entry.id} className="history-item">
                <div className="history-icon">{actionIcons[entry.action]}</div>
                <div className="history-info">
                  <span className="history-action">
                    {actionLabels[entry.action]}
                  </span>
                  <span className="history-meta">
                    {entry.userName} · {formatTime(entry.timestamp)}
                  </span>
                </div>
                <button
                  className="undo-btn"
                  onClick={() => handleUndo(entry)}
                  title="Undo this action"
                >
                  ↩️
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default EditHistory;
