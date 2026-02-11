/**
 * Tests for nesting detection utilities
 *
 * Tests indentation analysis and parent-child hierarchy building
 * for nested subsidiary structures in SEC filings.
 */

import { load } from "cheerio";
import {
  analyzeIndentation,
  determineNestingLevel,
  ParentStack,
} from "../../src/parser/subsidiary/nesting";
import type { SubsidiaryRecord } from "../../src/parser/subsidiary/types";

// Helper to create a mock Cheerio cell element
function createMockCell(html: string, style?: string) {
  const styleAttr = style ? ` style="${style}"` : "";
  const $ = load(`<table><tr><td${styleAttr}>${html}</td></tr></table>`);
  return $("td").first();
}

describe("analyzeIndentation", () => {
  describe("&nbsp; detection", () => {
    it("detects indentation from &nbsp; characters", () => {
      const cell = createMockCell("&nbsp;&nbsp;Subsidiary Name");
      const result = analyzeIndentation(cell, "  Subsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(2); // 2 &nbsp;
    });

    it("detects multiple &nbsp; for deeper nesting", () => {
      const cell = createMockCell("&nbsp;&nbsp;&nbsp;&nbsp;Deep Subsidiary");
      const result = analyzeIndentation(cell, "    Deep Subsidiary");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(4); // 4 &nbsp;
    });

    it("returns no indentation when no &nbsp;", () => {
      const cell = createMockCell("Top Level Company");
      const result = analyzeIndentation(cell, "Top Level Company");

      expect(result.hasIndentation).toBe(false);
      expect(result.spaces).toBe(0);
    });

    it("ignores &nbsp; within text (not leading)", () => {
      // Dave & Buster's uses &#160; for spacing within company name
      const cell = createMockCell(
        "Dave&#160;&#38; Buster&#8217;s&#160;I, L.P."
      );
      const result = analyzeIndentation(cell, "Dave & Buster's I, L.P.");

      expect(result.hasIndentation).toBe(false);
      expect(result.spaces).toBe(0);
    });

    it("ignores &#160; numeric entities within text", () => {
      const cell = createMockCell("<font>Company&#160;Name&#160;Here</font>");
      const result = analyzeIndentation(cell, "Company Name Here");

      expect(result.hasIndentation).toBe(false);
      expect(result.spaces).toBe(0);
    });

    it("counts only leading &nbsp; before text", () => {
      const cell = createMockCell("&nbsp;&nbsp;<font>Company&#160;Name</font>");
      const result = analyzeIndentation(cell, "  Company Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(2); // Only the 2 leading &nbsp;
    });
  });

  describe("CSS margin-left detection", () => {
    it("detects indentation from margin-left style", () => {
      const cell = createMockCell("Subsidiary Name", "margin-left: 20pt");
      const result = analyzeIndentation(cell, "Subsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(20); // Raw value, mapped dynamically later
    });

    it("handles margin-left with different values", () => {
      const cell = createMockCell("Subsidiary Name", "margin-left: 40pt");
      const result = analyzeIndentation(cell, "Subsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(40); // Raw value, mapped dynamically later
    });
  });

  describe("CSS padding-left detection", () => {
    it("detects indentation from padding-left style", () => {
      const cell = createMockCell("Subsidiary Name", "padding-left: 20pt");
      const result = analyzeIndentation(cell, "Subsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(20); // Raw value, mapped dynamically later
    });

    it("detects indentation from shorthand padding (4 values)", () => {
      // Brink's style: padding:2px 1pt 2px 13pt (left = 13pt)
      const cell = createMockCell(
        "Subsidiary Name",
        "padding:2px 1pt 2px 13pt"
      );
      const result = analyzeIndentation(cell, "Subsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(13); // Raw value, mapped dynamically later
    });

    it("detects deeper nesting from shorthand padding", () => {
      // padding:2px 1pt 2px 37pt (left = 37pt)
      const cell = createMockCell(
        "Subsidiary Name",
        "padding:2px 1pt 2px 37pt"
      );
      const result = analyzeIndentation(cell, "Subsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(37); // Raw value, mapped dynamically later
    });
  });

  describe("leading whitespace detection", () => {
    it("detects indentation from leading spaces in text", () => {
      const cell = createMockCell("   Subsidiary Name");
      const result = analyzeIndentation(cell, "   Subsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(3);
    });

    it("detects tabs as whitespace", () => {
      const cell = createMockCell("\t\tSubsidiary Name");
      const result = analyzeIndentation(cell, "\t\tSubsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(2);
    });
  });

  describe("priority order", () => {
    it("prioritizes &nbsp; over CSS styles", () => {
      const cell = createMockCell("&nbsp;Subsidiary", "margin-left: 40pt");
      const result = analyzeIndentation(cell, " Subsidiary");

      // &nbsp; takes priority: 1 &nbsp;
      expect(result.spaces).toBe(1);
    });

    it("prioritizes CSS padding over leading whitespace", () => {
      const cell = createMockCell("     Subsidiary", "padding-left: 20pt");
      const result = analyzeIndentation(cell, "     Subsidiary");

      // padding-left takes priority: raw value 20
      expect(result.spaces).toBe(20);
    });
  });
});

describe("determineNestingLevel", () => {
  // Helper to create mock subsidiary records
  function createSubsidiary(
    name: string,
    nestingLevel: number,
    indentationSpaces: number
  ): SubsidiaryRecord {
    return {
      id: `id-${name}`,
      name,
      jurisdiction: "Delaware",
      nestingLevel,
      indentationSpaces,
      footnoteRefs: [],
      isNested: nestingLevel > 0,
    };
  }

  it("returns 0 for no indentation", () => {
    const indentInfo = { spaces: 0, hasIndentation: false };
    const existing: SubsidiaryRecord[] = [];

    expect(determineNestingLevel(indentInfo, existing)).toBe(0);
  });

  describe("dynamic mapping with &nbsp; (small increments)", () => {
    it("maps first indentation (2 spaces) to level 1", () => {
      const indentInfo = { spaces: 2, hasIndentation: true };
      const existing = [createSubsidiary("Parent", 0, 0)];

      expect(determineNestingLevel(indentInfo, existing)).toBe(1);
    });

    it("maps deeper indentation (4 spaces) to level 2", () => {
      const indentInfo = { spaces: 4, hasIndentation: true };
      const existing = [
        createSubsidiary("Parent", 0, 0),
        createSubsidiary("Child", 1, 2),
      ];

      expect(determineNestingLevel(indentInfo, existing)).toBe(2);
    });

    it("returns same level for same indentation", () => {
      const indentInfo = { spaces: 2, hasIndentation: true };
      const existing = [
        createSubsidiary("Parent", 0, 0),
        createSubsidiary("Child1", 1, 2),
      ];

      // Same indentation as Child1, should be level 1
      expect(determineNestingLevel(indentInfo, existing)).toBe(1);
    });
  });

  describe("dynamic mapping with CSS padding (large values)", () => {
    it("maps first CSS indentation (20pt) to level 1", () => {
      const indentInfo = { spaces: 20, hasIndentation: true };
      const existing = [createSubsidiary("Parent", 0, 0)];

      expect(determineNestingLevel(indentInfo, existing)).toBe(1);
    });

    it("maps deeper CSS indentation (40pt) to level 2", () => {
      const indentInfo = { spaces: 40, hasIndentation: true };
      const existing = [
        createSubsidiary("Parent", 0, 0),
        createSubsidiary("Child", 1, 20),
      ];

      expect(determineNestingLevel(indentInfo, existing)).toBe(2);
    });

    it("handles non-uniform CSS increments (13pt, 37pt)", () => {
      // Real-world example: Brink's uses 13pt and 37pt
      const existing = [
        createSubsidiary("Parent", 0, 0),
        createSubsidiary("Child", 1, 13),
      ];

      const indentInfo = { spaces: 37, hasIndentation: true };
      expect(determineNestingLevel(indentInfo, existing)).toBe(2);
    });

    it("handles three levels with irregular spacing (13pt, 37pt, 61pt)", () => {
      const existing = [
        createSubsidiary("Parent", 0, 0),
        createSubsidiary("Child", 1, 13),
        createSubsidiary("Grandchild", 2, 37),
      ];

      const indentInfo = { spaces: 61, hasIndentation: true };
      expect(determineNestingLevel(indentInfo, existing)).toBe(3);
    });
  });

  describe("dynamic mapping with mixed indentation schemes", () => {
    it("handles document switching from &nbsp; to CSS mid-table", () => {
      const existing = [
        createSubsidiary("Parent", 0, 0),
        createSubsidiary("Child1", 1, 2), // 2 &nbsp;
      ];

      // New row uses CSS padding: 20pt
      const indentInfo = { spaces: 20, hasIndentation: true };
      // Should map to level 2 (20 > 2, so it's deeper)
      expect(determineNestingLevel(indentInfo, existing)).toBe(2);
    });

    it("correctly orders mixed values (2, 4, 20, 40)", () => {
      const existing = [
        createSubsidiary("Parent", 0, 0),
        createSubsidiary("Child1", 1, 2),
        createSubsidiary("Child2", 2, 4),
        createSubsidiary("Child3", 3, 20),
      ];

      const indentInfo = { spaces: 40, hasIndentation: true };
      expect(determineNestingLevel(indentInfo, existing)).toBe(4);
    });
  });

  describe("going back to lower indentation", () => {
    it("handles going back to level 1 after level 2", () => {
      const existing = [
        createSubsidiary("Parent", 0, 0),
        createSubsidiary("Child", 1, 20),
        createSubsidiary("Grandchild", 2, 40),
      ];

      // Going back to 20pt should be level 1
      const indentInfo = { spaces: 20, hasIndentation: true };
      expect(determineNestingLevel(indentInfo, existing)).toBe(1);
    });

    it("handles going back to level 0", () => {
      const existing = [
        createSubsidiary("Parent", 0, 0),
        createSubsidiary("Child", 1, 20),
        createSubsidiary("Grandchild", 2, 40),
      ];

      // Going back to 0 should be level 0
      const indentInfo = { spaces: 0, hasIndentation: false };
      expect(determineNestingLevel(indentInfo, existing)).toBe(0);
    });
  });

  it("returns 1 when no parent with less indentation found", () => {
    const indentInfo = { spaces: 4, hasIndentation: true };
    const existing: SubsidiaryRecord[] = [];

    expect(determineNestingLevel(indentInfo, existing)).toBe(1);
  });
});

describe("ParentStack", () => {
  it("returns undefined when stack is empty", () => {
    const stack = new ParentStack();
    expect(stack.getParent(0)).toBeUndefined();
    expect(stack.getParent(1)).toBeUndefined();
  });

  it("returns parent for level 1 child", () => {
    const stack = new ParentStack();
    stack.push({ level: 0, name: "Parent", id: "parent-id" });

    const parent = stack.getParent(1);
    expect(parent?.name).toBe("Parent");
    expect(parent?.id).toBe("parent-id");
  });

  it("returns correct parent for level 2 child", () => {
    const stack = new ParentStack();
    stack.push({ level: 0, name: "Grandparent", id: "gp-id" });
    stack.push({ level: 1, name: "Parent", id: "p-id" });

    const parent = stack.getParent(2);
    expect(parent?.name).toBe("Parent");
  });

  it("pops same-level entries when getting parent", () => {
    const stack = new ParentStack();
    stack.push({ level: 0, name: "Parent", id: "p-id" });
    stack.push({ level: 1, name: "Sibling1", id: "s1-id" });

    // Getting parent for level 1 should pop Sibling1
    const parent = stack.getParent(1);
    expect(parent?.name).toBe("Parent");
  });

  it("handles complex hierarchy correctly", () => {
    const stack = new ParentStack();

    // Build: Apple -> Beats -> Beats Music
    stack.push({ level: 0, name: "Apple", id: "apple" });
    expect(stack.getParent(1)?.name).toBe("Apple");

    stack.push({ level: 1, name: "Beats", id: "beats" });
    expect(stack.getParent(2)?.name).toBe("Beats");

    stack.push({ level: 2, name: "Beats Music", id: "beats-music" });

    // Now add Claris at level 1 (sibling of Beats)
    // Should pop Beats Music and Beats, return Apple
    expect(stack.getParent(1)?.name).toBe("Apple");
  });

  it("returns undefined for level 0", () => {
    const stack = new ParentStack();
    stack.push({ level: 0, name: "Company1", id: "c1" });

    // Level 0 has no parent
    expect(stack.getParent(0)).toBeUndefined();
  });
});
