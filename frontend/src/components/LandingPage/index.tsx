import { useState, useEffect } from "react";
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { db, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_NAME } from "../../db/client";

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
      <div className="landing-container hero-section">
        {/* Logo / Brand */}
        <div className="landing-brand">
          <div className="brand-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
              <path d="m4.93 4.93 2.83 2.83m8.48 8.48 2.83 2.83m-2.83-14.14 2.83 2.83M4.93 19.07l2.83-2.83" />
            </svg>
          </div>
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
                  margin: "0 auto 32px auto",
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

function GraphVisualization() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Ambient background elements - multiple breathing layers */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "320px",
          height: "320px",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)",
          borderRadius: "50%",
          animation: "breathe1 6s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "25%",
          left: "25%",
          width: "180px",
          height: "180px",
          background: "radial-gradient(circle, rgba(236, 72, 153, 0.08) 0%, transparent 70%)",
          borderRadius: "50%",
          animation: "breathe2 8s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "60%",
          right: "15%",
          width: "200px",
          height: "200px",
          background: "radial-gradient(circle, rgba(20, 184, 166, 0.07) 0%, transparent 70%)",
          borderRadius: "50%",
          animation: "breathe3 7s ease-in-out infinite",
        }}
      />

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 420"
        fill="none"
        style={{ position: "relative", zIndex: 1 }}
      >
        <defs>
          {/* Gradients for different node types - each "species" has its character */}
          <linearGradient id="corpGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="financeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <linearGradient id="techGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="opsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(99, 102, 241, 0.3)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Glow filters */}
          <filter id="glow1" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow2" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="particleGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" />
          </filter>

          {/* Gradient for bidirectional edges */}
          <linearGradient id="edgeAB" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(129, 140, 248, 0.5)" />
            <stop offset="50%" stopColor="rgba(192, 132, 252, 0.3)" />
            <stop offset="100%" stopColor="rgba(244, 114, 182, 0.5)" />
          </linearGradient>
          <linearGradient id="edgeAC" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(129, 140, 248, 0.4)" />
            <stop offset="100%" stopColor="rgba(52, 211, 153, 0.4)" />
          </linearGradient>
          <linearGradient id="edgeBD" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(244, 114, 182, 0.4)" />
            <stop offset="100%" stopColor="rgba(251, 191, 36, 0.4)" />
          </linearGradient>
        </defs>

        {/* Dynamic orbital system - rotating at different speeds */}
        <g>
          <ellipse
            cx="200"
            cy="210"
            rx="175"
            ry="65"
            fill="none"
            stroke="rgba(99, 102, 241, 0.06)"
            strokeWidth="1"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 200 210"
              to="360 200 210"
              dur="60s"
              repeatCount="indefinite"
            />
          </ellipse>
          <ellipse
            cx="200"
            cy="210"
            rx="130"
            ry="50"
            fill="none"
            stroke="rgba(236, 72, 153, 0.05)"
            strokeWidth="1"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="360 200 210"
              to="0 200 210"
              dur="45s"
              repeatCount="indefinite"
            />
          </ellipse>
          <ellipse
            cx="200"
            cy="210"
            rx="90"
            ry="35"
            fill="none"
            stroke="rgba(52, 211, 153, 0.04)"
            strokeWidth="1"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 200 210"
              to="360 200 210"
              dur="30s"
              repeatCount="indefinite"
            />
          </ellipse>
        </g>

        {/* Complex connection network - bidirectional flows */}
        <g>
          {/* Main connections - curved organic paths */}
          {/* CORP to Finance Hub */}
          <path
            id="pathCorpFin"
            d="M200 100 C140 130 100 150 80 190"
            stroke="url(#edgeAB)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          {/* CORP to Tech Hub */}
          <path
            id="pathCorpTech"
            d="M200 100 C260 130 300 150 320 190"
            stroke="url(#edgeAC)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          {/* Finance to Ops - cross connection */}
          <path
            id="pathFinOps"
            d="M95 210 C140 280 180 300 200 340"
            stroke="rgba(244, 114, 182, 0.2)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          {/* Tech to Ops - cross connection */}
          <path
            id="pathTechOps"
            d="M305 210 C260 280 220 300 200 340"
            stroke="rgba(52, 211, 153, 0.2)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          {/* Finance to Tech - horizontal collaboration */}
          <path
            id="pathFinTech"
            d="M105 195 C150 160 250 160 295 195"
            stroke="rgba(192, 132, 252, 0.15)"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
          {/* Subsidiary connections */}
          <path
            d="M65 220 Q50 270 60 310"
            stroke="rgba(244, 114, 182, 0.15)"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M335 220 Q350 270 340 310"
            stroke="rgba(52, 211, 153, 0.15)"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
          />
          {/* Subsidiary cross-links */}
          <path
            d="M75 320 Q130 380 200 370 Q270 380 325 320"
            stroke="rgba(251, 191, 36, 0.1)"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="3 5"
          />
        </g>

        {/* Multi-directional data flow particles - the "bloodstream" of the ecosystem */}
        <g>
          {/* Downward flows - directives, capital */}
          <circle r="3" fill="#818cf8" filter="url(#particleGlow)">
            <animateMotion dur="2.5s" repeatCount="indefinite">
              <mpath href="#pathCorpFin" />
            </animateMotion>
          </circle>
          <circle r="2.5" fill="#a78bfa" filter="url(#particleGlow)">
            <animateMotion dur="3s" repeatCount="indefinite" begin="0.5s">
              <mpath href="#pathCorpTech" />
            </animateMotion>
          </circle>

          {/* Upward flows - reports, data (reversed paths) */}
          <circle r="2" fill="#f472b6" filter="url(#particleGlow)">
            <animateMotion
              dur="3.5s"
              repeatCount="indefinite"
              keyPoints="1;0"
              keyTimes="0;1"
              calcMode="linear"
            >
              <mpath href="#pathCorpFin" />
            </animateMotion>
          </circle>
          <circle r="2" fill="#34d399" filter="url(#particleGlow)">
            <animateMotion
              dur="4s"
              repeatCount="indefinite"
              keyPoints="1;0"
              keyTimes="0;1"
              calcMode="linear"
              begin="1s"
            >
              <mpath href="#pathCorpTech" />
            </animateMotion>
          </circle>

          {/* Horizontal collaboration flows */}
          <circle r="2" fill="#c084fc" filter="url(#particleGlow)">
            <animateMotion dur="5s" repeatCount="indefinite">
              <mpath href="#pathFinTech" />
            </animateMotion>
          </circle>
          <circle r="1.5" fill="#a78bfa" filter="url(#particleGlow)">
            <animateMotion
              dur="5s"
              repeatCount="indefinite"
              keyPoints="1;0"
              keyTimes="0;1"
              calcMode="linear"
              begin="2.5s"
            >
              <mpath href="#pathFinTech" />
            </animateMotion>
          </circle>

          {/* Cascading flows to operations */}
          <circle r="2" fill="#fbbf24" filter="url(#particleGlow)">
            <animateMotion dur="4s" repeatCount="indefinite" begin="0.3s">
              <mpath href="#pathFinOps" />
            </animateMotion>
          </circle>
          <circle r="2" fill="#10b981" filter="url(#particleGlow)">
            <animateMotion dur="4.5s" repeatCount="indefinite" begin="0.8s">
              <mpath href="#pathTechOps" />
            </animateMotion>
          </circle>
        </g>

        {/* Root Node - CORP: The steady heartbeat */}
        <g filter="url(#glow1)" style={{ cursor: "pointer" }}>
          {/* Hub glow */}
          <circle cx="200" cy="75" r="50" fill="url(#hubGlow)">
            <animate attributeName="r" values="45;55;45" dur="4s" repeatCount="indefinite" />
          </circle>
          {/* Main node */}
          <circle cx="200" cy="75" r="30" fill="url(#corpGradient)">
            <animate attributeName="r" values="30;32;30" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle
            cx="200"
            cy="75"
            r="30"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
            fill="none"
          />
          {/* Rotating ring */}
          <circle
            cx="200"
            cy="75"
            r="38"
            stroke="rgba(129, 140, 248, 0.4)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="8 12"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 200 75"
              to="360 200 75"
              dur="15s"
              repeatCount="indefinite"
            />
          </circle>
          <text
            x="200"
            y="79"
            textAnchor="middle"
            fill="white"
            fontSize="11"
            fontWeight="600"
            fontFamily="system-ui"
          >
            CORP
          </text>
        </g>

        {/* Finance Hub - Quick pulse, analytical rhythm */}
        <g filter="url(#glow2)" style={{ cursor: "pointer" }}>
          <circle cx="80" cy="195" r="24" fill="url(#financeGradient)">
            <animate attributeName="r" values="24;26;24" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle
            cx="80"
            cy="195"
            r="24"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
            fill="none"
          />
          {/* Pulsing ring - fast rhythm */}
          <circle
            cx="80"
            cy="195"
            r="30"
            stroke="rgba(244, 114, 182, 0.3)"
            strokeWidth="1"
            fill="none"
          >
            <animate attributeName="r" values="28;34;28" dur="2s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.4;0.1;0.4"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <text
            x="80"
            y="199"
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="500"
            fontFamily="system-ui"
          >
            FIN
          </text>
        </g>

        {/* Tech Hub - Steady, methodical pulse */}
        <g filter="url(#glow2)" style={{ cursor: "pointer" }}>
          <circle cx="320" cy="195" r="24" fill="url(#techGradient)">
            <animate attributeName="r" values="24;27;24" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle
            cx="320"
            cy="195"
            r="24"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
            fill="none"
          />
          {/* Double rotating rings - tech complexity */}
          <circle
            cx="320"
            cy="195"
            r="32"
            stroke="rgba(52, 211, 153, 0.25)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="4 8"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 320 195"
              to="360 320 195"
              dur="8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            cx="320"
            cy="195"
            r="36"
            stroke="rgba(52, 211, 153, 0.15)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="2 10"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="360 320 195"
              to="0 320 195"
              dur="12s"
              repeatCount="indefinite"
            />
          </circle>
          <text
            x="320"
            y="199"
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="500"
            fontFamily="system-ui"
          >
            TECH
          </text>
        </g>

        {/* Operations Hub - Slow, powerful breathing */}
        <g filter="url(#glow2)" style={{ cursor: "pointer" }}>
          <circle cx="200" cy="350" r="26" fill="url(#opsGradient)">
            <animate attributeName="r" values="26;29;26" dur="5s" repeatCount="indefinite" />
          </circle>
          <circle
            cx="200"
            cy="350"
            r="26"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
            fill="none"
          />
          {/* Radiating waves - operational reach */}
          <circle
            cx="200"
            cy="350"
            r="34"
            stroke="rgba(251, 191, 36, 0.2)"
            strokeWidth="1"
            fill="none"
          >
            <animate attributeName="r" values="32;42;32" dur="5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="5s" repeatCount="indefinite" />
          </circle>
          <circle
            cx="200"
            cy="350"
            r="40"
            stroke="rgba(251, 191, 36, 0.1)"
            strokeWidth="1"
            fill="none"
          >
            <animate
              attributeName="r"
              values="38;50;38"
              dur="5s"
              repeatCount="indefinite"
              begin="1s"
            />
            <animate
              attributeName="opacity"
              values="0.2;0;0.2"
              dur="5s"
              repeatCount="indefinite"
              begin="1s"
            />
          </circle>
          <text
            x="200"
            y="354"
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="500"
            fontFamily="system-ui"
          >
            OPS
          </text>
        </g>

        {/* Subsidiary nodes - smaller entities with unique behaviors */}
        {/* UK entity - steady */}
        <g style={{ cursor: "pointer" }}>
          <circle cx="60" cy="320" r="14" fill="#0d9488">
            <animate attributeName="r" values="14;15;14" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle
            cx="60"
            cy="320"
            r="14"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            fill="none"
          />
          <text
            x="60"
            y="323"
            textAnchor="middle"
            fill="white"
            fontSize="8"
            fontWeight="600"
            fontFamily="system-ui"
          >
            UK
          </text>
        </g>

        {/* DE entity - precise */}
        <g style={{ cursor: "pointer" }}>
          <circle cx="130" cy="290" r="14" fill="#d97706">
            <animate attributeName="r" values="14;15;14" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle
            cx="130"
            cy="290"
            r="14"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            fill="none"
          />
          <text
            x="130"
            y="293"
            textAnchor="middle"
            fill="white"
            fontSize="8"
            fontWeight="600"
            fontFamily="system-ui"
          >
            DE
          </text>
        </g>

        {/* JP entity - harmonious */}
        <g style={{ cursor: "pointer" }}>
          <circle cx="270" cy="290" r="14" fill="#059669">
            <animate attributeName="r" values="14;16;14" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle
            cx="270"
            cy="290"
            r="14"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            fill="none"
          />
          <text
            x="270"
            y="293"
            textAnchor="middle"
            fill="white"
            fontSize="8"
            fontWeight="600"
            fontFamily="system-ui"
          >
            JP
          </text>
        </g>

        {/* CN entity - dynamic */}
        <g style={{ cursor: "pointer" }}>
          <circle cx="340" cy="320" r="14" fill="#dc2626">
            <animate attributeName="r" values="14;16;13;14" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle
            cx="340"
            cy="320"
            r="14"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            fill="none"
          />
          <text
            x="340"
            y="323"
            textAnchor="middle"
            fill="white"
            fontSize="8"
            fontWeight="600"
            fontFamily="system-ui"
          >
            CN
          </text>
        </g>

        {/* Ambient floating particles - ecosystem activity */}
        <g>
          {/* Wandering particles that move independently */}
          <circle cx="50" cy="130" r="1.5" fill="#818cf8" opacity="0.6">
            <animate attributeName="cx" values="50;70;45;50" dur="12s" repeatCount="indefinite" />
            <animate
              attributeName="cy"
              values="130;145;120;130"
              dur="12s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.6;0.2;0.5;0.6"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="350" cy="110" r="1.5" fill="#a78bfa" opacity="0.5">
            <animate
              attributeName="cx"
              values="350;340;360;350"
              dur="10s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="110;130;100;110"
              dur="10s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.5;0.1;0.4;0.5"
              dur="5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="380" cy="260" r="2" fill="#34d399" opacity="0.4">
            <animate
              attributeName="cx"
              values="380;365;385;380"
              dur="8s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="260;280;250;260"
              dur="8s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.4;0.15;0.35;0.4"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="25" cy="250" r="1.5" fill="#f472b6" opacity="0.5">
            <animate attributeName="cx" values="25;40;20;25" dur="9s" repeatCount="indefinite" />
            <animate
              attributeName="cy"
              values="250;235;265;250"
              dur="9s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.5;0.2;0.4;0.5"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="200" cy="410" r="2" fill="#fbbf24" opacity="0.3">
            <animate
              attributeName="cx"
              values="200;180;220;200"
              dur="14s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="410;395;405;410"
              dur="14s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.3;0.1;0.25;0.3"
              dur="6s"
              repeatCount="indefinite"
            />
          </circle>
          {/* Additional ambient particles */}
          <circle cx="150" cy="140" r="1" fill="#c084fc" opacity="0.4">
            <animate
              attributeName="opacity"
              values="0.4;0.1;0.4"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="250" cy="140" r="1" fill="#34d399" opacity="0.3">
            <animate
              attributeName="opacity"
              values="0.3;0.1;0.3"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="100" cy="380" r="1.5" fill="#ec4899" opacity="0.3">
            <animate
              attributeName="opacity"
              values="0.3;0.1;0.3"
              dur="5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="300" cy="380" r="1.5" fill="#10b981" opacity="0.3">
            <animate
              attributeName="opacity"
              values="0.3;0.1;0.3"
              dur="4.5s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </svg>

      <style>{`
        @keyframes breathe1 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.6; }
        }
        @keyframes breathe2 {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 0.4; }
        }
        @keyframes breathe3 {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 0.5; }
        }
        
        /* Custom Google Login Button Styling */
        .google-login-wrapper {
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transition: all 0.2s ease;
        }
        
        .google-login-wrapper:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }
        
        /* Override Google button styles to match our theme */
        .google-login-wrapper iframe {
          border-radius: 12px !important;
        }
        
        /* Error message animation */
        .error-message {
          animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        padding: "40px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.08)",
        transition: "all 0.3s ease",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.borderColor = "rgba(129, 140, 248, 0.3)";
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.5), transparent)",
        }}
      />
      
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.1))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
          color: "#818cf8",
          boxShadow: "0 8px 24px rgba(99, 102, 241, 0.2)",
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontSize: "20px",
          fontWeight: "700",
          marginBottom: "16px",
          color: "rgba(255,255,255,0.95)",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: "15px",
          lineHeight: "1.7",
          color: "rgba(255,255,255,0.6)",
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function EntityCard({
  color,
  title,
  subtitle,
  items,
}: {
  color: string;
  title: string;
  subtitle: string;
  items: string[];
}) {
  return (
    <div
      style={{
        padding: "32px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderTop: `3px solid ${color}`,
        transition: "all 0.3s ease",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 12px 32px rgba(0, 0, 0, 0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Subtle glow effect */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
        }}
      />
      
      <div
        style={{
          fontSize: "18px",
          fontWeight: "700",
          marginBottom: "6px",
          color: "rgba(255,255,255,0.95)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "13px",
          color: color,
          marginBottom: "20px",
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {subtitle}
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              fontSize: "14px",
              color: "rgba(255,255,255,0.7)",
              padding: "8px 0",
              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              position: "relative",
              paddingLeft: "16px",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: "0",
                top: "50%",
                transform: "translateY(-50%)",
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                background: color,
                opacity: 0.6,
              }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GraphRelation({ from, relation, to }: { from: string; relation: string; to: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <span
        style={{
          fontSize: "14px",
          fontWeight: "500",
          color: "rgba(255,255,255,0.8)",
        }}
      >
        {from}
      </span>
      <span
        style={{
          fontSize: "12px",
          color: "#818cf8",
          padding: "4px 12px",
          background: "rgba(99, 102, 241, 0.1)",
          borderRadius: "20px",
        }}
      >
        {relation}
      </span>
      <span
        style={{
          fontSize: "14px",
          fontWeight: "500",
          color: "rgba(255,255,255,0.8)",
        }}
      >
        {to}
      </span>
    </div>
  );
}

function QuestionCard({ question }: { question: string }) {
  return (
    <div
      style={{
        padding: "32px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "flex-start",
        gap: "20px",
        transition: "all 0.3s ease",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        e.currentTarget.style.borderColor = "rgba(129, 140, 248, 0.3)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 12px 32px rgba(0, 0, 0, 0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Subtle gradient line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.4), transparent)",
        }}
      />
      
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.1))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#818cf8",
          boxShadow: "0 4px 16px rgba(99, 102, 241, 0.2)",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <p
        style={{
          fontSize: "16px",
          fontWeight: "600",
          lineHeight: "1.6",
          color: "rgba(255,255,255,0.9)",
          margin: 0,
        }}
      >
        {question}
      </p>
    </div>
  );
}
