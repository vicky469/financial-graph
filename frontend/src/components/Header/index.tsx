import { useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  onSearchFiling?: (companyId: string) => void;
}

export function Header({ onSearchFiling }: HeaderProps) {
  const navigate = useNavigate();
  const [accessionSearch, setAccessionSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!accessionSearch.trim()) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      const { db } = await import("../../db/client");
      
      const result = await db.queryOnce({
        filings: {
          $: {
            where: {
              accession_number_nodashes: accessionSearch.trim(),
            },
          },
        },
      });

      const filing = result.data?.filings?.[0];
      if (filing) {
        if (onSearchFiling) {
          onSearchFiling(filing.company_id);
        } else {
          navigate(`/company/${filing.company_id}`);
        }
        setAccessionSearch("");
      } else {
        setError("Filing not found");
      }
    } catch {
      setError("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

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
        <span style={{ marginLeft: "4px" }} className="text-sm font-medium text-foreground/80">Financial Graph</span>
      </div>

      {/* Accession Number Search */}
      <div className="ml-auto flex items-center gap-2">
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "6px",
          padding: "0 10px",
          height: "32px",
        }}>
          <Search size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
          <input
            type="text"
            placeholder="Accession # (no dashes)"
            value={accessionSearch}
            onChange={(e) => {
              setAccessionSearch(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "12px",
              color: "rgba(255,255,255,0.8)",
              width: "160px",
            }}
          />
          {isSearching && (
            <div style={{
              width: "12px",
              height: "12px",
              border: "2px solid rgba(255,255,255,0.2)",
              borderTopColor: "rgba(255,255,255,0.6)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
          )}
        </div>
        {error && (
          <span style={{ fontSize: "11px", color: "#f87171" }}>{error}</span>
        )}
      </div>
    </header>
  );
}
