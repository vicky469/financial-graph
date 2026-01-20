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
    <header className="flex items-center justify-between shrink-0 mobile-header border-b border-border/30">
      {/* Left side - Logo and App Name */}
      <div className="flex items-center gap-3">
        <div
          className="rounded-full bg-[#2b2b2f] flex items-center justify-center overflow-hidden shrink-0"
          style={{ width: HEADER_ICON_SIZE, height: HEADER_ICON_SIZE }}
        >
          <svg
            width={HEADER_ICON_SIZE - 4}
            height={HEADER_ICON_SIZE - 4}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g stroke="#888" strokeWidth="5" strokeLinecap="round">
              <line x1="50" y1="50" x2="75" y2="28" />
              <line x1="75" y1="28" x2="85" y2="42" />
              <line x1="50" y1="50" x2="28" y2="32" />
              <line x1="28" y1="32" x2="18" y2="52" />
              <line x1="50" y1="50" x2="70" y2="70" />
              <line x1="50" y1="50" x2="30" y2="70" />
            </g>
            <circle cx="50" cy="50" r="10" fill="#2b2b2f" stroke="#aaa" strokeWidth="5" />
            <circle cx="75" cy="28" r="6" fill="#2b2b2f" stroke="#888" strokeWidth="4" />
            <circle cx="85" cy="42" r="4" fill="#2b2b2f" stroke="#888" strokeWidth="4" />
            <circle cx="28" cy="32" r="6" fill="#2b2b2f" stroke="#888" strokeWidth="4" />
            <circle cx="18" cy="52" r="4" fill="#2b2b2f" stroke="#888" strokeWidth="4" />
            <circle cx="70" cy="70" r="5" fill="#2b2b2f" stroke="#888" strokeWidth="4" />
            <circle cx="30" cy="70" r="5" fill="#2b2b2f" stroke="#888" strokeWidth="4" />
          </svg>
        </div>
        <span className="text-sm font-medium text-foreground/80 leading-none" style={{ marginLeft: "10px" }}>
          Financial Graph
        </span>
      </div>

      {/* Right side - User Menu */}
      {user && (
        <div className="relative shrink-0">
          <button
            ref={buttonRef}
            onClick={toggleMenu}
            className={`rounded-full transition-colors flex items-center justify-center ${
              showUserMenu ? "bg-accent/50 ring-1 ring-accent/30" : "hover:bg-accent/30"
            }`}
            style={{ width: HEADER_ICON_SIZE, height: HEADER_ICON_SIZE }}
          >
            {user.imageURL ? (
              <img
                src={user.imageURL}
                alt="Profile"
                className="rounded-full object-cover"
                style={{ width: HEADER_ICON_SIZE, height: HEADER_ICON_SIZE }}
              />
            ) : (
              <svg
                width={HEADER_ICON_SIZE - 10}
                height={HEADER_ICON_SIZE - 10}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-foreground/60"
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
                  background: "rgba(30, 30, 35, 0.98)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "6px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  zIndex: 9999,
                  minWidth: "90px",
                }}
              >
                <button
                  onClick={handleLogout}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.8)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <svg
                    width="12"
                    height="12"
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