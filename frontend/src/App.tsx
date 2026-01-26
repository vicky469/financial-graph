import { useState, useMemo, useEffect } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { SearchModal } from "./components/SearchModal";
import { LandingPage } from "./components/LandingPage";
import { DesktopMainContent } from "./components/DesktopMainContent";
import { MobileCompanyView } from "./components/MobileCompanyView";
import { PreviewBanner } from "./components/PreviewBanner";
import { useCompanyDetail } from "./db/queries";
import { db } from "./db/client";
import { InactivityTimeout } from "./components/InactivityTimeout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CompanyType } from "financial-graph-shared";

function AppContent() {
  const { companyId } = useParams<{ companyId?: string }>();
  const navigate = useNavigate();

  // Derive selectedCompanyId from URL param - no state needed
  const selectedCompanyId = companyId || null;

  // Use a key-based state to automatically reset when company changes
  const [subsidiaryState, setSubsidiaryState] = useState<{ companyId: string | null; subsidiaryId: string | null }>({
    companyId: selectedCompanyId,
    subsidiaryId: null,
  });

  // Derive the actual subsidiary ID, resetting when company changes
  const selectedSubsidiaryId = subsidiaryState.companyId === selectedCompanyId ? subsidiaryState.subsidiaryId : null;

  const [showSearchModal, setShowSearchModal] = useState(false);
  
  // Company filters - persisted across navigation
  const [companyFilters, setCompanyFilters] = useState({
    showSP500Only: false,
    categories: [] as string[],
    ownerOrgs: [] as string[],
    entityTypes: [] as string[],
  });

  // Keyboard shortcut for search modal (Cmd+Shift+F or Ctrl+Shift+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "F" || e.key === "f" || e.code === "KeyF")
      ) {
        e.preventDefault();
        e.stopPropagation();
        setShowSearchModal(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Update URL when company is selected
  const handleSelectCompany = (companyId: string | null) => {
    if (companyId) {
      navigate(`/company/${companyId}`);
    } else {
      navigate("/");
    }
  };

  // Handle subsidiary selection from treemap (just updates detail panel, no URL change)
  const handleSelectSubsidiary = (subsidiaryId: string | null) => {
    setSubsidiaryState({ companyId: selectedCompanyId, subsidiaryId });
  };

  const { company: companyNode, isLoading } = useCompanyDetail(selectedCompanyId, false);

  // Get the detail panel node - either the selected company or subsidiary
  const detailPanelNode = useMemo(() => {
    if (!selectedCompanyId) return null; // No company selected, no detail panel
    
    if (selectedSubsidiaryId) {
      // For subsidiaries, pass a minimal object with isSubsidiary flag
      return { id: selectedSubsidiaryId, isSubsidiary: true };
    }
    
    // Show parent company
    return companyNode || null;
  }, [selectedCompanyId, selectedSubsidiaryId, companyNode]);

  const isPublic = companyNode && (companyNode.type === CompanyType.PUBLIC || companyNode.type === CompanyType.ISSUER) ? true : undefined;

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans" style={{ width: "100%", maxWidth: "100%", padding: "0" }}>
      {/* Preview Banner */}
      <PreviewBanner />
      
      {/* Header - hidden by default, shows on hover */}
      <div className="header-hover-zone">
        <div className="header-container">
          <Header />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative min-w-0" key={selectedCompanyId} style={{ width: "100%", maxWidth: "100%" }}>
        {/* Mobile: Show company list full width when no company selected, hide when company selected */}
        <div className="hide-on-desktop w-full" style={{ width: "100%", maxWidth: "100%" }}>
          {!selectedCompanyId ? (
            <Sidebar
              onSelectCompany={handleSelectCompany}
              selectedCompanyId={selectedCompanyId}
              selectedSubsidiaryId={selectedSubsidiaryId}
              onSubsidiaryClick={handleSelectSubsidiary}
              selectedCompany={companyNode}
              companyFilters={companyFilters}
              onFiltersChange={setCompanyFilters}
            />
          ) : (
            <MobileCompanyView
              selectedCompanyId={selectedCompanyId}
              selectedSubsidiaryId={selectedSubsidiaryId}
              onSubsidiaryClick={handleSelectSubsidiary}
              isLoading={isLoading}
              showSearchModal={showSearchModal}
              setShowSearchModal={setShowSearchModal}
              handleSelectCompany={handleSelectCompany}
              detailPanelNode={detailPanelNode}
              isPublic={isPublic}
              parentCompanyId={selectedSubsidiaryId ? selectedCompanyId : null}
              companyFilters={companyFilters}
              onFiltersChange={setCompanyFilters}
            />
          )}
        </div>

        {/* Desktop: Show sidebar and main content side by side */}
        <div className="hide-on-mobile flex w-full" style={{ width: "100%", maxWidth: "100%" }}>
          <Sidebar
            onSelectCompany={handleSelectCompany}
            selectedCompanyId={selectedCompanyId}
            selectedSubsidiaryId={selectedSubsidiaryId}
            onSubsidiaryClick={handleSelectSubsidiary}
            selectedCompany={companyNode}
            companyFilters={companyFilters}
            onFiltersChange={setCompanyFilters}
          />

          <main className="flex-1 min-w-0 relative bg-background flex flex-col overflow-hidden" style={{ width: "100%", maxWidth: "100%" }}>
            {!selectedCompanyId ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 gap-3 p-4">
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
                    Press{" "}
                    <kbd className="px-2 py-1 text-xs bg-accent/20 rounded border">⌘ Shift F</kbd> to
                    search by accession number
                  </p>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">
                Loading Data...
              </div>
            ) : (
              <DesktopMainContent
                selectedCompanyId={selectedCompanyId}
                handleSelectSubsidiary={handleSelectSubsidiary}
              />
            )}

            {/* Search Modal */}
            <SearchModal
              isOpen={showSearchModal}
              onClose={() => setShowSearchModal(false)}
              onSearchFiling={handleSelectCompany}
            />
          </main>
        </div>

        {/* Desktop detail panel */}
        {detailPanelNode && (
          <div className="hide-on-mobile">
            <DetailPanel
              node={detailPanelNode}
              isPublic={isPublic}
              parentCompanyId={selectedSubsidiaryId ? selectedCompanyId : null}
            />
          </div>
        )}
      </div>


    </div>
  );
}

function AuthenticatedApp() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/company/:companyId" element={<AppContent />} />
    </Routes>
  );
}

function App() {
  const { user, isLoading, error } = db.useAuth();
  
  // Authentication is simply: do we have a user from InstantDB?
  const isAuthenticated = !!user;

  // Toggle body class based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      document.body.classList.remove("landing-mode");
      document.body.classList.add("app-mode");
    } else {
      document.body.classList.remove("app-mode");
      document.body.classList.add("landing-mode");
    }

    return () => {
      document.body.classList.remove("app-mode", "landing-mode");
    };
  }, [isAuthenticated]);

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show error if any
  if (error) {
    console.error("Auth error:", error);
  }

  // Show landing page if not authenticated
  if (!isAuthenticated) {
    // onAuth is called after successful Google login - auth state will
    // automatically update via db.useAuth() hook when user signs in
    return <LandingPage onAuth={() => {}} />;
  }

  // Show main app if authenticated
  return (
    <ErrorBoundary>
      <InactivityTimeout user={user} />
      <AuthenticatedApp />
    </ErrorBoundary>
  );
}

export default App;
