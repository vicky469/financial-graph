import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Loader2, Building2, FileText } from "lucide-react";
import { Modal } from "../ui/modal";
import { useAllCompanies } from "../../db/queries";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchFiling?: (companyId: string) => void;
}

type SearchType = "accession" | "company";

interface SelectedCompany {
  id: string;
  name: string;
  ticker?: string;
}

export function SearchModal({ isOpen, onClose, onSearchFiling }: SearchModalProps) {
  const [searchType, setSearchType] = useState<SearchType>("accession");
  const [accessionSearch, setAccessionSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<SelectedCompany | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get all companies
  const { companies: allCompanies } = useAllCompanies();

  // Filter companies based on search query
  const filteredCompanies = useMemo(() => {
    if (searchType !== "company" || !companySearch.trim()) return [];
    const query = companySearch.toLowerCase();
    return allCompanies
      .filter((c) => {
        const name = c.name.toLowerCase();
        const ticker = c.ticker?.toLowerCase() ?? "";
        return name.includes(query) || ticker.includes(query);
      })
      .slice(0, 8); // Limit to 8 results
  }, [allCompanies, companySearch, searchType]);

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
      setSelectedCompany(null);
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredCompanies.length]);

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
    // Use selected company if available, otherwise use first filtered result
    const companyToUse = selectedCompany || filteredCompanies[0];

    if (!companyToUse) {
      setError("Please select a company");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      if (onSearchFiling) {
        onSearchFiling(companyToUse.id);
      }
      onClose();
    } catch (err) {
      console.error("Search error:", err);
      setError("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCompany = (company: SelectedCompany) => {
    setSelectedCompany(company);
    setCompanySearch(company.name);
    // Navigate after selection
    if (onSearchFiling) {
      onSearchFiling(company.id);
    }
    onClose();
  };

  const handleSearch = () => {
    if (searchType === "accession") {
      handleAccessionSearch();
    } else {
      handleCompanySearch();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (searchType === "company" && filteredCompanies.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, filteredCompanies.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && !isSearching) {
        e.preventDefault();
        const company = filteredCompanies[highlightedIndex];
        if (company) {
          handleSelectCompany({ id: company.id, name: company.name, ticker: company.ticker });
        }
        return;
      }
    }

    if (e.key === "Enter" && !isSearching && searchType === "accession") {
      const searchValue = accessionSearch.trim();
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
        const newType = searchType === "accession" ? "company" : "accession";
        setSearchType(newType);
        setError(null);
        setSelectedCompany(null);
        // Keep focus on input after tab switch
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 50);
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      // Arrow keys switch between tabs only when NOT in company mode with results
      // (In company mode, up/down arrows are used for dropdown navigation)
      if (document.activeElement === inputRef.current) {
        // Only switch tabs with left/right if accession mode or no dropdown shown
        if (searchType === "accession" || filteredCompanies.length === 0) {
          e.preventDefault();
          const newType = searchType === "accession" ? "company" : "accession";
          setSearchType(newType);
          setError(null);
          setSelectedCompany(null);
          setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          }, 50);
        }
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (searchType === "accession") {
      setAccessionSearch(value.replace(/-/g, ""));
    } else {
      setCompanySearch(value);
      setSelectedCompany(null); // Clear selection when typing
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
              borderRadius: searchType === "company" && filteredCompanies.length > 0 ? "8px 8px 0 0" : "8px",
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
                fontSize: "16px", // Prevent iOS zoom on focus
                color: "rgba(255, 255, 255, 0.9)",
                width: "100%",
                fontFamily: searchType === "accession" ? "monospace" : "inherit",
              }}
            />
            {isSearching && (
              <Loader2 size={18} style={{ color: "rgba(255, 255, 255, 0.5)" }} className="animate-spin" />
            )}
          </div>

          {/* Company Dropdown Results */}
          {searchType === "company" && filteredCompanies.length > 0 && (
            <div
              ref={listRef}
              style={{
                background: "rgba(30, 30, 35, 0.98)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderTop: "none",
                borderRadius: "0 0 8px 8px",
                maxHeight: "240px",
                overflowY: "auto",
              }}
            >
              {filteredCompanies.map((company, index) => (
                <button
                  key={company.id}
                  onClick={() => handleSelectCompany({ id: company.id, name: company.name, ticker: company.ticker })}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 16px",
                    border: "none",
                    background: index === highlightedIndex ? "rgba(99, 102, 241, 0.2)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      backgroundColor: company.sp500 ? "#34d399" : "#60a5fa",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "13px",
                      color: "rgba(255, 255, 255, 0.85)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {company.name}
                  </span>
                  {company.ticker && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "rgba(255, 255, 255, 0.4)",
                        fontFamily: "monospace",
                      }}
                    >
                      {company.ticker}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {searchType === "company" && companySearch.trim() && filteredCompanies.length === 0 && (
            <div
              style={{
                background: "rgba(30, 30, 35, 0.98)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderTop: "none",
                borderRadius: "0 0 8px 8px",
                padding: "12px 16px",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)" }}>
                No companies found
              </span>
            </div>
          )}

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

        {/* Search Button - only show for accession search */}
        {searchType === "accession" && (
          <button
            onClick={handleSearch}
            disabled={!currentValue.trim() || isSearching}
            tabIndex={-1}
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
        )}

        {/* Hint for company search */}
        {searchType === "company" && companySearch.trim() && filteredCompanies.length > 0 && (
          <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", textAlign: "center" }}>
            Use ↑↓ to navigate • Enter to select
          </div>
        )}
      </div>
    </Modal>
  );
}