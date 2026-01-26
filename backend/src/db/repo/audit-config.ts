/**
 * Audit Trail Configuration
 * 
 * Centralized configuration for audit trail tracking across all repositories.
 * This file makes it easy to see which tables and fields are being audited.
 * 
 * To enable audit trail:
 * 1. Set ENABLE_AUDIT_TRAIL=true in backend/.env
 * 2. Set AUDIT_RETENTION_DAYS=30 (or desired retention period)
 * 3. Add the entity to AUDIT_CONFIG below
 * 4. Import and use recordAudit() in the repo's upsert/update/delete functions
 */

export interface AuditEntityConfig {
  /** Entity type name (matches InstantDB schema) */
  entityType: string;
  /** Human-readable description */
  description: string;
  /** Whether audit trail is currently enabled */
  enabled: boolean;
  /** Fields that are tracked for changes (empty array = all fields) */
  trackedFields: string[];
  /** Operations that trigger audits */
  operations: ("CREATE" | "UPDATE" | "DELETE")[];
  /** Notes about implementation or special considerations */
  notes?: string;
}

/**
 * Audit Trail Configuration Registry
 * 
 * Add new entities here to enable audit tracking.
 */
export const AUDIT_CONFIG: Record<string, AuditEntityConfig> = {
  company: {
    entityType: "company",
    description: "Company entities (PUBLIC, ISSUER, SUBSIDIARY, etc.)",
    enabled: true,
    trackedFields: [], // All fields tracked
    operations: ["CREATE", "UPDATE"],
    notes: "Implemented in companies.ts upsertCompany()",
  },
  
  filing: {
    entityType: "filing",
    description: "SEC filings (10-K, 10-Q, etc.)",
    enabled: false,
    trackedFields: [],
    operations: ["CREATE", "UPDATE"],
    notes: "TODO: Add audit recording to filings.ts upsertFiling()",
  },
  
  parent_of: {
    entityType: "parent_of",
    description: "Parent-child relationships between companies",
    enabled: false,
    trackedFields: ["ownership_percent", "established_date", "ended_date"],
    operations: ["CREATE", "UPDATE", "DELETE"],
    notes: "TODO: Add audit recording to companies.ts linkParentChild()",
  },
  
  subsidiary_enrichment: {
    entityType: "subsidiary_enrichment",
    description: "LLM enrichments for subsidiary data",
    enabled: false,
    trackedFields: ["jurisdiction_iso", "jurisdiction_raw", "changed_by"],
    operations: ["CREATE", "UPDATE"],
    notes: "TODO: Add audit recording to enrichments.ts",
  },
  
  company_info: {
    entityType: "company_info",
    description: "Extended company information (addresses, phone, etc.)",
    enabled: false,
    trackedFields: [],
    operations: ["CREATE", "UPDATE"],
    notes: "TODO: Add audit recording to companies.ts upsertCompanyInfo()",
  },
  
  brand: {
    entityType: "brand",
    description: "Brand entities and relationships",
    enabled: false,
    trackedFields: [],
    operations: ["CREATE", "UPDATE", "DELETE"],
    notes: "TODO: Add audit recording to brands.ts",
  },
  
  segment: {
    entityType: "segment",
    description: "Business segments",
    enabled: false,
    trackedFields: [],
    operations: ["CREATE", "UPDATE", "DELETE"],
    notes: "TODO: Add audit recording to segments.ts",
  },
  
  notes: {
    entityType: "notes",
    description: "User notes (frontend-only, protected by InstantDB permissions)",
    enabled: false,
    trackedFields: [],
    operations: [],
    notes: "Notes are protected by InstantDB permissions. Audit trail not needed as users can only modify their own notes.",
  },
};

/**
 * Check if audit trail is enabled globally
 */
export function isAuditEnabled(): boolean {
  return process.env.ENABLE_AUDIT_TRAIL === "true";
}

/**
 * Check if audit trail is enabled for a specific entity
 */
export function isEntityAudited(entityType: string): boolean {
  if (!isAuditEnabled()) return false;
  const config = AUDIT_CONFIG[entityType];
  return config?.enabled ?? false;
}

/**
 * Get audit configuration for an entity
 */
export function getAuditConfig(entityType: string): AuditEntityConfig | undefined {
  return AUDIT_CONFIG[entityType];
}

/**
 * Get all enabled audit entities
 */
export function getEnabledAuditEntities(): AuditEntityConfig[] {
  return Object.values(AUDIT_CONFIG).filter(config => config.enabled);
}

/**
 * Get audit coverage summary
 */
export function getAuditCoverageSummary(): {
  total: number;
  enabled: number;
  disabled: number;
  coverage: string;
} {
  const configs = Object.values(AUDIT_CONFIG);
  const enabled = configs.filter(c => c.enabled).length;
  const total = configs.length;
  const disabled = total - enabled;
  const coverage = `${Math.round((enabled / total) * 100)}%`;
  
  return { total, enabled, disabled, coverage };
}
