import { useState, useMemo, useEffect } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { SearchModal } from "./components/SearchModal";
import { LandingPage } from "./components/LandingPage";
import { DesktopMainContent } from "./components/DesktopMainContent";
import { UserNotesPanel } from "./components/DesktopMainContent/UserNotesPanel";
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
  const [subsidiaryState, setSubsidiaryState] = useState<{
    companyId: string | null;
    subsidiaryId: string | null;
  }>({
    companyId: selectedCompanyId,
    subsidiaryId: null,
  });

  // Derive the actual subsidiary ID, resetting when company changes
  const selectedSubsidiaryId =
    subsidiaryState.companyId === selectedCompanyId ? subsidiaryState.subsidiaryId : null;

  const [showSearchModal, setShowSearchModal] = useState(false);

  // Company filters - persisted across navigation
  const [companyFilters, setCompanyFilters] = useState({
    sp500Only: false,
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

  const isPublic =
    companyNode &&
    (companyNode.type === CompanyType.PUBLIC || companyNode.type === CompanyType.ISSUER)
      ? true
      : undefined;

  return (
    <div
      className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans"
      style={{ width: "100%", maxWidth: "100%", padding: "0" }}
    >
      {/* Preview Banner */}
      <PreviewBanner />

      {/* Header - hidden by default, shows on hover */}
      <div className="header-hover-zone">
        <div className="header-container">
          <Header />
        </div>
      </div>

      <div
        className="flex-1 flex overflow-hidden relative min-w-0"
        key={selectedCompanyId}
        style={{ width: "100%", maxWidth: "100%" }}
      >
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

          <main
            className="flex-1 min-w-0 relative bg-background flex flex-col overflow-hidden"
            style={{ width: "100%", maxWidth: "100%" }}
          >
            {!selectedCompanyId ? (
              <div className="relative h-full min-h-0 p-6">
                <div
                  style={{
                    width: "min(540px, 100%)",
                    height: "calc(100% - 54px)",
                    minHeight: "420px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    overflow: "hidden",
                    background: "hsl(240 6% 4%)",
                  }}
                >
                  <UserNotesPanel />
                </div>

                <div
                  className="absolute left-1/2 -translate-x-1/2 bottom-[12px]"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                    backgroundColor: "hsl(155, 80%, 8%)",
                    border: "1px solid hsl(155, 60%, 18%)",
                    borderRadius: "6px",
                    padding: "2px 8px",
                    color: "hsl(150, 60%, 70%)",
                    textShadow: "0 0 6px hsl(150, 60%, 70%, 0.18)",
                    fontSize: "12px",
                    lineHeight: "1",
                  }}
                >
                  Press{" "}
                  <kbd
                    className="px-1.5 py-[1px] text-xs rounded"
                    style={{
                      backgroundColor: "hsl(155, 95%, 4%)",
                      border: "1px solid hsl(155, 75%, 14%)",
                      color: "hsl(150, 60%, 70%)",
                      lineHeight: "1",
                      margin: "0 6px",
                    }}
                  >
                    ⌘ + Shift + F
                  </kbd>{" "}
                  to search
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
