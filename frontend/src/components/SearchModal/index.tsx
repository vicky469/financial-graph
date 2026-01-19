import { useState, useRef, useEffect } from "react";
import { Search, Loader2, Building2, FileText } from "lucide-react";
import { Modal } from "../ui/modal";
import { useAllCompaniesCached } from "../../db/queries";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchFiling?: (companyId: string) => void;
}

type SearchType = "accession" | "company";

export function SearchModal({ isOpen, onClose, onSearchFiling }: SearchModalProps) {
  const [searchType, setSearchType] = useState<SearchType>("accession");
  const [accessionSearch, setAccessionSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get all companies with heavy caching
  const { companies: allCompanies } = useAllCompaniesCached();

  // Focus input when modal opens or search type changes
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Use a longer timeout to ensure the DOM has updated
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select(); // Also select any existing text
      }, 150);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, searchType]);

  // Clear state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAccessionSearch("");
      setCompanySearch("");
      setError(null);
      setIsSearching(false);
      setSearchType("accession");
    }
  }, [isOpen]);

  const handleAccessionSearch = async () => {
    if (!accessionSearch.trim()) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      const { db } = await import("../../db/client");
      
      const searchValue = accessionSearch.trim();
      
      // Try searching by accession_number_nodashes first
      let result = await db.queryOnce({
        filing: {
          $: {
            where: {
              accession_number_nodashes: searchValue,
            },
          },
          companies: {},
        },
      });

      let filing = result.data?.filing?.[0];
      
      // If not found, try with accession_number (with dashes)
      if (!filing) {
        let formattedSearch = searchValue;
        if (searchValue.length === 18 && !searchValue.includes('-')) {
          formattedSearch = `${searchValue.slice(0, 10)}-${searchValue.slice(10, 12)}-${searchValue.slice(12)}`;
        }
        
        result = await db.queryOnce({
          filing: {
            $: {
              where: {
                accession_number: formattedSearch,
              },
            },
            companies: {},
          },
        });
        
        filing = result.data?.filing?.[0];
      }

      if (filing && filing.companies && filing.companies.length > 0) {
        const companyId = filing.companies[0].id;
        if (onSearchFiling) {
          onSearchFiling(companyId);
        }
        onClose();
      } else {
        setError("Filing not found");
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleCompanySearch = async () => {
    if (!companySearch.trim()) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      // Use client-side filtering like the sidebar does
      const query = companySearch.trim().toLowerCase();
      const matchingCompanies = allCompanies.filter((c) => {
        const name = c.name.toLowerCase();
        const ticker = c.ticker?.toLowerCase() ?? "";
        return name.includes(query) || ticker.includes(query);
      });
      
      if (matchingCompanies.length > 0) {
        // Take the first match
        const companyId = matchingCompanies[0].id;
        if (onSearchFiling) {
          onSearchFiling(companyId);
        }
        onClose();
      } else {
        setError("Company not found");
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    if (searchType === "accession") {
      handleAccessionSearch();
    } else {
      handleCompanySearch();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearching) {
      const searchValue = searchType === "accession" ? accessionSearch.trim() : companySearch.trim();
      if (searchValue) {
        e.preventDefault();
        handleSearch();
      }
    }
  };

  // Handle Tab key navigation between search type tabs
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      // If we're in the input field, Tab should switch between search types
      if (document.activeElement === inputRef.current) {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab: go to previous tab
          setSearchType(searchType === "accession" ? "company" : "accession");
        } else {
          // Tab: go to next tab
          setSearchType(searchType === "accession" ? "company" : "accession");
        }
        setError(null);
        // Keep focus on input after tab switch
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 50);
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      // Arrow keys also switch between tabs when input is focused
      if (document.activeElement === inputRef.current) {
        e.preventDefault();
        if (e.key === "ArrowLeft") {
          setSearchType(searchType === "accession" ? "company" : "accession");
        } else {
          setSearchType(searchType === "accession" ? "company" : "accession");
        }
        setError(null);
        // Keep focus on input after tab switch
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 50);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (searchType === "accession") {
      setAccessionSearch(value.replace(/-/g, ""));
    } else {
      setCompanySearch(value);
    }
    setError(null);
  };

  const currentValue = searchType === "accession" ? accessionSearch : companySearch;
  const placeholder = searchType === "accession" ? "0001193125-24-012345" : "Apple Inc";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Search"
      size="sm"
      container="main-content"
    >
      <div className="space-y-4" onKeyDown={handleModalKeyDown}>
        {/* Search Type Tabs */}
        <div>
          <div className="flex rounded-md" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
            <button
              onClick={() => {
                setSearchType("accession");
                setError(null); // Clear any existing error
                // Focus input after tab switch
                setTimeout(() => {
                  inputRef.current?.focus();
                  inputRef.current?.select();
                }, 50);
              }}
              tabIndex={-1} // Remove from tab order - use Tab key to switch instead
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-l-md transition-colors"
              style={{
                backgroundColor: searchType === "accession" ? "rgba(99, 102, 241, 0.3)" : "transparent",
                color: searchType === "accession" ? "#c7d2fe" : "rgba(255, 255, 255, 0.6)",
              }}
            >
              <FileText size={14} />
              Accession #
            </button>
            <button
              onClick={() => {
                setSearchType("company");
                setError(null); // Clear any existing error
                // Focus input after tab switch
                setTimeout(() => {
                  inputRef.current?.focus();
                  inputRef.current?.select();
                }, 50);
              }}
              tabIndex={-1} // Remove from tab order - use Tab key to switch instead
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-r-md transition-colors"
              style={{
                backgroundColor: searchType === "company" ? "rgba(99, 102, 241, 0.3)" : "transparent",
                color: searchType === "company" ? "#c7d2fe" : "rgba(255, 255, 255, 0.6)",
              }}
            >
              <Building2 size={14} />
              Company
            </button>
          </div>
          <div style={{ 
            fontSize: "11px", 
            color: "rgba(255, 255, 255, 0.4)", 
            textAlign: "center", 
            marginTop: "6px" 
          }}>
            Use Tab or ← → to switch • Enter to search
          </div>
        </div>

        {/* Search Input */}
        <div>
          <div 
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "rgba(255, 255, 255, 0.05)",
              border: error ? "1px solid #f87171" : "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              padding: "12px 16px",
              transition: "all 0.2s ease",
              minWidth: "280px",
            }}
          >
            <Search size={18} style={{ color: "rgba(255, 255, 255, 0.5)", flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={currentValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isSearching}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "14px",
                color: "rgba(255, 255, 255, 0.9)",
                width: "100%",
                fontFamily: searchType === "accession" ? "monospace" : "inherit",
              }}
            />
            {isSearching && (
              <Loader2 size={18} style={{ color: "rgba(255, 255, 255, 0.5)" }} className="animate-spin" />
            )}
          </div>
          {error && (
            <p style={{ 
              fontSize: "12px", 
              color: "#f87171", 
              marginTop: "6px",
            }}>
              {error}
            </p>
          )}
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={!currentValue.trim() || isSearching}
          tabIndex={-1} // Remove from tab order - use Enter to search instead
          className="w-full px-4 py-2 rounded-lg transition-colors font-medium"
          style={{
            backgroundColor: (!currentValue.trim() || isSearching) 
              ? "rgba(99, 102, 241, 0.1)" 
              : "rgba(99, 102, 241, 0.2)",
            color: (!currentValue.trim() || isSearching) 
              ? "rgba(129, 140, 248, 0.5)" 
              : "#818cf8",
            border: (!currentValue.trim() || isSearching) 
              ? "1px solid rgba(99, 102, 241, 0.2)" 
              : "1px solid rgba(99, 102, 241, 0.4)",
            cursor: (!currentValue.trim() || isSearching) ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!currentValue.trim() || isSearching) return;
            e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.3)";
          }}
          onMouseLeave={(e) => {
            if (!currentValue.trim() || isSearching) return;
            e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.2)";
          }}
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>
    </Modal>
  );
}