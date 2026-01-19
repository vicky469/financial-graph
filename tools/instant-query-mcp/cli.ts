#!/usr/bin/env bun
/**
 * InstantDB Query CLI
 *
 * Usage:
 *   bun run cli.ts query '{ "company": { "$": { "limit": 5 } } }'
 *   bun run cli.ts count company
 *   bun run cli.ts sample filing 3
 *   bun run cli.ts schema
 *   bun run cli.ts repl  # Interactive mode
 */

import { init } from "@instantdb/admin";
import * as readline from "readline";

// Load environment variables
const APP_ID = process.env.INSTANT_APP_ID || "2ed56b09-a3ed-49d8-984d-94723a57070c";
const ADMIN_SECRET = process.env.INSTANT_ADMIN_SECRET || "319c6427-bcf5-4718-ae7d-0f5db16b1c3b";

// Initialize InstantDB admin client
const db = init({
  appId: APP_ID,
  adminToken: ADMIN_SECRET,
});

const SCHEMA_INFO = {
  entities: {
    company: ["id", "name", "type (1=public,2=private,3=issuer,4=unknown,5=trust)", "jurisdiction_raw", "jurisdiction_iso", "aliases", "identity", "updated_at"],
    filing: ["id", "accession_number", "file_url", "form_type", "filing_date", "period_of_report"],
    parent_of: ["id", "source (1=ma,2=spinoff,3=ipo,4=manual,5=sec_filing)", "ownership_percent", "established_date", "ended_date"],
    subsidiary_enrichment: ["id", "footnoteRefs", "footnotesHtml", "llmEnriched"],
    audit: ["id", "changed_at", "changed_by", "entity_id", "entity_type", "operation"],
  },
  links: {
    "company.filings": "filings for this company",
    "company.subsidiaries": "parent_of edges where this is parent",
    "company.parents": "parent_of edges where this is subsidiary",
    "parent_of.parentCompany": "the parent company",
    "parent_of.subsidiaryCompany": "the subsidiary company",
    "parent_of.sourceFiling": "source filing when source=5",
  },
};

async function runQuery(queryStr: string) {
  try {
    const query = JSON.parse(queryStr);
    const result = await db.query(query);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }
}

async function count(entity: string, whereStr?: string) {
  try {
    const where = whereStr ? JSON.parse(whereStr) : undefined;
    const query: Record<string, unknown> = {
      [entity]: where ? { $: { where } } : {},
    };
    const result = await db.query(query);
    const data = result[entity] as unknown[];
    console.log(`Count of ${entity}: ${data?.length ?? 0}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }
}

async function sample(entity: string, limit = 3) {
  try {
    const query: Record<string, unknown> = {
      [entity]: { $: { limit } },
    };
    const result = await db.query(query);
    console.log(JSON.stringify(result[entity], null, 2));
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }
}

function showSchema() {
  console.log("\n=== InstantDB Schema ===\n");
  console.log("ENTITIES:");
  for (const [entity, fields] of Object.entries(SCHEMA_INFO.entities)) {
    console.log(`  ${entity}:`);
    for (const field of fields) {
      console.log(`    - ${field}`);
    }
  }
  console.log("\nLINKS:");
  for (const [link, desc] of Object.entries(SCHEMA_INFO.links)) {
    console.log(`  ${link}: ${desc}`);
  }
  console.log("\nEXAMPLE QUERIES:");
  console.log('  { "company": { "$": { "limit": 5 } } }');
  console.log('  { "company": { "$": { "where": { "type": 1 } }, "subsidiaries": { "subsidiaryCompany": {} } } }');
  console.log('  { "filing": { "$": { "where": { "form_type": "10-K" }, "limit": 3 } } }');
}

async function repl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n=== InstantDB Query REPL ===");
  console.log("Enter InstaQL queries as JSON. Type 'help' for examples, 'exit' to quit.\n");

  const prompt = () => {
    rl.question("query> ", async (input) => {
      const trimmed = input.trim();

      if (trimmed === "exit" || trimmed === "quit") {
        rl.close();
        return;
      }

      if (trimmed === "help" || trimmed === "schema") {
        showSchema();
        prompt();
        return;
      }

      if (trimmed.startsWith("count ")) {
        const parts = trimmed.slice(6).split(" ");
        await count(parts[0], parts[1]);
        prompt();
        return;
      }

      if (trimmed.startsWith("sample ")) {
        const parts = trimmed.slice(7).split(" ");
        await sample(parts[0], parseInt(parts[1]) || 3);
        prompt();
        return;
      }

      if (trimmed) {
        await runQuery(trimmed);
      }

      prompt();
    });
  };

  prompt();
}

// Main
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case "query":
    runQuery(args[0]);
    break;
  case "count":
    count(args[0], args[1]);
    break;
  case "sample":
    sample(args[0], parseInt(args[1]) || 3);
    break;
  case "schema":
    showSchema();
    break;
  case "repl":
    repl();
    break;
  default:
    console.log(`
InstantDB Query CLI

Usage:
  bun run cli.ts query '{ "company": { "$": { "limit": 5 } } }'
  bun run cli.ts count company
  bun run cli.ts count company '{ "type": 1 }'
  bun run cli.ts sample filing 3
  bun run cli.ts schema
  bun run cli.ts repl
`);
}
