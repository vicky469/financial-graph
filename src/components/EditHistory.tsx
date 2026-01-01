import { useCallback, useRef } from "react";
import { useEditHistory, undoEdit, clearHistory } from "../db";
import { actionLabels, actionIcons, formatTime, getChangeSummary } from "../utils/history";
import type { EditHistoryEntry } from "../types";
import { useClickOutside } from "../hooks/useClickOutside";
import { EDIT_HISTORY_LIMIT } from "../constants";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

const EditHistory = ({ isOpen, onClose, embedded = false }: Props) => {
  const { history, isLoading } = useEditHistory(EDIT_HISTORY_LIMIT);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleUndo = useCallback(async (entry: EditHistoryEntry) => {
    await undoEdit(entry);
  }, []);

  const handleClear = useCallback(async () => {
    if (history.length === 0) return;
    await clearHistory(history.map((h) => h.id));
  }, [history]);

  // Close panel when clicking outside
  // Close panel when clicking outside (only if not embedded, as parent handles it)
  useClickOutside(panelRef, onClose, isOpen && !embedded);

  if (!isOpen) return null;

  return (
    <div className={embedded ? "history-list-embedded" : "history-panel"} ref={panelRef}>
      <header className="history-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2>Edit History</h2>
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
            {history.map((entry) => {
              const changes = getChangeSummary(entry);
              return (
                <li key={entry.id} className="history-item">
                  <div className="history-icon">{actionIcons[entry.action]}</div>
                  <div className="history-info">
                    <span className="history-action">{actionLabels[entry.action]}</span>
                    {changes.length > 0 && (
                      <div className="history-changes">
                        {changes.map((change, idx) => (
                          <div key={idx} className="history-change">
                            <span className="change-field">{change.field}:</span>{" "}
                            <span className="change-from">{change.from}</span>
                            <span className="change-arrow"> → </span>
                            <span className="change-to">{change.to}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default EditHistory;
