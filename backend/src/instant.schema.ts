// Current schema - only entities currently in use
// For future M&A tracking entities, see instant.schema.future.ts
// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/core";

const _schema = i.schema({
  entities: {
    // InstantDB system entities
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),

    // === CURRENTLY USED ENTITIES ===
    company: i.entity({
      composite_key: i.string().unique().indexed(), // Computed: "1:cik" OR "2:name:jurisdiction"
      name: i.string().indexed(),
      type: i.number().indexed(), // 1=public, 2=private, 3=issuer, 4=unknown
      jurisdiction_raw: i.string().optional(),
      identity: i.json().optional(), // { cik: string[] } for public/issuer companies
      jurisdiction_iso: i.string().optional(),
      aliases: i.json().optional(),
      created_at: i.string().optional(),
      updated_at: i.string().optional(),
    }),
    filing: i.entity({
      accession_number: i.string().unique().indexed().optional(),
      accession_number_nodashes: i.string().indexed().optional(),
      attachments: i.json().optional(),
      created_at: i.string().optional(),
      file_name: i.string().optional(),
      file_url: i.string().optional(),
      filing_date: i.string().indexed().optional(),
      fiscal_quarter: i.number().indexed().optional(), // Reported period (from document, not filing date)
      fiscal_year: i.number().indexed().optional(), // Reported period (from document, not filing date)
      form_type: i.string().indexed().optional(),
      period_end_date: i.string().optional(),
      source_quarter: i.number().indexed().optional(), // When filed: 1-4
      source_year: i.number().indexed().optional(), // When filed: e.g., 2025
      updated_at: i.string().optional(),
    }),
    parent_of: i.entity({
      composite_key: i.string().unique().indexed(), // base64("{parent_id}:{subsidiary_id}:{established_date}")
      created_at: i.string(),
      ended_date: i.string().indexed().optional(),
      established_date: i.string().indexed(),
      ownership_percent: i.number().optional(),
      source: i.number().indexed(), // 1=ma_event, 2=spinoff, 3=ipo, 4=manual, 5=sec_filing
      updated_at: i.string(),
    }),
    subsidiary_enrichment: i.entity({
      composite_key: i.string().unique().indexed(), // base64("{company_id}:{filing_id}")
      created_at: i.string(),
      footnoteRefs: i.json(),
      footnotesHtml: i.string().optional(),
      llmEnriched: i.boolean().indexed(),
      llmEnrichedAt: i.string().optional(),
      updated_at: i.string(),
    }),
    company_info: i.entity({
      created_at: i.string(),
      founded_date: i.string().optional(),
      industry_sector: i.string().indexed().optional(),
      sic_code: i.string().indexed().optional(),
      updated_at: i.string(),
    }),
    business_segment: i.entity({
      composite_key: i.string().unique().indexed(), // base64("{company_id}:{segment_name}:{fiscal_year}:{fiscal_quarter}")
      assets: i.number().optional(),
      created_at: i.string(),
      description: i.string(),
      fiscal_quarter: i.number().optional(),
      fiscal_year: i.number().indexed(),
      is_reportable: i.boolean(),
      operating_income: i.number().optional(),
      revenue: i.number().optional(),
      segment_name: i.string().indexed(),
      segment_type: i.string().indexed(),
      updated_at: i.string(),
    }),
    brand: i.entity({
      composite_key: i.string().unique().indexed(), // base64("{owning_company_id}:{name}") - unique per company
      category: i.string().indexed().optional(),
      created_at: i.string(),
      launch_date: i.string().optional(),
      name: i.string().indexed(),
      status: i.string().indexed(),
      updated_at: i.string(),
    }),
    owns: i.entity({
      composite_key: i.string().unique().indexed(), // base64("{company_id}:{brand_id}")
      acquired_date: i.string().optional(),
      created_at: i.string(),
      divested_date: i.string().indexed().optional(),
      updated_at: i.string(),
    }),

    // Audit trail (optional - can be disabled via ENABLE_AUDIT_TRAIL=false)
    audit: i.entity({
      changed_at: i.string().indexed(),
      changed_by: i.string().indexed(),
      entity_id: i.string().indexed(),
      entity_type: i.string().indexed(),
      expires_at: i.string().indexed(),
      fields_changed: i.json(),
      operation: i.string().indexed(),
      source_id: i.string().indexed().optional(),
    }),
  },
  links: {
    // Company -> Filing
    filing: {
      forward: {
        on: "company",
        has: "many",
        label: "filings",
      },
      reverse: {
        on: "filing",
        has: "one",
        label: "company",
      },
    },
    // Parent company link (parent_of.parentCompany -> company)
    parentCompany: {
      forward: {
        on: "parent_of",
        has: "one",
        label: "parentCompany",
      },
      reverse: {
        on: "company",
        has: "many",
        label: "subsidiaries",
      },
    },
    // Subsidiary company link (parent_of.subsidiaryCompany -> company)
    subsidiaryCompany: {
      forward: {
        on: "parent_of",
        has: "one",
        label: "subsidiaryCompany",
      },
      reverse: {
        on: "company",
        has: "many", //Temporal tracking: a company could have different parents over time 
        label: "parents",
      },
    },
    // Company -> Subsidiary Enrichment
    subsidiaryEnrichment: {
      forward: {
        on: "company",
        has: "many",
        label: "subsidiaryEnrichments",
      },
      reverse: {
        on: "subsidiary_enrichment",
        has: "one",
        label: "company",
      },
    },
    // Filing -> Subsidiary Enrichment
    filingEnrichment: {
      forward: {
        on: "filing",
        has: "many",
        label: "subsidiaryEnrichments",
      },
      reverse: {
        on: "subsidiary_enrichment",
        has: "one",
        label: "filing",
      },
    },
    // Company -> Company Info
    companyInfo: {
      forward: {
        on: "company",
        has: "one",
        label: "companyInfo",
      },
      reverse: {
        on: "company_info",
        has: "one",
        label: "company",
      },
    },
    // Company -> Business Segment
    businessSegment: {
      forward: {
        on: "company",
        has: "many",
        label: "businessSegments",
      },
      reverse: {
        on: "business_segment",
        has: "one",
        label: "company",
      },
    },
    // Company -> Brand (direct ownership link)
    brandOwner: {
      forward: {
        on: "company",
        has: "many",
        label: "brands",
      },
      reverse: {
        on: "brand",
        has: "one",
        label: "owningCompany",
      },
    },
    // Company -> Brand (via owns edge for historical tracking)
    ownsLink: {
      forward: {
        on: "owns",
        has: "one",
        label: "company",
      },
      reverse: {
        on: "company",
        has: "many",
        label: "ownedBrands",
      },
    },
    // Brand -> Owns
    brandOwnership: {
      forward: {
        on: "owns",
        has: "one",
        label: "brand",
      },
      reverse: {
        on: "brand",
        has: "many",
        label: "ownership",
      },
    },
  },
  rooms: {},
});

// This helps Typescript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
