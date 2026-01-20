import { useState, useMemo, useEffect } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { JurisdictionTreemap } from "./components/JurisdictionTreemap";
import { SearchModal } from "./components/SearchModal";
import { useCompanyGraph } from "./db/queries";

function AppContent() {
  const { companyId } = useParams<{ companyId?: string }>();
  const navigate = useNavigate();

  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSP500Only, setShowSP500Only] = useState(true); // Persistent filter state at App level

  // Derive selectedNodeId from URL param - no state needed
  const selectedNodeId = companyId || null;
  
  // Derive selectedGraphNodeId - open company panel by default when company is selected
  const selectedGraphNodeId = useMemo(() => {
    if (selectedSubsidiaryId) return null; // Close company panel when subsidiary is selected
    return selectedNodeId; // Open company panel when company is selected
  }, [selectedNodeId, selectedSubsidiaryId]);

  // Keyboard shortcut for search modal (Cmd+Shift+F or Ctrl+Shift+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'F' || e.key === 'f' || e.code === 'KeyF')) {
        e.preventDefault();
        e.stopPropagation();
        setShowSearchModal(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Update URL when company is selected
  const handleSelectNode = (nodeId: string | null) => {
    if (nodeId) {
      navigate(`/company/${nodeId}`);
    } else {
      navigate("/");
    }
  };

  // Handle subsidiary selection from treemap
  const handleSelectSubsidiary = (subsidiaryId: string) => {
    setSelectedSubsidiaryId(subsidiaryId);
  };

  const { nodes, isLoading } = useCompanyGraph(selectedNodeId);

  const selectedGraphNode = useMemo(
    () => nodes.find((n) => n.id === selectedGraphNodeId) ?? null,
    [nodes, selectedGraphNodeId]
  );

  // Get the detail panel node - either the selected company or subsidiary
  const detailPanelNode = useMemo(() => {
    if (selectedSubsidiaryId) {
      // Create a node object for the subsidiary (we'll need to fetch its data)
      return { id: selectedSubsidiaryId, type: "Subsidiary" };
    }
    return selectedGraphNode;
  }, [selectedGraphNode, selectedSubsidiaryId]);

  const isPublic = selectedGraphNode?.cik ? true : false;
  const isSubsidiary = selectedGraphNode?.id !== selectedNodeId;

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans p-3">
      <Header onSearchFiling={handleSelectNode} />

      <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

      <div className="flex-1 flex overflow-hidden relative min-w-0" key={selectedNodeId}>
        <Sidebar 
          onSelectNode={handleSelectNode} 
          selectedNodeId={selectedNodeId} 
          selectedSubsidiaryId={selectedSubsidiaryId}
          onSubsidiaryClick={handleSelectSubsidiary}
          showSP500Only={showSP500Only}
          onFilterChange={setShowSP500Only}
        />

        <main className="flex-1 min-w-0 relative bg-background flex flex-col overflow-hidden">
          {!selectedNodeId ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 gap-3">
              <div className="w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground/40 mt-2">
                  Press <kbd className="px-2 py-1 text-xs bg-accent/20 rounded border">⌘ Shift F</kbd> to search by accession number
                </p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">
              Loadind Data...
            </div>
          ) : (
            <JurisdictionTreemap
              companyId={selectedNodeId}
              onSubsidiaryClick={handleSelectSubsidiary}
            />
          )}

          {/* Search Modal */}
          <SearchModal
            isOpen={showSearchModal}
            onClose={() => setShowSearchModal(false)}
            onSearchFiling={handleSelectNode}
          />
        </main>

        {detailPanelNode && (
          <DetailPanel
            node={detailPanelNode}
            onClose={() => {
              setSelectedSubsidiaryId(null);
            }}
            isPublic={isPublic}
            isSubsidiary={selectedSubsidiaryId ? true : isSubsidiary}
            parentCompanyId={selectedSubsidiaryId ? selectedNodeId : null}
          />
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/company/:companyId" element={<AppContent />} />
    </Routes>
  );
}

export default App;
