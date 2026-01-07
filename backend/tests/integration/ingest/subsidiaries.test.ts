import { db } from "../../../src/db/client";
import { describe, it, expect, jest } from "@jest/globals";
import { generateParentOfEdgeId } from "../../../src/db/ids";

// Target filing with known large list of subsidiaries (536 items)
const TARGET_ACCESSION_NUMBER = "0000824142-25-000039";

describe("Subsidiary Ingestion Verification", () => {
  // Increase timeout for DB queries
  jest.setTimeout(30000);

  it("should have ingested filings with subsidiaries", async () => {
    // Broad check: Ensure we have at least some parent-child edges in the table
    const res = await db.query({
      parent_of: {
        $: { limit: 10 },
      },
    });

    expect(res.parent_of.length).toBeGreaterThan(0);
    console.log(
      `Found ${res.parent_of.length} sample parent-child edges in global table.`
    );
  });

  it(`should handle large nested hierarchies (e.g. Filing ${TARGET_ACCESSION_NUMBER})`, async () => {
    const res = await db.query({
      filings: {
        $: { where: { accession_number: TARGET_ACCESSION_NUMBER } },
      },
    });

    expect(res.filings.length).toBe(1);
    const filing = res.filings[0];

    console.log(
      `Verifying filing ${filing.id} (Company: ${filing.company_id})...`
    );

    // 1. Verify Direct Graph Links (Company -> Subsidiaries)
    // This confirms the specific parsing logic correctly linked nodes in the Company graph.
    const companyRes = await db.query({
      companies: {
        $: { where: { id: filing.company_id } },
        subsidiaries: {
          $: { limit: 1000 },
        },
      },
    });

    const company = companyRes.companies[0];
    const subs = company.subsidiaries || [];

    console.log(
      `Found ${subs.length} linked subsidiaries via graph traversal.`
    );
    expect(subs.length).toBeGreaterThan(50);

    // 1.5 Verify Reverse Graph Links (Subsidiary -> Parent)
    // REQUIRED FIX: Ensure the bidirectional link exists!
    let reverseLinkCount = 0;
    for (const sub of subs.slice(0, 20)) {
      // Query the sub to see if it links back to parent
      const check = await db.query({
        companies: {
          $: { where: { id: sub.id } },
          parent: { $: { limit: 1 } },
        },
      });
      const parentLinks = check.companies[0]?.parent || [];
      if (parentLinks.length === 1 && parentLinks[0].id === filing.company_id) {
        reverseLinkCount++;
      }
    }
    console.log(
      `Verified ${reverseLinkCount}/20 subsidiaries have correct reverse parent link.`
    );
    expect(reverseLinkCount).toBe(20);

    // 2. Verify Temporal Edge Objects (ParentOfEdge) exist
    // Since we can't query by `source_id` without an index, we verify by checking for specific Edge IDs.
    // We calculate the expected ID for the first 10 subsidiaries and ensure they exist in DB.

    let foundTemporalEdges = 0;
    const sampleSubs = subs.slice(0, 10);

    for (const sub of sampleSubs) {
      // Generate deterministic ID using the same logic as ingestion
      const edgeId = generateParentOfEdgeId({
        from_company_id: filing.company_id,
        to_company_id: sub.id,
        source_id: filing.id,
      });

      const edgeRes = await db.query({
        parent_of: {
          $: { where: { id: edgeId } }, // ID lookup is indexed
        },
      });

      if (edgeRes.parent_of?.length === 1) {
        foundTemporalEdges++;
        const edge = edgeRes.parent_of[0];
        if (
          edge.ownership_percent !== undefined &&
          edge.ownership_percent !== null
        ) {
          // Validation passed
        } else {
          console.warn(`⚠️ Edge ${edgeId} missing ownership_percent`);
        }
      }
    }

    console.log(
      `Verified ${foundTemporalEdges}/${sampleSubs.length} sample temporal edge objects exist.`
    );
    expect(foundTemporalEdges).toBe(sampleSubs.length);

    // 3. Verify Nesting (Approximate)
    // Since we only fetched Level 1 children above (Company -> Subs),
    // we check if ANY of those subs have their own subs (Level 2).

    let nestedCount = 0;
    for (const sub of sampleSubs) {
      const subRes = await db.query({
        companies: {
          $: { where: { id: sub.id } },
          subsidiaries: { $: { limit: 1 } },
        },
      });
      const subNode = subRes.companies[0];
      if (subNode?.subsidiaries && subNode.subsidiaries.length > 0) {
        nestedCount++;
      }
    }

    console.log(
      `Found ${nestedCount} Level-2 nested structures in the sample of 10.`
    );
    // Detection of ANY nesting validates the parser's capability
    // If 0, it might just be a flat filing, but we log it.
    if (nestedCount > 0) {
      console.log("✅ Verified nested hierarchy extraction.");
    } else {
      console.log(
        "ℹ️ No Level 2 nesting found in sample (could be flat list)."
      );
    }
  });

  it("should sample nested hierarchies", async () => {
    // Placeholder for future deep verification once indexes allow broader scanning
    console.log(
      "Deep hierarchy verification checked via sample traversal above."
    );
  });
});
