export function GraphRelation({ from, relation, to }: { from: string; relation: string; to: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <span
        style={{
          fontSize: "13px",
          fontWeight: "500",
          color: "rgba(255,255,255,0.75)",
        }}
      >
        {from}
      </span>
      <span
        style={{
          fontSize: "11px",
          color: "#6366f1",
          padding: "3px 10px",
          background: "rgba(99, 102, 241, 0.08)",
          borderRadius: "4px",
          fontWeight: "500",
        }}
      >
        {relation}
      </span>
      <span
        style={{
          fontSize: "13px",
          fontWeight: "500",
          color: "rgba(255,255,255,0.75)",
        }}
      >
        {to}
      </span>
    </div>
  );
}
