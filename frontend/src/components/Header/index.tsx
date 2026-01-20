import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { db, clearSession } from "../../db/client";

// Shared size for logo and profile button
const HEADER_ICON_SIZE = 24; // Balanced size

export function Header() {
  const { user } = db.useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

  // Update menu position when shown
  useEffect(() => {
    if (showUserMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showUserMenu]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showUserMenu]);


  const handleLogout = async () => {
    try {
      clearSession();
      await db.auth.signOut();
      setShowUserMenu(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowUserMenu((prev) => !prev);
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 shrink-0 mobile-header border-b border-border/20 bg-card/50 backdrop-blur-sm">
      {/* Left side - Logo and App Name */}
      <div className="flex items-center gap-4">
        <div
          className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden shrink-0 shadow-lg"
          style={{ width: HEADER_ICON_SIZE + 4, height: HEADER_ICON_SIZE + 4 }}
        >
          <svg
            width={HEADER_ICON_SIZE - 2}
            height={HEADER_ICON_SIZE - 2}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g stroke="white" strokeWidth="5" strokeLinecap="round">
              <line x1="50" y1="50" x2="75" y2="28" />
              <line x1="75" y1="28" x2="85" y2="42" />
              <line x1="50" y1="50" x2="28" y2="32" />
              <line x1="28" y1="32" x2="18" y2="52" />
              <line x1="50" y1="50" x2="70" y2="70" />
              <line x1="50" y1="50" x2="30" y2="70" />
            </g>
            <circle cx="50" cy="50" r="10" fill="white" stroke="white" strokeWidth="2" />
            <circle cx="75" cy="28" r="6" fill="white" stroke="white" strokeWidth="2" />
            <circle cx="85" cy="42" r="4" fill="white" stroke="white" strokeWidth="2" />
            <circle cx="28" cy="32" r="6" fill="white" stroke="white" strokeWidth="2" />
            <circle cx="18" cy="52" r="4" fill="white" stroke="white" strokeWidth="2" />
            <circle cx="70" cy="70" r="5" fill="white" stroke="white" strokeWidth="2" />
            <circle cx="30" cy="70" r="5" fill="white" stroke="white" strokeWidth="2" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-foreground leading-none">
            Financial Graph
          </span>
          <span className="text-xs text-muted-foreground mt-0.5 leading-none">
            Corporate Intelligence
          </span>
        </div>
      </div>

      {/* Right side - User Menu */}
      {user && (
        <div className="relative shrink-0">
          <button
            ref={buttonRef}
            onClick={toggleMenu}
            className={`rounded-xl transition-all duration-200 flex items-center justify-center shadow-sm ${
              showUserMenu 
                ? "bg-accent/60 ring-2 ring-primary/30 scale-95" 
                : "hover:bg-accent/40 hover:scale-105"
            }`}
            style={{ width: HEADER_ICON_SIZE + 8, height: HEADER_ICON_SIZE + 8 }}
          >
            {user.imageURL ? (
              <img
                src={user.imageURL}
                alt="Profile"
                className="rounded-lg object-cover"
                style={{ width: HEADER_ICON_SIZE + 4, height: HEADER_ICON_SIZE + 4 }}
              />
            ) : (
              <svg
                width={HEADER_ICON_SIZE - 6}
                height={HEADER_ICON_SIZE - 6}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-foreground/70"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </button>

          {/* Dropdown via Portal - renders outside overflow:hidden parents */}
          {showUserMenu &&
            createPortal(
              <div
                ref={menuRef}
                style={{
                  position: "fixed",
                  top: menuPosition.top,
                  right: menuPosition.right,
                  background: "rgba(20, 20, 25, 0.95)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "12px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
                  zIndex: 9999,
                  minWidth: "120px",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={handleLogout}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    padding: "12px 16px",
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "rgba(255,255,255,0.9)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.color = "white";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                    e.currentTarget.style.color = "rgba(255,255,255,0.9)";
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>,
              document.body
            )}
        </div>
      )}
    </header>
  );
}
