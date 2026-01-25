import { memo } from "react";

// ============================================================================
// STATIC DATA - Defined outside components to avoid recreation on re-renders
// ============================================================================

const SUBSIDIARY_NODES = [
  { cx: 60, cy: 320, label: "UK", color: "#0d9488", size: 14, duration: "3s" },
  { cx: 130, cy: 290, label: "DE", color: "#d97706", size: 14, duration: "2.5s" },
  { cx: 270, cy: 290, label: "JP", color: "#059669", size: 14, duration: "4s" },
  { cx: 340, cy: 320, label: "CN", color: "#dc2626", size: 14, duration: "2s" },
] as const;

const FLOATING_PARTICLES = [
  { cx: 50, cy: 130, color: "#818cf8", size: 1.5, duration: "12s", opacity: 0.5 },
  { cx: 350, cy: 110, color: "#a78bfa", size: 1.5, duration: "10s", opacity: 0.45 },
  { cx: 25, cy: 250, color: "#f472b6", size: 1.5, duration: "11s", opacity: 0.4 },
  { cx: 200, cy: 410, color: "#fbbf24", size: 2, duration: "14s", opacity: 0.3 },
] as const;

const STATIC_PARTICLES = [
  { cx: 150, cy: 140, color: "#c084fc", size: 1, opacity: 0.35, duration: "4s" },
  { cx: 250, cy: 140, color: "#34d399", size: 1, opacity: 0.3, duration: "5s" },
  { cx: 300, cy: 380, color: "#10b981", size: 1.5, opacity: 0.3, duration: "5s" },
] as const;

const DATA_FLOW_PARTICLES = [
  { pathId: "#pathCorpFin", color: "#818cf8", size: 2.5, duration: "3s" },
  { pathId: "#pathCorpFin", color: "#f472b6", size: 2, duration: "3.5s", delay: "1.5s", reverse: true },
  { pathId: "#pathCorpTech", color: "#34d399", size: 2.5, duration: "3.5s", delay: "0.5s" },
  { pathId: "#pathCorpTech", color: "#a78bfa", size: 2, duration: "4s", delay: "2s", reverse: true },
  { pathId: "#pathFinTech", color: "#c084fc", size: 2, duration: "5s" },
  { pathId: "#pathFinOps", color: "#fbbf24", size: 2, duration: "4.5s", delay: "0.3s" },
  { pathId: "#pathTechOps", color: "#10b981", size: 2, duration: "5s", delay: "0.8s" },
] as const;

// Static styles injected once
const ANIMATION_CSS = `
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
`;

// ============================================================================
// MAIN COMPONENT - Memoized to prevent re-renders
// ============================================================================

export const GraphVisualization = memo(function GraphVisualization() {
  return (
    <div style={containerStyle}>
      <AmbientBackground />
      <GraphSVG />
      <style>{ANIMATION_CSS}</style>
    </div>
  );
});

const containerStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  pointerEvents: "none",
};

// ============================================================================
// AMBIENT BACKGROUND - CSS-animated divs (GPU accelerated)
// ============================================================================

const AmbientBackground = memo(function AmbientBackground() {
  return (
    <>
      <div style={ambientStyle1} />
      <div style={ambientStyle2} />
      <div style={ambientStyle3} />
    </>
  );
});

const ambientStyle1: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%) translateZ(0)",
  width: 320,
  height: 320,
  background: "radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)",
  borderRadius: "50%",
  animation: "breathe1 8s ease-in-out infinite",
  willChange: "transform, opacity",
};

const ambientStyle2: React.CSSProperties = {
  position: "absolute",
  top: "25%",
  left: "25%",
  transform: "translateZ(0)",
  width: 180,
  height: 180,
  background: "radial-gradient(circle, rgba(236, 72, 153, 0.08) 0%, transparent 70%)",
  borderRadius: "50%",
  animation: "breathe2 10s ease-in-out infinite",
  willChange: "transform, opacity",
};

const ambientStyle3: React.CSSProperties = {
  position: "absolute",
  top: "60%",
  right: "15%",
  transform: "translateZ(0)",
  width: 200,
  height: 200,
  background: "radial-gradient(circle, rgba(20, 184, 166, 0.07) 0%, transparent 70%)",
  borderRadius: "50%",
  animation: "breathe3 9s ease-in-out infinite",
  willChange: "transform, opacity",
};

// ============================================================================
// MAIN SVG - All animations are native SVG SMIL (GPU accelerated)
// ============================================================================

const GraphSVG = memo(function GraphSVG() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 400 420"
      fill="none"
      style={svgStyle}
    >
      <defs>
        <Gradients />
        <Filters />
      </defs>
      <OrbitalSystem />
      <ConnectionNetwork />
      <DataFlowParticles />
      <MainNodes />
      <SubsidiaryNodes />
      <AmbientParticles />
    </svg>
  );
});

const svgStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  transform: "translateZ(0)", // Force GPU layer
};

