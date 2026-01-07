import { Monitor } from "lucide-react";

export function Header() {
  return (
    <header className="h-12 border-b border-border/50 bg-card flex items-center justify-between px-4 z-20 relative">
      <div className="flex items-center font-semibold text-sm select-none">
        <div className="w-8 h-8 rounded-full bg-[#2b2b2f] flex items-center justify-center overflow-hidden">
          <svg width="28" height="28" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            {/* Connection lines */}
            <g stroke="#ffffff" strokeWidth="3" strokeLinecap="round">
              <line x1="50" y1="50" x2="75" y2="25" />
              <line x1="75" y1="25" x2="85" y2="40" />
              <line x1="50" y1="50" x2="25" y2="30" />
              <line x1="25" y1="30" x2="20" y2="55" />
              <line x1="50" y1="50" x2="70" y2="75" />
              <line x1="50" y1="50" x2="30" y2="75" />
            </g>
            {/* Nodes */}
            <circle cx="50" cy="50" r="10" fill="#2b2b2f" stroke="#ffffff" strokeWidth="3" />
            <circle cx="75" cy="25" r="6" fill="#2b2b2f" stroke="#ffffff" strokeWidth="3" />
            <circle cx="85" cy="40" r="4" fill="#2b2b2f" stroke="#ffffff" strokeWidth="3" />
            <circle cx="25" cy="30" r="6" fill="#2b2b2f" stroke="#ffffff" strokeWidth="3" />
            <circle cx="20" cy="55" r="4" fill="#2b2b2f" stroke="#ffffff" strokeWidth="3" />
            <circle cx="70" cy="75" r="5" fill="#2b2b2f" stroke="#ffffff" strokeWidth="3" />
            <circle cx="30" cy="75" r="5" fill="#2b2b2f" stroke="#ffffff" strokeWidth="3" />
          </svg>
        </div>
        <span className="text-foreground/90" style={{ marginLeft: '4px' }}>Financial Graph</span>
      </div>

      <div className="flex-1" />
    </header>
  );
}
