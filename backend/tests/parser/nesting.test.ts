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
} from "../../src/parsers/subsidiary/nesting";
import type { SubsidiaryRecord } from "../../src/parsers/subsidiary/types";

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
      const cell = createMockCell("Dave&#160;&#38; Buster&#8217;s&#160;I, L.P.");
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
      expect(result.spaces).toBe(2); // 20 / 10 = 2
    });

    it("handles margin-left with different values", () => {
      const cell = createMockCell("Subsidiary Name", "margin-left: 40pt");
      const result = analyzeIndentation(cell, "Subsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(4); // 40 / 10 = 4
    });
  });

  describe("CSS padding-left detection", () => {
    it("detects indentation from padding-left style", () => {
      const cell = createMockCell("Subsidiary Name", "padding-left: 20pt");
      const result = analyzeIndentation(cell, "Subsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(2); // 20 / 10 = 2
    });
    
    it("detects indentation from shorthand padding (4 values)", () => {
      // Brink's style: padding:2px 1pt 2px 13pt (left = 13pt)
      const cell = createMockCell("Subsidiary Name", "padding:2px 1pt 2px 13pt");
      const result = analyzeIndentation(cell, "Subsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(1); // 13 / 10 = 1
    });
    
    it("detects deeper nesting from shorthand padding", () => {
      // padding:2px 1pt 2px 37pt (left = 37pt)
      const cell = createMockCell("Subsidiary Name", "padding:2px 1pt 2px 37pt");
      const result = analyzeIndentation(cell, "Subsidiary Name");

      expect(result.hasIndentation).toBe(true);
      expect(result.spaces).toBe(3); // 37 / 10 = 3
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

      // padding-left takes priority: 20 / 10 = 2
      expect(result.spaces).toBe(2);
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

  it("returns 1 for first indented row", () => {
    const indentInfo = { spaces: 4, hasIndentation: true };
    const existing = [createSubsidiary("Parent", 0, 0)];

    expect(determineNestingLevel(indentInfo, existing)).toBe(1);
  });

  it("returns 2 for deeper indentation", () => {
    const indentInfo = { spaces: 8, hasIndentation: true };
    const existing = [
      createSubsidiary("Parent", 0, 0),
      createSubsidiary("Child", 1, 4),
    ];

    expect(determineNestingLevel(indentInfo, existing)).toBe(2);
  });

  it("returns same level for same indentation", () => {
    const indentInfo = { spaces: 4, hasIndentation: true };
    const existing = [
      createSubsidiary("Parent", 0, 0),
      createSubsidiary("Child1", 1, 4),
    ];

    // Same indentation as Child1, should be level 1
    expect(determineNestingLevel(indentInfo, existing)).toBe(1);
  });

  it("handles going back to lower indentation", () => {
    const indentInfo = { spaces: 4, hasIndentation: true };
    const existing = [
      createSubsidiary("Parent", 0, 0),
      createSubsidiary("Child", 1, 4),
      createSubsidiary("Grandchild", 2, 8),
    ];

    // Going back to 4 spaces should be level 1
    expect(determineNestingLevel(indentInfo, existing)).toBe(1);
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
