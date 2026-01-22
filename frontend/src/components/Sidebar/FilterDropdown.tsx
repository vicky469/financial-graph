import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

interface FilterDropdownProps {
  label: string;
  options: readonly string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function FilterDropdown({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = "Select...",
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const displayText = selectedValues.length > 0
    ? `${label} (${selectedValues.length})`
    : label;

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          padding: "6px 10px",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: selectedValues.length > 0 ? "rgba(99, 102, 241, 0.15)" : "rgba(255,255,255,0.03)",
          color: selectedValues.length > 0 ? "rgba(99, 102, 241, 0.9)" : "rgba(255,255,255,0.6)",
          fontSize: "12px",
          fontWeight: "500",
          cursor: "pointer",
          transition: "all 0.15s ease",
          width: "100%",
        }}
        onMouseEnter={(e) => {
          if (selectedValues.length === 0) {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "rgba(255,255,255,0.8)";
          }
        }}
        onMouseLeave={(e) => {
          if (selectedValues.length === 0) {
            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
          }
        }}
      >
        <span>{displayText}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {selectedValues.length > 0 && (
            <X
              size={12}
              onClick={handleClearAll}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.7";
              }}
            />
          )}
          <ChevronDown
            size={12}
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: "300px",
            overflowY: "auto",
            background: "rgba(20, 20, 20, 0.98)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 1000,
            padding: "4px",
            scrollbarWidth: "thin",
          }}
        >
          {options.length === 0 ? (
            <div
              style={{
                padding: "8px 12px",
                fontSize: "12px",
                color: "rgba(255,255,255,0.4)",
                textAlign: "center",
              }}
            >
              No options available
            </div>
          ) : (
            options.map((option) => {
              const isSelected = selectedValues.includes(option);
              return (
                <label
                  key={option}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.9)",
                    background: isSelected ? "rgba(99, 102, 241, 0.15)" : "transparent",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(option)}
                    style={{
                      width: "14px",
                      height: "14px",
                      cursor: "pointer",
                      accentColor: "#6366f1",
                    }}
                  />
                  <span style={{ flex: 1, fontSize: "12px" }}>{option}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
