import React from "react";

interface HeaderProps {
  onSearchFiling?: (companyId: string) => void;
}

export function Header({ onSearchFiling }: HeaderProps) {
  return (
    <header className="h-11 flex items-center px-4 shrink-0">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-[#2b2b2f] flex items-center justify-center overflow-hidden">
          <svg width="18" height="18" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
        <span style={{ marginLeft: "5px" }} className="text-sm font-medium text-foreground/80">Corperate Structure</span>
      </div>
    </header>
  );
}
