import { useState, useEffect } from "react";
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { db, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_NAME } from "../../db/client";
import { FeatureCard } from "./FeatureCard";
import { EntityCard } from "./EntityCard";
import { GraphRelation } from "./GraphRelation";
import { QuestionCard } from "./QuestionCard";
import { GraphVisualization } from "./GraphVisualization";

interface LandingPageProps {
  onAuth: () => void;
}

export function LandingPage({ onAuth }: LandingPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [nonce] = useState(crypto.randomUUID());

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 900); // Breakpoint where grid likely collapses
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setError("No credential received from Google. Please try again.");
      return;
    }

    setError(null);

    try {
      await db.auth.signInWithIdToken({
        clientName: GOOGLE_CLIENT_NAME,
        idToken: credentialResponse.credential,
        nonce,
      });
      
      // The onAuth callback will be triggered by the parent component
      // when the user state changes
      onAuth();
    } catch (err: unknown) {
      console.error("Google Auth error:", err);
      const errorMessage = (err as { body?: { message?: string } })?.body?.message || "Failed to sign in with Google. Please try again.";
      setError(errorMessage);
    }
  };

  const handleGoogleError = () => {
    setError("Google sign-in was cancelled or failed. Please try again.");
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="landing-page">
      
      {/* Hero Section */}
      <div className="landing-container hero-section" style={{ position: 'relative', zIndex: 1 }}>
        {/* Logo / Brand */}
        <div className="landing-brand">
          <svg
            width="40"
            height="40"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0 }}
          >
            {/* Connection lines with gradient */}
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            
            {/* Lines connecting nodes */}
            <g stroke="url(#lineGradient)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6">
              <line x1="50" y1="50" x2="75" y2="28" />
              <line x1="75" y1="28" x2="85" y2="42" />
              <line x1="50" y1="50" x2="28" y2="32" />
              <line x1="28" y1="32" x2="18" y2="52" />
              <line x1="50" y1="50" x2="70" y2="70" />
              <line x1="50" y1="50" x2="30" y2="70" />
            </g>
            
            {/* Nodes with gradient fills */}
            <circle cx="50" cy="50" r="7" fill="#818cf8" stroke="#a78bfa" strokeWidth="2" />
            <circle cx="75" cy="28" r="5" fill="#a78bfa" stroke="#c4b5fd" strokeWidth="1.5" />
            <circle cx="85" cy="42" r="3.5" fill="#c4b5fd" stroke="#e0e7ff" strokeWidth="1" />
            <circle cx="28" cy="32" r="5" fill="#a78bfa" stroke="#c4b5fd" strokeWidth="1.5" />
            <circle cx="18" cy="52" r="3.5" fill="#c4b5fd" stroke="#e0e7ff" strokeWidth="1" />
            <circle cx="70" cy="70" r="4" fill="#a78bfa" stroke="#c4b5fd" strokeWidth="1.5" />
            <circle cx="30" cy="70" r="4" fill="#a78bfa" stroke="#c4b5fd" strokeWidth="1.5" />
          </svg>
          <span className="brand-name">Financial Graph</span>
        </div>

        {/* Hero Content */}
        <div className="hero-grid">
          {/* Left: Text Content */}
          <div className="hero-text">

            <h1 className="hero-title">
              Understand how
              <br />
              <span className="hero-title-gradient">companies really operate</span>
            </h1>

            <p className="hero-description">
              Navigate complex corporate structures. Map subsidiaries to business lines. Discover
              the entities behind brands and products.
            </p>

            {/* Mobile Graph: Shown only on small screens */}
            {isMobile && (
              <div
                style={{
                  height: "300px",
                  width: "100%",
                  maxWidth: "400px",
                  margin: "-16px auto 24px auto",
                }}
              >
                <GraphVisualization />
              </div>
            )}

            <div className="hero-cta">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                {/* Custom styled Google Login wrapper */}
                <div className="google-login-wrapper">
                  <GoogleLogin
                    nonce={nonce}
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    useOneTap={false}
                    theme="filled_blue"
                    size="large"
                    text="continue_with"
                    shape="rectangular"
                    logo_alignment="left"
                    width="280"
                  />
                </div>
                
                {error && (
                  <div className="error-message" style={{
                    padding: '12px 16px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    color: '#ef4444',
                    fontSize: '14px',
                    textAlign: 'center',
                    maxWidth: '320px'
                  }}>
                    {error}
                  </div>
                )}
                
                <p className="hint-text">Secure authentication with your Google account.</p>
              </div>
            </div>
          </div>

          {/* Right: Visual Graph - Desktop only */}
          {!isMobile && (
            <div className="hero-graph">
              <GraphVisualization />
            </div>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="section-alt">
        <div className="landing-container">
          <div className="section-header">
            <h2 className="section-label">Powered by Knowledge Graphs</h2>
          </div>

          <div className="features-grid">
            <FeatureCard
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              }
              title="Corporate Structure"
              description="Navigate hierarchies of subsidiaries, understand ownership chains, and see how legal entities connect."
            />
            <FeatureCard
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              }
              title="Global Jurisdiction"
              description="Visualize where subsidiaries are incorporated. Understand the geographic footprint of operations."
            />
            <FeatureCard
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              }
              title="SEC Filings Integration"
              description="Data extracted from official SEC filings."
            />
          </div>
        </div>
      </div>

      {/* Graph Model Section */}
      <div className="landing-container">
        <div className="section-header">
          <h2 className="section-label">The Data Model</h2>
          <p className="section-title">A graph that captures business reality</p>
          <p className="section-subtitle">
            Moving beyond static lists to a connected knowledge graph that models how companies
            actually operate.
          </p>
        </div>

        <div className="entity-grid">
          <EntityCard
            color="#ec4899"
            title="Legal Entity"
            subtitle="Subsidiary"
            items={["Holds assets", "Contracts", "Liability shield"]}
          />
          <EntityCard
            color="#a855f7"
            title="Brand"
            subtitle="Trademark"
            items={["Customer facing", "Marketing identity", "Brand equity"]}
          />
          <EntityCard
            color="#6366f1"
            title="Product"
            subtitle="Service"
            items={["Revenue driver", "Market position", "Value delivery"]}
          />
          <EntityCard
            color="#14b8a6"
            title="Segment"
            subtitle="Business Line"
            items={["P&L reporting", "Strategic unit", "Growth vector"]}
          />
        </div>

        <div className="relations-box">
          <div className="relations-content">
            <GraphRelation from="Legal Entity" relation="owns" to="Brand" />
            <GraphRelation from="Brand" relation="markets" to="Product" />
            <GraphRelation from="Product" relation="belongs to" to="Segment" />
          </div>
        </div>
      </div>

      {/* Questions Section */}
      <div className="section-alt">
        <div className="landing-container">
          <div className="section-header">
            <p className="section-title">Questions we help you answer</p>
          </div>

          <div className="questions-grid">
            <QuestionCard question="What does this subsidiary actually do?" />
            <QuestionCard question="Which brands sit under which legal entities?" />
            <QuestionCard question="How does this company really operate?" />
            <QuestionCard question="Where are the company's entities incorporated?" />
            <QuestionCard question="What's the ownership structure?" />
            <QuestionCard question="How do subsidiaries map to business lines?" />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="landing-container cta-section">
        <h2 className="cta-title">Ready to explore?</h2>
        <p className="cta-subtitle">Start navigating corporate structures in seconds.</p>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
          <div className="google-login-wrapper">
            <GoogleLogin
              nonce={nonce}
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false}
              theme="filled_blue"
              size="large"
              text="signup_with"
              shape="rectangular"
              logo_alignment="left"
              width="280"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="landing-footer">
        <p>Built with InstantDB Triple Store</p>
      </div>
    </div>
    </GoogleOAuthProvider>
  );
}

// Sub-components
