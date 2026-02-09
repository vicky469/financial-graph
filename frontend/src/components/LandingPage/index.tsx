import { useState, useEffect } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { db, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_NAME } from "../../db/client";
import { FeatureCard } from "./FeatureCard";
import { EntityCard } from "./EntityCard";
import { GraphRelation } from "./GraphRelation";
import { QuestionCard } from "./QuestionCard";
import { ContactForm } from "./ContactForm";
import { GraphVisualization } from "./GraphVisualization";
import { NetworkBackground } from "./NetworkBackground";
import styles from "./LandingPage.module.css";

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
      const errorMessage =
        (err as { body?: { message?: string } })?.body?.message ||
        "Failed to sign in with Google. Please try again.";
      setError(errorMessage);
    }
  };

  const handleGoogleError = () => {
    setError("Google sign-in was cancelled or failed. Please try again.");
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className={styles.landingPage}>
        <NetworkBackground />

        {/* Hero Section */}
        <div
          className={`${styles.container} ${styles.heroSection}`}
          style={{ position: "relative", zIndex: 1 }}
        >
          {/* Logo / Brand */}
          <div className={styles.brand}>
            <svg
              width="56"
              height="56"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0 }}
            >
              {/* Connection lines */}
              <g
                stroke="rgba(150, 160, 190, 0.4)"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              >
                <line x1="50" y1="50" x2="75" y2="28" />
                <line x1="75" y1="28" x2="85" y2="42" />
                <line x1="50" y1="50" x2="28" y2="32" />
                <line x1="28" y1="32" x2="18" y2="52" />
                <line x1="50" y1="50" x2="70" y2="70" />
                <line x1="50" y1="50" x2="30" y2="70" />
              </g>

              {/* Nodes - muted blue-gray */}
              <circle
                cx="50"
                cy="50"
                r="6"
                fill="rgba(130, 150, 190, 0.6)"
                stroke="rgba(150, 170, 210, 0.4)"
                strokeWidth="1.5"
              />
              <circle
                cx="75"
                cy="28"
                r="4"
                fill="rgba(130, 150, 190, 0.4)"
                stroke="rgba(150, 170, 210, 0.3)"
                strokeWidth="1"
              />
              <circle
                cx="85"
                cy="42"
                r="3"
                fill="rgba(130, 150, 190, 0.3)"
                stroke="rgba(150, 170, 210, 0.2)"
                strokeWidth="1"
              />
              <circle
                cx="28"
                cy="32"
                r="4"
                fill="rgba(130, 150, 190, 0.4)"
                stroke="rgba(150, 170, 210, 0.3)"
                strokeWidth="1"
              />
              <circle
                cx="18"
                cy="52"
                r="3"
                fill="rgba(130, 150, 190, 0.3)"
                stroke="rgba(150, 170, 210, 0.2)"
                strokeWidth="1"
              />
              <circle
                cx="70"
                cy="70"
                r="3.5"
                fill="rgba(130, 150, 190, 0.35)"
                stroke="rgba(150, 170, 210, 0.25)"
                strokeWidth="1"
              />
              <circle
                cx="30"
                cy="70"
                r="3.5"
                fill="rgba(130, 150, 190, 0.35)"
                stroke="rgba(150, 170, 210, 0.25)"
                strokeWidth="1"
              />
            </svg>
            <span className={styles.brandName}>Financial Graph</span>
          </div>

          {/* Hero Content */}
          <div className={styles.heroGrid}>
            {/* Left: Text Content */}
            <div className={styles.heroText}>
              <h1 className={styles.heroTitle}>
                Understand how
                <br />
                <span className={styles.heroTitleGradient}>companies really operate</span>
              </h1>

              <p className={styles.heroDescription}>
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

              <div className={styles.heroCta}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "20px",
                  }}
                >
                  {/* Custom styled Google Login wrapper */}
                  <div className={styles.googleLoginWrapper}>
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
                    <div
                      className={styles.errorMessage}
                      style={{
                        padding: "12px 16px",
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        borderRadius: "8px",
                        color: "#ef4444",
                        fontSize: "14px",
                        textAlign: "center",
                        maxWidth: "320px",
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <div className={styles.trustInfo}>
                    <p className={styles.hintText}>We only store your email and profile photo.</p>
                    <p className={styles.hintTextSecondary}>
                      No access to contacts, drive, or other Google data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Visual Graph - Desktop only */}
            {!isMobile && (
              <div className={styles.heroGraph}>
                <GraphVisualization />
              </div>
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className={styles.sectionAlt}>
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionLabel}>Powered by Knowledge Graphs</h2>
            </div>

            <div className={styles.featuresGrid}>
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
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>The Data Model</h2>
            <p className={styles.sectionTitle}>A graph that captures business reality</p>
            <p className={styles.sectionSubtitle}>
              Moving beyond static lists to a connected knowledge graph that models how companies
              actually operate.
            </p>
          </div>

          <div className={styles.entityGrid}>
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

          <div className={styles.relationsContent}>
            <GraphRelation from="Legal Entity" relation="owns" to="Brand" />
            <GraphRelation from="Brand" relation="markets" to="Product" />
            <GraphRelation from="Product" relation="belongs to" to="Segment" />
          </div>
        </div>

        {/* Questions Section */}
        <div className={styles.sectionAlt}>
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>Questions we help you answer</p>
            </div>

            <div className={styles.questionsGrid}>
              <QuestionCard question="What does this subsidiary actually do?" />
              <QuestionCard question="Which brands sit under which legal entities?" />
              <QuestionCard question="How does this company really operate?" />
              <QuestionCard question="Where are the company's entities incorporated?" />
              <QuestionCard question="What's the ownership structure?" />
              <QuestionCard question="How do subsidiaries map to business lines?" />
            </div>
          </div>
        </div>

        {/* Contact / Schedule Section */}
        <div className={`${styles.container} ${styles.ctaSection}`}>
          <h2 className={styles.ctaTitle}>Have a custom use case?</h2>
          <p className={styles.ctaSubtitle}>
            Tell us about your financial data needs. Schedule a call or submit your interests and
            we&apos;ll follow up.
          </p>
          <ContactForm />
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerSocials}>
            {import.meta.env.VITE_LINKEDIN_URL && (
              <a
                href={import.meta.env.VITE_LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.footerIcon}
                aria-label="LinkedIn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            )}
            {import.meta.env.VITE_X_URL && (
              <a
                href={import.meta.env.VITE_X_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.footerIcon}
                aria-label="X"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            )}
          </div>
          <p>&copy; 2025-2026</p>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

// Sub-components
