import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  container?: "fullscreen" | "main-content";
}

export function Modal({ isOpen, onClose, title, children, container = "fullscreen" }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      if (container === "fullscreen") {
        document.body.style.overflow = "hidden";
      }
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      if (container === "fullscreen") {
        document.body.style.overflow = "unset";
      }
    };
  }, [isOpen, onClose, container]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // const sizeClasses = {
  //   sm: "w-72",
  //   md: "w-80", 
  //   lg: "w-96",
  //   xl: "w-[32rem]",
  // };

  const containerClasses = container === "fullscreen" 
    ? "fixed inset-0 z-50" 
    : "absolute inset-0 z-50";

  const backdropStyle = container === "fullscreen"
    ? {
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        width: "100%",
        height: "100%",
      }
    : {
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(2px)",
        width: "100%",
        height: "100%",
      };

  return (
    <div
      className={containerClasses}
      style={{
        ...backdropStyle,
        display: "grid",
        placeItems: "center",
        padding: "16px",
      }}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: "rgba(30, 30, 35, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "12px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
          minWidth: "320px",
          maxWidth: "480px",
          width: "fit-content",
          minHeight: "fit-content",
          overflow: "visible",
        }}
      >
        {/* Header */}
        {title && (
          <div
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
          >
            <h2
              className="text-xs font-medium"
              style={{ color: "rgba(255, 255, 255, 0.8)" }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md transition-colors"
              style={{
                color: "rgba(255, 255, 255, 0.6)",
                backgroundColor: "transparent",
                border: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Content */}
        <div 
          className="p-3" 
          style={{ 
            minHeight: "fit-content",
            overflow: "visible"
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}