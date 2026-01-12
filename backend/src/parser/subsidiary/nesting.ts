/**
 * Nesting detection for subsidiary hierarchies
 * 
 * SEC EX-21 filings often show nested subsidiaries using indentation:
 * 
 * Example:
 *   Apple Inc.                    (level 0, parent: filing company)
 *     Beats Electronics LLC       (level 1, parent: Apple Inc.)
 *       Beats Music LLC           (level 2, parent: Beats Electronics)
 *     Claris International        (level 1, parent: Apple Inc.)
 * 
 * Indentation is detected via:
 * - &nbsp; characters in HTML
 * - CSS margin-left / padding-left
 * - Leading whitespace in text
 */

import type { SubsidiaryRecord } from "./types";

export interface IndentationInfo {
  spaces: number;
  hasIndentation: boolean;
}

export interface ParentInfo {
  level: number;
  name: string;
  id: string;
}

/**
 * Extract padding-left value from CSS style string
 * Handles both explicit padding-left and shorthand padding (4 values)
 */
function extractPaddingLeft(style: string): number {
  // Try explicit padding-left first
  const paddingLeftMatch = style.match(/padding-left:\s*(\d+(?:\.\d+)?)(pt|px)?/);
  if (paddingLeftMatch) {
    return parseFloat(paddingLeftMatch[1]);
  }
  
  // Try shorthand padding with 4 values: padding: top right bottom left
  // Example: "padding:2px 1pt 2px 13pt" -> left = 13pt
  const shorthandMatch = style.match(/padding:\s*[\d.]+(?:pt|px)?\s+[\d.]+(?:pt|px)?\s+[\d.]+(?:pt|px)?\s+([\d.]+)(pt|px)?/);
  if (shorthandMatch) {
    return parseFloat(shorthandMatch[1]);
  }
  
  return 0;
}

/**
 * Analyze indentation of a name cell to detect nesting
 */
export function analyzeIndentation(
  nameCell: any,
  rawName: string
): IndentationInfo {
  const cellHtml = nameCell.html() || "";
  
  // Method 1: Count leading &nbsp; characters (before actual text)
  // Match &nbsp; or &#160; at the start, possibly with tags in between
  const leadingNbspMatch = cellHtml.match(/^(?:<[^>]*>)*(?:(?:&nbsp;|&#160;)(?:<[^>]*>)*)*/);
  let nbspCount = 0;
  if (leadingNbspMatch) {
    const leadingPart = leadingNbspMatch[0];
    nbspCount = (leadingPart.match(/&nbsp;|&#160;/g) || []).length;
  }
  
  // Method 2: Check CSS padding-left on cell itself
  const cellStyle = nameCell.attr("style") || "";
  let paddingLeftPt = extractPaddingLeft(cellStyle);
  
  // Method 3: Check CSS padding-left on nested div elements
  // Some filings use <td><div style="padding-left:36pt">Name</div></td>
  if (paddingLeftPt === 0) {
    const divs = nameCell.find("div");
    divs.each((_: number, div: any) => {
      const divStyle = nameCell.find(div).attr("style") || "";
      const divPadding = extractPaddingLeft(divStyle);
      if (divPadding > paddingLeftPt) {
        paddingLeftPt = divPadding;
      }
    });
  }
  
  // Method 4: Check CSS margin-left
  const marginMatch = cellStyle.match(/margin-left:\s*(\d+(?:\.\d+)?)(pt|px)?/);
  
  // Method 5: Leading whitespace in text
  const leadingSpaces = rawName.match(/^(\s*)/)?.[1]?.length || 0;

  let spaces = 0;

  if (nbspCount > 0) {
    spaces = nbspCount; // Each &nbsp; = 1 unit of indentation
  } else if (paddingLeftPt > 0) {
    // CSS padding-left in pt: ~12pt per indent level is common
    // Use 10pt as threshold to be safe
    spaces = Math.floor(paddingLeftPt / 10);
  } else if (marginMatch) {
    spaces = Math.floor(parseFloat(marginMatch[1]) / 10);
  } else if (leadingSpaces > 0) {
    spaces = leadingSpaces;
  }

  return {
    spaces,
    hasIndentation: spaces > 0,
  };
}

/**
 * Determine nesting level based on indentation relative to previous rows
 */
export function determineNestingLevel(
  indentInfo: IndentationInfo,
  existingSubsidiaries: SubsidiaryRecord[]
): number {
  if (!indentInfo.hasIndentation) return 0;

  // Find most recent subsidiary with less indentation
  for (let i = existingSubsidiaries.length - 1; i >= 0; i--) {
    const existing = existingSubsidiaries[i];
    if (existing.indentationSpaces < indentInfo.spaces) {
      return existing.nestingLevel + 1;
    }
  }

  return 1;
}

/**
 * Manage parent stack for building hierarchy
 * 
 * As we process rows, we maintain a stack of potential parents.
 * When we encounter a row with less/equal indentation, we pop
 * parents off the stack until we find the correct parent.
 */
export class ParentStack {
  private stack: ParentInfo[] = [];

  /**
   * Check if stack is empty
   */
  isEmpty(): boolean {
    return this.stack.length === 0;
  }

  /**
   * Update stack and return current parent for given nesting level
   */
  getParent(level: number): ParentInfo | undefined {
    // Level 0 subsidiaries always have the filing company as parent
    if (level === 0) {
      // Clear the stack since we're back at root level
      this.stack = [];
      return undefined;
    }
    
    // Pop parents that are at same or deeper level
    while (this.stack.length > 0 && this.stack[this.stack.length - 1].level >= level) {
      this.stack.pop();
    }
    
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : undefined;
  }

  /**
   * Push a new potential parent onto the stack
   */
  push(info: ParentInfo): void {
    this.stack.push(info);
  }
}
