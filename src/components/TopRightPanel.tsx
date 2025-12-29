import { useState, useRef, useEffect } from "react";
import EditHistory from "./EditHistory";
import type { AppContext } from "../types";

interface TopRightPanelProps {
  context: AppContext;
}

const TopRightPanel = ({ context }: TopRightPanelProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <>
      <div className="top-right-panel" ref={menuRef}>
        <button
          className="profile-button"
          onClick={() => setMenuOpen(!menuOpen)}
          title={context.userName}
        >
          <div className="profile-avatar" style={{ backgroundColor: context.userColor }}>
            {context.userName[0]}
          </div>
          <span className="chevron">{menuOpen ? "▼" : "▼"}</span>
        </button>

        {menuOpen && (
          <div className="profile-menu">
            <div className="profile-header">
              <div className="profile-avatar-large" style={{ backgroundColor: context.userColor }}>
                {context.userName[0]}
              </div>
              <div className="profile-info">
                <div className="profile-label">You</div>
                <div className="profile-name">{context.userName}</div>
              </div>
            </div>
            <div className="profile-actions">
              <button
                className="menu-action"
                onClick={() => {
                  setHistoryOpen(!historyOpen);
                  setMenuOpen(false);
                }}
              >
                📜 Edit History
              </button>
            </div>
          </div>
        )}
      </div>

      <EditHistory isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  );
};

export default TopRightPanel;
