import { v5 as uuidv5 } from "uuid";
import {
  Company,
  Brand,
  MaEvent,
  Filing,
  CompanySnapshot,
  ParentOfEdge,
  OwnsEdge,
  AcquiredEdge,
  WasAcquiredByEdge,
  FiledEdge,
  BusinessSegment,
  HasPublicDetailsEdge,
  HasSegmentsEdge,
} from "../types";

// Project namespace (Generated from "financial-knowledge-graph" using DNS namespace)
const NAMESPACE_UUID = "9a969fbc-5094-53d9-aa8a-3a4d34598705";

// Companies
export function generateCompanyId(company: Partial<Company>): string {
  if (
    (company.type === "public" || company.type === "issuer") &&
    company.identity?.cik
  ) {
    return uuidv5(`company:cik:${company.identity.cik}`, NAMESPACE_UUID);
  }

  if (company.type === "private") {
    const key = [
      "company:private",
      company.parent_company_id || "independent",
      company.name!,
      company.jurisdiction_raw || "unknown",
    ].join(":");
    return uuidv5(key, NAMESPACE_UUID);
  }

  throw new Error(
    "Invalid company type or missing required fields for ID generation"
  );
}

// Brands
export function generateBrandId(brand: Partial<Brand>): string {
  const key = `brand:${brand.owning_company_id}:${brand.name}`;
  return uuidv5(key, NAMESPACE_UUID);
}

// M&A Events
export function generateMaEventId(event: Partial<MaEvent>): string {
  const key = `ma_event:${event.acquirer_id}:${event.target_id}:${event.effective_date}`;
  return uuidv5(key, NAMESPACE_UUID);
}

// Filings
export function generateFilingId(filing: Partial<Filing>): string {
  return uuidv5(`filing:${filing.accession_number}`, NAMESPACE_UUID);
}

// Company Snapshots
export function generateSnapshotId(snapshot: Partial<CompanySnapshot>): string {
  const key = `snapshot:${snapshot.company_id}:${snapshot.valid_from}`;
  return uuidv5(key, NAMESPACE_UUID);
}

// Public Company Details
export function generatePublicCompanyDetailsId(companyId: string): string {
  return uuidv5(`public_details:${companyId}`, NAMESPACE_UUID);
}

// Business Segments
export function generateSegmentId(segment: Partial<BusinessSegment>): string {
  const key = `segment:${segment.company_id}:${segment.segment_name}:${
    segment.fiscal_year
  }:${segment.fiscal_quarter || "annual"}`;
  return uuidv5(key, NAMESPACE_UUID);
}

// Edges
export function generateParentOfEdgeId(edge: Partial<ParentOfEdge>): string {
  // Temporal Edge: If source_id (Filing ID) is present, include it.
  // This creates a distinct edge for each filing confirmation ("Snapshot").
  const source = edge.source_id ? `:${edge.source_id}` : "";
  const key = `parent_of:${edge.from_company_id}:${edge.to_company_id}${source}`;
  return uuidv5(key, NAMESPACE_UUID);
}

export function generateOwnsEdgeId(edge: Partial<OwnsEdge>): string {
  const key = `owns:${edge.from_company_id}:${edge.to_brand_id}`;
  return uuidv5(key, NAMESPACE_UUID);
}

export function generateAcquiredEdgeId(edge: Partial<AcquiredEdge>): string {
  const key = `acquired:${edge.from_company_id}:${edge.to_company_id}:${edge.ma_event_id}`;
  return uuidv5(key, NAMESPACE_UUID);
}

export function generateWasAcquiredByEdgeId(
  edge: Partial<WasAcquiredByEdge>
): string {
  const key = `was_acquired_by:${edge.from_company_id}:${edge.to_company_id}:${edge.ma_event_id}`;
  return uuidv5(key, NAMESPACE_UUID);
}

export function generateFiledEdgeId(edge: Partial<FiledEdge>): string {
  const key = `filed:${edge.from_company_id}:${edge.to_filing_id}`;
  return uuidv5(key, NAMESPACE_UUID);
}

export function generateHasPublicDetailsEdgeId(
  companyId: string,
  detailsId: string
): string {
  return uuidv5(`has_public_details:${companyId}:${detailsId}`, NAMESPACE_UUID);
}

export function generateHasSegmentsEdgeId(
  companyId: string,
  segmentId: string
): string {
  return uuidv5(`has_segments:${companyId}:${segmentId}`, NAMESPACE_UUID);
}
