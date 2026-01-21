export function FeatureCard({
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
        padding: "32px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.06)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "10px",
          background: "rgba(99, 102, 241, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
          color: "#6366f1",
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontSize: "18px",
          fontWeight: "600",
          marginBottom: "12px",
          color: "rgba(255,255,255,0.92)",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: "14px",
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
