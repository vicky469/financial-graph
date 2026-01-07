import { Monitor } from "lucide-react";

export function Header() {
  return (
    <header className="h-12 border-b border-border/50 bg-card flex items-center justify-between px-4 z-20 relative">
      <div className="flex items-center gap-4 font-semibold text-sm select-none">
        <div className="w-8 h-8 rounded flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            {/* Background circle */}
            <circle cx="256" cy="256" r="248" fill="#2b2b2f" />

            {/* Connection lines */}
            <g stroke="#ffffff" strokeWidth="16" strokeLinecap="round">
              <line x1="256" y1="256" x2="350" y2="170" />
              <line x1="350" y1="170" x2="410" y2="190" />
              <line x1="350" y1="170" x2="370" y2="300" />

              <line x1="256" y1="256" x2="170" y2="190" />
              <line x1="170" y1="190" x2="140" y2="270" />
              <line x1="140" y1="270" x2="180" y2="350" />

              <line x1="256" y1="256" x2="330" y2="330" />
              <line x1="330" y1="330" x2="260" y2="360" />
            </g>

            {/* Nodes */}
            <g fill="#2b2b2f" stroke="#ffffff" strokeWidth="16">
              {/* Center */}
              <circle cx="256" cy="256" r="48" />

              {/* Right cluster */}
              <circle cx="350" cy="170" r="28" />
              <circle cx="410" cy="190" r="18" />
              <circle cx="370" cy="300" r="20" />

              {/* Left cluster */}
              <circle cx="170" cy="190" r="26" />
              <circle cx="140" cy="270" r="18" />
              <circle cx="180" cy="350" r="22" />

              {/* Bottom */}
              <circle cx="330" cy="330" r="26" />
              <circle cx="260" cy="360" r="18" />
            </g>
          </svg>
        </div>
        <span className="text-foreground/90">Financial Graph</span>
      </div>

      <div className="flex-1" />
    </header>
  );
}
