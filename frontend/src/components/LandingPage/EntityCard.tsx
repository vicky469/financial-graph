export function EntityCard({
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
        padding: "24px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.06)",
        borderTop: `2px solid ${color}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: "600",
          marginBottom: "4px",
          color: "rgba(255,255,255,0.92)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "12px",
          color: color,
          marginBottom: "16px",
          fontWeight: "500",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
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
              fontSize: "13px",
              color: "rgba(255,255,255,0.6)",
              padding: "6px 0",
              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
              position: "relative",
              paddingLeft: "14px",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: "0",
                top: "50%",
                transform: "translateY(-50%)",
                width: "3px",
                height: "3px",
                borderRadius: "50%",
                background: color,
                opacity: 0.5,
              }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
