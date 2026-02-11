/**
 * Tests for subsidiary parent assignment logic
 * 
 * Ensures that:
 * 1. Level 0 subsidiaries always have filing company as parent
 * 2. Nested subsidiaries get correct parent from stack
 * 3. Parent stack doesn't leak between tables
 */

import { DEFAULT_CONFIG, parseExhibit } from "../../src/parser/subsidiary-parser";

describe("Subsidiary Parent Assignment", () => {
  const config = { ...DEFAULT_CONFIG, fallbackPolicy: "none" as const };
  // Generate the expected filing company ID from CIK
  const filingCompanyId = "aad81044-1ac5-58a9-b008-7265e5bb2b3b"; // This is deterministic based on CIK 0001234567
  
  const mockFiling = {
    accession_number: "0001234567890123",
    cik: "0001234567", // 10 digits
    filingCompanyId: filingCompanyId,
  };

  describe("Flat table (no nesting)", () => {
    it("should assign filing company as parent for all subsidiaries", async () => {
      const html = `
        <table>
          <tr>
            <th>Name of Subsidiary</th>
            <th>Jurisdiction</th>
          </tr>
          <tr>
            <td>Acme Retail LLC</td>
            <td>Delaware</td>
          </tr>
          <tr>
            <td>Beta Holdings Inc.</td>
            <td>California</td>
          </tr>
          <tr>
            <td>Gamma Services Corp.</td>
            <td>New York</td>
          </tr>
        </table>
      `;

      const result = await parseExhibit(html, mockFiling, config);

      expect(result.subsidiaries).toHaveLength(3);
      
      // All should have level 0
      result.subsidiaries.forEach(sub => {
        expect(sub.nestingLevel).toBe(0);
        expect(sub.isNested).toBe(false);
      });

      // All should have same parent (filing company)
      const parentIds = result.subsidiaries.map(s => s.parentId);
      const uniqueParents = new Set(parentIds);
      expect(uniqueParents.size).toBe(1);
      
      // Parent should be the filing company ID
      expect(parentIds[0]).toBe(filingCompanyId);
    });
  });

  describe("Nested table", () => {
    it("should assign correct parent for nested subsidiaries", async () => {
      const html = `
        <table>
          <tr>
            <th>Name of Subsidiary</th>
            <th>Jurisdiction</th>
          </tr>
          <tr>
            <td>Parent Holdings LLC</td>
            <td>Delaware</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Child Operations Inc.</td>
            <td>California</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Child Services Corp.</td>
            <td>New York</td>
          </tr>
          <tr>
            <td>Another Parent Ltd.</td>
            <td>Texas</td>
          </tr>
        </table>
      `;

      const result = await parseExhibit(html, mockFiling, config);

      expect(result.subsidiaries).toHaveLength(4);

      const parentSub = result.subsidiaries.find(s => s.name === "Parent Holdings LLC");
      const childSub1 = result.subsidiaries.find(s => s.name === "Child Operations Inc.");
      const childSub2 = result.subsidiaries.find(s => s.name === "Child Services Corp.");
      const anotherParent = result.subsidiaries.find(s => s.name === "Another Parent Ltd.");

      // Parent Sub should have filing company as parent
      expect(parentSub?.nestingLevel).toBe(0);
      expect(parentSub?.parentId).toBe(filingCompanyId);

      // Child subs should have Parent Sub as parent
      expect(childSub1?.nestingLevel).toBe(1);
      expect(childSub1?.parentId).toBe(parentSub?.id);
      expect(childSub2?.nestingLevel).toBe(1);
      expect(childSub2?.parentId).toBe(parentSub?.id);

      // Another Parent should have filing company as parent (not Parent Sub)
      expect(anotherParent?.nestingLevel).toBe(0);
      expect(anotherParent?.parentId).toBe(filingCompanyId);
      expect(anotherParent?.parentId).not.toBe(parentSub?.id);
    });

    it("should handle multiple nesting levels", async () => {
      const html = `
        <table>
          <tr>
            <th>Name of Subsidiary</th>
            <th>Jurisdiction</th>
          </tr>
          <tr>
            <td>Level Zero Corp.</td>
            <td>Delaware</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Level One LLC</td>
            <td>California</td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;&nbsp;&nbsp;Level Two Inc.</td>
            <td>New York</td>
          </tr>
        </table>
      `;

      const result = await parseExhibit(html, mockFiling, config);

      const level0 = result.subsidiaries.find(s => s.name === "Level Zero Corp.");
      const level1 = result.subsidiaries.find(s => s.name === "Level One LLC");
      const level2 = result.subsidiaries.find(s => s.name === "Level Two Inc.");

      expect(level0?.nestingLevel).toBe(0);
      expect(level0?.parentId).toBe(filingCompanyId);

      expect(level1?.nestingLevel).toBe(1);
      expect(level1?.parentId).toBe(level0?.id);

      expect(level2?.nestingLevel).toBe(2);
      expect(level2?.parentId).toBe(level1?.id);
    });
  });

  describe("Multiple tables", () => {
    it("should not leak parent stack between tables", async () => {
      const html = `
        <table>
          <tr>
            <th>Name of Subsidiary</th>
            <th>Jurisdiction</th>
          </tr>
          <tr>
            <td>Table One Alpha LLC</td>
            <td>Delaware</td>
          </tr>
          <tr>
            <td>Table One Beta Inc.</td>
            <td>California</td>
          </tr>
        </table>
        
        <table>
          <tr>
            <th>Name of Subsidiary</th>
            <th>Jurisdiction</th>
          </tr>
          <tr>
            <td>Table Two Alpha Corp.</td>
            <td>New York</td>
          </tr>
          <tr>
            <td>Table Two Beta Ltd.</td>
            <td>Texas</td>
          </tr>
        </table>
      `;

      const result = await parseExhibit(html, mockFiling, config);

      expect(result.subsidiaries).toHaveLength(4);

      // All should be level 0 with filing company as parent
      result.subsidiaries.forEach(sub => {
        expect(sub.nestingLevel).toBe(0);
        expect(sub.parentId).toBe(filingCompanyId);
      });

      // Table 2 subsidiaries should NOT have Table 1 subsidiaries as parents
      const table2SubA = result.subsidiaries.find(s => s.name === "Table Two Alpha Corp.");
      const table1SubB = result.subsidiaries.find(s => s.name === "Table One Beta Inc.");
      
      expect(table2SubA?.parentId).not.toBe(table1SubB?.id);
    });
  });

  describe("Edge cases", () => {
    it("should handle first subsidiary being nested (indented)", async () => {
      const html = `
        <table>
          <tr>
            <th>Name of Subsidiary</th>
            <th>Jurisdiction</th>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;Indented First LLC</td>
            <td>Delaware</td>
          </tr>
          <tr>
            <td>Normal Second Inc.</td>
            <td>California</td>
          </tr>
        </table>
      `;

      const result = await parseExhibit(html, mockFiling, config);

      // Even if first sub is indented, it should still be level 0 (no parent to nest under)
      const firstSub = result.subsidiaries[0];
      expect(firstSub.nestingLevel).toBe(1); // Will be detected as level 1 due to indentation
      expect(firstSub.parentId).toBe(filingCompanyId); // But parent should still be filing company

      const secondSub = result.subsidiaries[1];
      expect(secondSub.nestingLevel).toBe(0);
      expect(secondSub.parentId).toBe(filingCompanyId);
    });

    it("should normalize CIK with leading zeros", async () => {
      // Test with CIK without leading zeros (like real data from SEC)
      const expectedFilingCompanyId = "6b221663-aa56-5a48-a2f1-013c6b6c2ef6"; // From CIK 0001020569
      
      const filingWithoutZeros = {
        accession_number: "0001020569250000040",
        cik: "1020569", // Without leading zeros
        filingCompanyId: expectedFilingCompanyId,
      };

      const html = `
        <table>
          <tr>
            <th>Name of Subsidiary</th>
            <th>Jurisdiction</th>
          </tr>
          <tr>
            <td>Test Subsidiary LLC</td>
            <td>Delaware</td>
          </tr>
        </table>
      `;

      const result = await parseExhibit(html, filingWithoutZeros, config);

      expect(result.subsidiaries).toHaveLength(1);
      
      const subsidiary = result.subsidiaries[0];
      
      // The parent ID should be generated from normalized CIK (0001020569)
      // Not from the raw CIK (1020569)
      const wrongFilingCompanyId = "f231954d-66e0-5b37-b0c8-e25badf9e411"; // From CIK 1020569
      
      expect(subsidiary.parentId).toBe(expectedFilingCompanyId);
      expect(subsidiary.parentId).not.toBe(wrongFilingCompanyId);
    });
  });
});
