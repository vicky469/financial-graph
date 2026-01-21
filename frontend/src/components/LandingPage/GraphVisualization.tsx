export function GraphVisualization() {
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