// ============================================================================
// SVG DEFINITIONS - Static, rendered once
// ============================================================================

const Gradients = memo(function Gradients() {
  return (
    <>
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
      <linearGradient id="edgeAB" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="rgba(129, 140, 248, 0.5)" />
        <stop offset="50%" stopColor="rgba(192, 132, 252, 0.3)" />
        <stop offset="100%" stopColor="rgba(244, 114, 182, 0.5)" />
      </linearGradient>
      <linearGradient id="edgeAC" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgba(129, 140, 248, 0.4)" />
        <stop offset="100%" stopColor="rgba(52, 211, 153, 0.4)" />
      </linearGradient>
    </>
  );
});

const Filters = memo(function Filters() {
  return (
    <>
      <filter id="glow1" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glow2" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="particleGlow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="1.5" />
      </filter>
    </>
  );
});

// ============================================================================
// ORBITAL SYSTEM - Rotating ellipses
// ============================================================================

const OrbitalSystem = memo(function OrbitalSystem() {
  return (
    <g>
      <ellipse cx="200" cy="210" rx="175" ry="65" fill="none" stroke="rgba(99, 102, 241, 0.06)" strokeWidth="1">
        <animateTransform attributeName="transform" type="rotate" from="0 200 210" to="360 200 210" dur="90s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="200" cy="210" rx="130" ry="50" fill="none" stroke="rgba(236, 72, 153, 0.05)" strokeWidth="1">
        <animateTransform attributeName="transform" type="rotate" from="360 200 210" to="0 200 210" dur="75s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="200" cy="210" rx="90" ry="35" fill="none" stroke="rgba(52, 211, 153, 0.04)" strokeWidth="1">
        <animateTransform attributeName="transform" type="rotate" from="0 200 210" to="360 200 210" dur="60s" repeatCount="indefinite" />
      </ellipse>
    </g>
  );
});

// ============================================================================
// CONNECTION NETWORK - Static paths for particle motion
// ============================================================================

