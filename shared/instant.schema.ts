// Shared InstantDB schema
// Used by both backend and frontend
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
      name: i.string().indexed(),
      type: i.number().indexed(), // 1=public, 2=private, 3=issuer, 4=unknown, 5=trust
      jurisdiction_raw: i.string().optional(),
      jurisdiction_iso: i.string().optional(),
      aliases: i.json().optional(),
      identity: i.json().optional(),
      updated_at: i.string(),
    }),
    filing: i.entity({
      accession_number: i.string().unique(),
      accession_number_nodashes: i.string().unique().indexed(),
      file_url: i.string(),
      form_type: i.string().indexed(),
      source_quarter: i.number().indexed(), // When filed: 1-4
      source_year: i.number().indexed(), // When filed: e.g., 2025
      filing_date: i.string().indexed(), // Date when filed with SEC
      period_of_report: i.string().optional(), // Period end date from the filing (renamed from period_end_date)
      attachments: i.json().optional(),
      file_name: i.string().optional(),
      updated_at: i.string(),
    }),
    parent_of: i.entity({
      source: i.number().indexed(), // 1=ma_event, 2=spinoff, 3=ipo, 4=manual, 5=sec_filing
      ownership_percent: i.number().optional(),
      established_date: i.string().optional(),
      ended_date: i.string().optional(),
      updated_at: i.string(),
    }),
    subsidiary_enrichment: i.entity({
      footnoteRefs: i.json(),
      footnotesHtml: i.string(),
      updated_at: i.string(),
    }),
    company_info: i.entity({
      fiscal_year_end: i.string().optional(),
      addresses: i.json().optional(),
      phone: i.string().optional(),
      former_names: i.json().optional(),
      updated_at: i.string(),
    }),
    brand: i.entity({
      category: i.string().indexed().optional(),
      created_at: i.string(),
      launch_date: i.string().optional(),
      name: i.string().indexed(),
      status: i.string().indexed(),
      updated_at: i.string(),
    }),
    owns: i.entity({
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

    // Notes - rich text notes associated with companies
    notes: i.entity({
      content: i.json(), // Tiptap JSON document
      createdAt: i.string().indexed(),
      updatedAt: i.string(),
      createdBy: i.string(), // 'user' or 'system'
      mentionedCompanyIds: i.json().optional(), // Array of company IDs mentioned in the note
      visibility: i.string().indexed(), // 'private' or 'public', defaults to 'private'
    }),
  },
  links: {
    // Company -> Filing (many-to-many: multiple companies can file the same document)
    filing: {
      forward: {
        on: "company",
        has: "many",
        label: "filings",
      },
      reverse: {
        on: "filing",
        has: "many",
        label: "companies",
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
    // Source filing link (parent_of.sourceFiling -> filing, when source=5/sec_filing)
    sourceFiling: {
      forward: {
        on: "parent_of",
        has: "one",
        label: "sourceFiling",
      },
      reverse: {
        on: "filing",
        has: "many",
        label: "parentOfEdges",
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
    // Note -> User (many notes per user)
    noteUser: {
      forward: {
        on: "notes",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "notes",
      },
    },
    // Note -> Company (many notes per company)
    noteCompany: {
      forward: {
        on: "notes",
        has: "one",
        label: "company",
      },
      reverse: {
        on: "company",
        has: "many",
        label: "notes",
      },
    },
    // // Company -> Brand (direct ownership link)
    // brandOwner: {
    //   forward: {
    //     on: "company",
    //     has: "many",
    //     label: "brands",
    //   },
    //   reverse: {
    //     on: "brand",
    //     has: "one",
    //     label: "owningCompany",
    //   },
    // },
    // // Company -> Brand (via owns edge for historical tracking)
    // ownsLink: {
    //   forward: {
    //     on: "owns",
    //     has: "one",
    //     label: "company",
    //   },
    //   reverse: {
    //     on: "company",
    //     has: "many",
    //     label: "ownedBrands",
    //   },
    // },
    // // Brand -> Owns
    // brandOwnership: {
    //   forward: {
    //     on: "owns",
    //     has: "one",
    //     label: "brand",
    //   },
    //   reverse: {
    //     on: "brand",
    //     has: "many",
    //     label: "ownership",
    //   },
    // },
  },
  rooms: {},
});

// This helps Typescript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
