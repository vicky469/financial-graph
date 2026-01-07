import { Monitor } from "lucide-react";

export function Header() {
  return (
    <header className="h-12 border-b border-border/50 bg-card flex items-center justify-between px-4 z-20 relative">
      <div className="flex items-center gap-2.5 font-semibold text-sm select-none">
        {/* Logo Placeholder */}
        <div className="w-5 h-5 bg-primary/90 rounded flex items-center justify-center text-primary-foreground">
          <Monitor className="w-3.5 h-3.5" />
        </div>
        <span className="text-foreground/90">Financial Graph</span>
      </div>

      <div className="flex-1" />
    </header>
  );
}
