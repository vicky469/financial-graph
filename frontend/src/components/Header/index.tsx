import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { db } from "../../db/client";

// Shared size for logo and profile button
const HEADER_ICON_SIZE = 24; // Icon/image size (reduced from 32)
const HEADER_BUTTON_SIZE = 36; // Touch target size (reduced from 44)

export function Header() {
  const { companyId } = useParams<{ companyId?: string }>();
  const isDetailPage = !!companyId;
  
  const { user } = db.useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0, bottom: 0 });

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Update menu position when shown
  useEffect(() => {
    if (showUserMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      if (isMobile) {
        // Position menu below the floating button on the left
        setMenuPosition({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right,
          bottom: 0,
        });
      } else {
        setMenuPosition({
          top: rect.bottom + 6,
          right: window.innerWidth - rect.right,
          bottom: 0,
        });
      }
    }
  }, [showUserMenu, isMobile]);

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

  // Floating profile button for mobile
  const FloatingProfileButton = () => (
    <div
      style={{
        position: "fixed",
        ...(isDetailPage ? {
          // Top right on detail pages
          top: "calc(8px + env(safe-area-inset-top, 0px))",
          right: 8,
        } : {
          // Bottom right on main page (higher up to avoid covering menu)
          bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
          right: 16,
        }),
        zIndex: 100,
      }}
    >
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="rounded-full flex items-center justify-center"
        style={{
          width: HEADER_BUTTON_SIZE,
          height: HEADER_BUTTON_SIZE,
          minWidth: HEADER_BUTTON_SIZE,
          minHeight: HEADER_BUTTON_SIZE,
          maxWidth: HEADER_BUTTON_SIZE,
          maxHeight: HEADER_BUTTON_SIZE,
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
          border: "none",
          transform: "none",
          background: showUserMenu ? "rgba(255,255,255,0.15)" : "#1a1a1f",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          outline: "none",
          overflow: "hidden",
        }}
        aria-label="User menu"
      >
        {user?.imageURL ? (
          <img
            src={user.imageURL}
            alt="Profile"
            className="rounded-full object-cover"
            style={{ width: HEADER_ICON_SIZE, height: HEADER_ICON_SIZE }}
          />
        ) : (
          <svg
            width={HEADER_ICON_SIZE - 8}
            height={HEADER_ICON_SIZE - 8}
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

      {/* Menu positioned above the button */}
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
              borderRadius: "10px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              zIndex: 9999,
              minWidth: "120px",
            }}
          >
            <button
              onClick={handleLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "14px 18px",
                fontSize: "14px",
                color: "rgba(255,255,255,0.85)",
                background: "none",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
                minHeight: "48px",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
                borderRadius: "10px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              aria-label="Sign out"
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
  );

  // Mobile: only show floating button on detail pages
  if (isMobile) {
    return user && isDetailPage ? <FloatingProfileButton /> : null;
  }

  // Desktop: show full header
  return (
    <header className="flex items-center justify-between shrink-0 mobile-header border-b border-border/30">
      {/* Left side - Logo and App Name */}
      <div className="flex items-center gap-3">
        <div
          className="rounded-full bg-[#2b2b2f] flex items-center justify-center overflow-hidden shrink-0"
          style={{ 
            width: HEADER_ICON_SIZE, 
            height: HEADER_ICON_SIZE,
            minWidth: HEADER_ICON_SIZE,
            minHeight: HEADER_ICON_SIZE,
          }}
        >
          <svg
            width={HEADER_ICON_SIZE}
            height={HEADER_ICON_SIZE}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Connection lines */}
            <g stroke="#777" strokeWidth="3" strokeLinecap="round">
              <line x1="50" y1="50" x2="78" y2="22" />
              <line x1="78" y1="22" x2="90" y2="40" />
              <line x1="50" y1="50" x2="22" y2="22" />
              <line x1="22" y1="22" x2="10" y2="40" />
              <line x1="50" y1="50" x2="76" y2="76" />
              <line x1="50" y1="50" x2="24" y2="76" />
            </g>
            {/* Nodes */}
            <circle cx="50" cy="50" r="9" fill="#2b2b2f" stroke="#aaa" strokeWidth="3.5" />
            <circle cx="78" cy="22" r="6" fill="#2b2b2f" stroke="#888" strokeWidth="3" />
            <circle cx="90" cy="40" r="4" fill="#2b2b2f" stroke="#888" strokeWidth="2.5" />
            <circle cx="22" cy="22" r="6" fill="#2b2b2f" stroke="#888" strokeWidth="3" />
            <circle cx="10" cy="40" r="4" fill="#2b2b2f" stroke="#888" strokeWidth="2.5" />
            <circle cx="76" cy="76" r="5" fill="#2b2b2f" stroke="#888" strokeWidth="3" />
            <circle cx="24" cy="76" r="5" fill="#2b2b2f" stroke="#888" strokeWidth="3" />
          </svg>
        </div>
        <span
          className="text-[11px] font-medium text-foreground/15 leading-none tracking-[0.2em] uppercase"
          style={{ marginLeft: "10px" }}
        >
          Financial Graph
        </span>
      </div>

      {/* Right side - User Menu */}
      {user && (
        <div className="relative shrink-0" style={{ marginRight: '4px' }}>
          <button
            ref={buttonRef}
            onClick={toggleMenu}
            className={`rounded-full transition-colors flex items-center justify-center ${
              showUserMenu ? "bg-accent/50" : "hover:bg-accent/30"
            }`}
            style={{
              width: HEADER_BUTTON_SIZE,
              height: HEADER_BUTTON_SIZE,
              minWidth: HEADER_BUTTON_SIZE,
              minHeight: HEADER_BUTTON_SIZE,
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
            aria-label="User menu"
          >
            {user.imageURL ? (
              <img
                src={user.imageURL}
                alt="Profile"
                className="rounded-full object-cover"
                style={{ 
                  maxWidth: HEADER_ICON_SIZE, 
                  maxHeight: HEADER_ICON_SIZE,
                  width: 'auto',
                  height: 'auto',
                }}
              />
            ) : (
              <svg
                width={HEADER_ICON_SIZE - 8}
                height={HEADER_ICON_SIZE - 8}
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
                    padding: "12px 16px",
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.8)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    minHeight: "44px",
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  aria-label="Sign out"
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
