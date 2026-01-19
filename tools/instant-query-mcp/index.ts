#!/usr/bin/env bun
/**
 * InstantDB Query MCP Server
 *
 * Provides tools for querying InstantDB from Claude Code.
 * Like a Jupyter notebook for your database!
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { init } from "@instantdb/admin";

// Load environment variables
const APP_ID = process.env.INSTANT_APP_ID || "2ed56b09-a3ed-49d8-984d-94723a57070c";
const ADMIN_SECRET = process.env.INSTANT_ADMIN_SECRET || "319c6427-bcf5-4718-ae7d-0f5db16b1c3b";

// Initialize InstantDB admin client
const db = init({
  appId: APP_ID,
  adminToken: ADMIN_SECRET,
});

// Schema info for reference
const SCHEMA_INFO = {
  entities: {
    company: {
      fields: ["id", "name", "type", "jurisdiction_raw", "jurisdiction_iso", "aliases", "identity", "updated_at"],
      description: "Companies (public, private, issuer, trust)",
      typeValues: "1=public, 2=private, 3=issuer, 4=unknown, 5=trust",
    },
    filing: {
      fields: ["id", "accession_number", "file_url", "form_type", "source_quarter", "source_year", "filing_date", "attachments", "fiscal_quarter", "fiscal_year", "period_end_date", "updated_at"],
      description: "SEC filings",
    },
    parent_of: {
      fields: ["id", "source", "ownership_percent", "established_date", "ended_date", "updated_at"],
      description: "Parent-subsidiary relationships",
      sourceValues: "1=ma_event, 2=spinoff, 3=ipo, 4=manual, 5=sec_filing",
    },
    subsidiary_enrichment: {
      fields: ["id", "footnoteRefs", "footnotesHtml", "llmEnriched", "llmEnrichedAt", "updated_at"],
      description: "Enrichment data for subsidiaries",
    },
    audit: {
      fields: ["id", "changed_at", "changed_by", "entity_id", "entity_type", "expires_at", "fields_changed", "operation", "source_id"],
      description: "Audit trail",
    },
  },
  links: {
    "company.filings": "Filing[] - SEC filings for this company",
    "company.subsidiaries": "parent_of[] - Where this company is the parent",
    "company.parents": "parent_of[] - Where this company is the subsidiary",
    "filing.companies": "Company[] - Companies associated with this filing",
    "parent_of.parentCompany": "Company - The parent company",
    "parent_of.subsidiaryCompany": "Company - The subsidiary company",
    "parent_of.sourceFiling": "Filing - The source filing (when source=5)",
  },
};

// Create the MCP server
const server = new Server(
  {
    name: "instant-query",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: `Run an InstaQL query against InstantDB. Returns JSON results.

Example queries:
- Get companies: { company: { $: { limit: 10 } } }
- Get company by name: { company: { $: { where: { name: "Apple Inc" } } } }
- Get company with subsidiaries: { company: { $: { where: { id: "xxx" } }, subsidiaries: { subsidiaryCompany: {} } } }
- Get filings: { filing: { $: { where: { form_type: "10-K" }, limit: 5 } } }
- Count query: Use limit: 1 and check the response metadata`,
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "object",
              description: "InstaQL query object. See InstantDB docs for syntax.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "schema",
        description: "Get the database schema information including entities, fields, and links.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "count",
        description: "Count entities of a given type, optionally with a where clause.",
        inputSchema: {
          type: "object",
          properties: {
            entity: {
              type: "string",
              description: "Entity type to count (company, filing, parent_of, etc.)",
            },
            where: {
              type: "object",
              description: "Optional where clause for filtering",
            },
          },
          required: ["entity"],
        },
      },
      {
        name: "sample",
        description: "Get a sample of records from an entity to understand the data structure.",
        inputSchema: {
          type: "object",
          properties: {
            entity: {
              type: "string",
              description: "Entity type to sample (company, filing, parent_of, etc.)",
            },
            limit: {
              type: "number",
              description: "Number of records to return (default: 3)",
            },
          },
          required: ["entity"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "query": {
        const query = args?.query as Record<string, unknown>;
        if (!query) {
          return {
            content: [{ type: "text", text: "Error: query parameter is required" }],
          };
        }

        const result = await db.query(query);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2),
          }],
        };
      }

      case "schema": {
        return {
          content: [{
            type: "text",
            text: JSON.stringify(SCHEMA_INFO, null, 2),
          }],
        };
      }

      case "count": {
        const entity = args?.entity as string;
        const where = args?.where as Record<string, unknown> | undefined;

        if (!entity) {
          return {
            content: [{ type: "text", text: "Error: entity parameter is required" }],
          };
        }

        const query: Record<string, unknown> = {
          [entity]: where ? { $: { where } } : {},
        };

        const result = await db.query(query);
        const data = result[entity] as unknown[];

        return {
          content: [{
            type: "text",
            text: `Count of ${entity}${where ? " (filtered)" : ""}: ${data?.length ?? 0}`,
          }],
        };
      }

      case "sample": {
        const entity = args?.entity as string;
        const limit = (args?.limit as number) || 3;

        if (!entity) {
          return {
            content: [{ type: "text", text: "Error: entity parameter is required" }],
          };
        }

        const query: Record<string, unknown> = {
          [entity]: { $: { limit } },
        };

        const result = await db.query(query);
        const data = result[entity] as unknown[];

        return {
          content: [{
            type: "text",
            text: `Sample of ${entity} (${data?.length ?? 0} records):\n${JSON.stringify(data, null, 2)}`,
          }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
        };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("InstantDB Query MCP Server running on stdio");
}

main().catch(console.error);
