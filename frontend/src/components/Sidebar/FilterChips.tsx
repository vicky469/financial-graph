import { X } from "lucide-react";

interface FilterChipsProps {
  filters: {
    categories: string[];
    ownerOrgs: string[];
    entityTypes: string[];
  };
  onRemoveCategory: (value: string) => void;
  onRemoveOwnerOrg: (value: string) => void;
  onRemoveEntityType: (value: string) => void;
  onClearAll: () => void;
}

export function FilterChips({
  filters,
  onRemoveCategory,
  onRemoveOwnerOrg,
  onRemoveEntityType,
  onClearAll,
}: FilterChipsProps) {
  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.ownerOrgs.length > 0 ||
    filters.entityTypes.length > 0;

  if (!hasActiveFilters) return null;

  return (
    <div style={{ padding: "0 16px 12px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Active Filters
        </span>
        <button
          onClick={onClearAll}
          style={{
            fontSize: "11px",
            color: "rgba(99, 102, 241, 0.8)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 4px",
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(99, 102, 241, 1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(99, 102, 241, 0.8)";
          }}
        >
          Clear All
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
        }}
      >
        {filters.categories.map((category) => (
          <Chip
            key={`cat-${category}`}
            label={category}
            onRemove={() => onRemoveCategory(category)}
          />
        ))}
        {filters.ownerOrgs.map((org) => (
          <Chip
            key={`org-${org}`}
            label={org}
            onRemove={() => onRemoveOwnerOrg(org)}
          />
        ))}
        {filters.entityTypes.map((type) => (
          <Chip
            key={`type-${type}`}
            label={type}
            onRemove={() => onRemoveEntityType(type)}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 8px",
        borderRadius: "4px",
        background: "rgba(99, 102, 241, 0.15)",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        fontSize: "11px",
        color: "rgba(99, 102, 241, 0.9)",
        fontWeight: 500,
      }}
    >
      <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <button
        onClick={onRemove}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          color: "inherit",
          opacity: 0.7,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.7";
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
