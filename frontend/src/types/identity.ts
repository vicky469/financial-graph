import type { Node, PropertyValue } from "./domain";
import { GICS } from "./sec";

export const GICS_LABELS: Record<GICS, string> = {
  [GICS.INFORMATION_TECHNOLOGY]: "Information Technology",
  [GICS.ENERGY]: "Energy",
  [GICS.CONSUMER_DISCRETIONARY]: "Consumer Discretionary",
  [GICS.CONSUMER_STAPLES]: "Consumer Staples",
  [GICS.HEALTH_CARE]: "Health Care",
  [GICS.MATERIALS]: "Materials",
  [GICS.INDUSTRIALS]: "Industrials",
  [GICS.FINANCIALS]: "Financials",
  [GICS.COMMUNICATION_SERVICES]: "Communication Services",
  [GICS.UTILITIES]: "Utilities",
  [GICS.REAL_ESTATE]: "Real Estate",
};

export interface CompanyIdentitySnapshot {
  nodeId: string;
  name: string;
  cik?: string | null;
  jurisdiction?: string | null;
  sector?: GICS | null;
  industry?: string | null;
  parentCompanyId?: string | null;
  ownershipPercent?: number | null;
  lei?: string | null;
  figi?: string | null;
  segments?: string[];
}

export class CompanyIdentity {
  private readonly snapshot: CompanyIdentitySnapshot;

  constructor(snapshot: CompanyIdentitySnapshot) {
    this.snapshot = snapshot;
  }

  static fromNode(node: Node): CompanyIdentity {
    const props = node.properties ?? {};
    return new CompanyIdentity({
      nodeId: node.id,
      name: node.name,
      cik: node.cik ?? getString(props.cik),
      jurisdiction:
        node.jurisdiction ?? getString(props.jurisdiction_iso ?? props.jurisdiction_raw),
      sector: node.sector ?? mapSector(props.primary_sector ?? props.sector),
      industry: getString(props.primary_industry ?? props.industry),
      parentCompanyId: getString(props.company_id),
      ownershipPercent: getNumber(props.ownership_percent),
      lei: getString(props.lei),
      figi: getString(props.figi),
      segments: node.segments ?? getSegments(props.segments),
    });
  }

  static fromSnapshot(snapshot: CompanyIdentitySnapshot): CompanyIdentity {
    return new CompanyIdentity(snapshot);
  }

  get nodeId() {
    return this.snapshot.nodeId;
  }

  get name() {
    return this.snapshot.name;
  }

  get cik() {
    return this.snapshot.cik ?? undefined;
  }

  get jurisdiction() {
    return this.snapshot.jurisdiction ?? undefined;
  }

  get sector() {
    return this.snapshot.sector ?? null;
  }

  get sectorLabel() {
    return this.snapshot.sector ? GICS_LABELS[this.snapshot.sector] : undefined;
  }

  get industry() {
    return this.snapshot.industry ?? undefined;
  }

  get parentCompanyId() {
    return this.snapshot.parentCompanyId ?? undefined;
  }

  get ownershipPercent() {
    return this.snapshot.ownershipPercent ?? undefined;
  }

  get ownershipPercentLabel() {
    return this.snapshot.ownershipPercent != null
      ? `${this.snapshot.ownershipPercent}%`
      : undefined;
  }

  get lei() {
    return this.snapshot.lei ?? undefined;
  }

  get figi() {
    return this.snapshot.figi ?? undefined;
  }

  get segments() {
    return this.snapshot.segments ?? [];
  }

  toCoreIdentity() {
    return {
      cik: this.cik,
      jurisdiction: this.jurisdiction,
      sector: this.sectorLabel,
      industry: this.industry,
      segments: this.segments,
    };
  }

  toHierarchy() {
    return {
      parentCompanyId: this.parentCompanyId,
      ownershipPercent: this.ownershipPercentLabel,
    };
  }

  toExternalIdentifiers() {
    return {
      lei: this.lei,
      figi: this.figi,
    };
  }
}

function getString(value?: PropertyValue): string | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return String(value);
}

function getNumber(value?: PropertyValue): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getSegments(value?: PropertyValue): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    return value
      .split(/[,|]/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  }
  return undefined;
}

function mapSector(value?: PropertyValue): GICS | null {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase().replace(/\s+/g, "_");
  const fromEnum = (GICS as Record<string, GICS>)[normalized];
  if (fromEnum) return fromEnum;

  const alias = SECTOR_ALIAS[normalized];
  return alias ?? null;
}

const SECTOR_ALIAS: Record<string, GICS> = {
  TECHNOLOGY: GICS.INFORMATION_TECHNOLOGY,
  TECH: GICS.INFORMATION_TECHNOLOGY,
  HEALTHCARE: GICS.HEALTH_CARE,
  HEALTH_CARE: GICS.HEALTH_CARE,
  FINANCE: GICS.FINANCIALS,
  FINANCIAL: GICS.FINANCIALS,
  TELECOM: GICS.COMMUNICATION_SERVICES,
  COMMUNICATION: GICS.COMMUNICATION_SERVICES,
};