const ConnectionNetwork = memo(function ConnectionNetwork() {
  return (
    <g>
      <path id="pathCorpFin" d="M200 100 C140 130 100 150 80 190" stroke="url(#edgeAB)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path id="pathCorpTech" d="M200 100 C260 130 300 150 320 190" stroke="url(#edgeAC)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path id="pathFinOps" d="M95 210 C140 280 180 300 200 340" stroke="rgba(244, 114, 182, 0.2)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path id="pathTechOps" d="M305 210 C260 280 220 300 200 340" stroke="rgba(52, 211, 153, 0.2)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path id="pathFinTech" d="M105 195 C150 160 250 160 295 195" stroke="rgba(192, 132, 252, 0.15)" strokeWidth="1" fill="none" strokeLinecap="round" strokeDasharray="6 4" />
      <path d="M65 220 Q50 270 60 310" stroke="rgba(244, 114, 182, 0.15)" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M335 220 Q350 270 340 310" stroke="rgba(52, 211, 153, 0.15)" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M75 320 Q130 380 200 370 Q270 380 325 320" stroke="rgba(251, 191, 36, 0.1)" strokeWidth="1" fill="none" strokeLinecap="round" strokeDasharray="3 5" />
    </g>
  );
});

// ============================================================================
// DATA FLOW PARTICLES - Animated along paths
// ============================================================================

const DataFlowParticles = memo(function DataFlowParticles() {
  return (
    <g>
      {DATA_FLOW_PARTICLES.map((p, i) => (
        <Particle key={i} {...p} />
      ))}
    </g>
  );
});

interface ParticleProps {
  pathId: string;
  color: string;
  size: number;
  duration: string;
  delay?: string;
  reverse?: boolean;
}

const Particle = memo(function Particle({ pathId, color, size, duration, delay = "0s", reverse = false }: ParticleProps) {
  return (
    <circle r={size} fill={color} filter="url(#particleGlow)" opacity="0">
      {reverse ? (
        <animateMotion dur={duration} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" begin={delay}>
          <mpath href={pathId} />
        </animateMotion>
      ) : (
        <animateMotion dur={duration} repeatCount="indefinite" begin={delay}>
          <mpath href={pathId} />
        </animateMotion>
      )}
      <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={delay} fill="freeze" />
    </circle>
  );
});

// ============================================================================
// MAIN NODES - CORP, FIN, TECH, OPS
// ============================================================================

const MainNodes = memo(function MainNodes() {
  return (
    <>
      {/* CORP - Central hub */}
      <g filter="url(#glow1)">
        <circle cx="200" cy="75" r="50" fill="url(#hubGlow)">
          <animate attributeName="r" values="45;55;45" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="200" cy="75" r="30" fill="url(#corpGradient)">
          <animate attributeName="r" values="30;32;30" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="200" cy="75" r="30" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none" />
        <circle cx="200" cy="75" r="38" stroke="rgba(129, 140, 248, 0.4)" strokeWidth="1.5" fill="none" strokeDasharray="8 12">
          <animateTransform attributeName="transform" type="rotate" from="0 200 75" to="360 200 75" dur="15s" repeatCount="indefinite" />
        </circle>
        <text x="200" y="79" textAnchor="middle" fill="white" fontSize="11" fontWeight="600" fontFamily="system-ui">CORP</text>
      </g>

      {/* FIN - Finance hub */}
      <g filter="url(#glow2)">
        <circle cx="80" cy="195" r="24" fill="url(#financeGradient)">
          <animate attributeName="r" values="24;26;24" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="80" cy="195" r="24" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
        <circle cx="80" cy="195" r="30" stroke="rgba(244, 114, 182, 0.3)" strokeWidth="1" fill="none">
          <animate attributeName="r" values="28;34;28" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
        <text x="80" y="199" textAnchor="middle" fill="white" fontSize="9" fontWeight="500" fontFamily="system-ui">FIN</text>
      </g>

      {/* TECH - Technology hub */}
      <g filter="url(#glow2)">
        <circle cx="320" cy="195" r="24" fill="url(#techGradient)">
          <animate attributeName="r" values="24;27;24" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="320" cy="195" r="24" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
        <circle cx="320" cy="195" r="32" stroke="rgba(52, 211, 153, 0.25)" strokeWidth="1" fill="none" strokeDasharray="4 8">
          <animateTransform attributeName="transform" type="rotate" from="0 320 195" to="360 320 195" dur="8s" repeatCount="indefinite" />
        </circle>
        <circle cx="320" cy="195" r="36" stroke="rgba(52, 211, 153, 0.15)" strokeWidth="1" fill="none" strokeDasharray="2 10">
          <animateTransform attributeName="transform" type="rotate" from="360 320 195" to="0 320 195" dur="12s" repeatCount="indefinite" />
        </circle>
        <text x="320" y="199" textAnchor="middle" fill="white" fontSize="9" fontWeight="500" fontFamily="system-ui">TECH</text>
      </g>

      {/* OPS - Operations hub */}
      <g filter="url(#glow2)">
        <circle cx="200" cy="350" r="26" fill="url(#opsGradient)">
          <animate attributeName="r" values="26;29;26" dur="5s" repeatCount="indefinite" />
        </circle>
        <circle cx="200" cy="350" r="26" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
        <circle cx="200" cy="350" r="34" stroke="rgba(251, 191, 36, 0.2)" strokeWidth="1" fill="none">
          <animate attributeName="r" values="32;42;32" dur="5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.05;0.3" dur="5s" repeatCount="indefinite" />
        </circle>
        <text x="200" y="354" textAnchor="middle" fill="white" fontSize="9" fontWeight="500" fontFamily="system-ui">OPS</text>
      </g>
    </>
  );
});

// ============================================================================
// SUBSIDIARY NODES - UK, DE, JP, CN
// ============================================================================

const SubsidiaryNodes = memo(function SubsidiaryNodes() {
  return (
    <>
      {SUBSIDIARY_NODES.map((node) => (
        <g key={node.label}>
          <circle cx={node.cx} cy={node.cy} r={node.size} fill={node.color}>
            <animate
              attributeName="r"
              values={node.label === "CN" ? "14;16;13;14" : `${node.size};${node.size + 1};${node.size}`}
              dur={node.duration}
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={node.cx} cy={node.cy} r={node.size} stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
          <text x={node.cx} y={node.cy + 3} textAnchor="middle" fill="white" fontSize="8" fontWeight="600" fontFamily="system-ui">
            {node.label}
          </text>
        </g>
      ))}
    </>
  );
});

// ============================================================================
// AMBIENT PARTICLES - Floating background particles
// ============================================================================

const AmbientParticles = memo(function AmbientParticles() {
  return (
    <g>
      {FLOATING_PARTICLES.map((p, i) => (
        <circle key={`float-${i}`} cx={p.cx} cy={p.cy} r={p.size} fill={p.color} opacity={p.opacity}>
          <animate attributeName="cx" values={`${p.cx};${p.cx + 20};${p.cx - 5};${p.cx}`} dur={p.duration} repeatCount="indefinite" />
          <animate attributeName="cy" values={`${p.cy};${p.cy + 15};${p.cy - 10};${p.cy}`} dur={p.duration} repeatCount="indefinite" />
          <animate attributeName="opacity" values={`${p.opacity};${p.opacity - 0.4};${p.opacity - 0.1};${p.opacity}`} dur="4s" repeatCount="indefinite" />
        </circle>
      ))}
      {STATIC_PARTICLES.map((p, i) => (
        <circle key={`static-${i}`} cx={p.cx} cy={p.cy} r={p.size} fill={p.color} opacity={p.opacity}>
          <animate attributeName="opacity" values={`${p.opacity};${p.opacity - 0.3};${p.opacity}`} dur={p.duration} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
});
