/**
 * Footnotes HTML Preprocessing
 *
 * Cleans and simplifies footnotes HTML before storage for LLM enrichment.
 * Removes unnecessary elements while preserving content needed for understanding
 * parent company relationships and ownership percentages.
 */

import * as cheerio from "cheerio";

/**
 * Preprocess footnotes HTML by removing unnecessary elements
 * and keeping only content-bearing elements needed for LLM understanding.
 *
 * Removes:
 * - <script>, <style>, <link> tags
 * - Navigation elements (<nav>, <header>, <footer>)
 * - Empty elements
 *
 * Keeps:
 * - <table>, <tr>, <td>, <th> (structured footnotes)
 * - <p>, <div>, <span> (paragraph footnotes)
 * - <ul>, <ol>, <li> (list footnotes)
 * - Text content
 * - Footnote markers like (1), (a), (2B)
 * - Ownership percentages
 * - Company names
 * - Indentation markers (&nbsp;, &#160;)
 * - CSS styles for indentation (padding-left, margin-left)
 *
 * @param html - Raw footnotes HTML from document
 * @returns Cleaned HTML suitable for LLM processing
 */
export function preprocessFootnotesHtml(html: string): string {
  if (!html || html.trim() === "") {
    return "";
  }

  try {
    const $ = cheerio.load(html);

    // Remove unnecessary elements
    $("script").remove();
    $("style").remove();
    $("link").remove();
    $("nav").remove();
    $("header").remove();
    $("footer").remove();

    // Remove elements that are commonly used for layout but not content
    $("img").remove();
    $("svg").remove();
    $("iframe").remove();
    $("noscript").remove();

    // Remove empty elements (elements with no text content and no meaningful children)
    $("*").each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      const hasContentChildren = $el.find("table, ul, ol, p").length > 0;

      // Don't remove if it has text or content-bearing children
      if (text === "" && !hasContentChildren) {
        // Check if it's a structural element we want to keep
        const tagName = (el as any).tagName?.toLowerCase();
        if (
          tagName !== "table" &&
          tagName !== "tr" &&
          tagName !== "td" &&
          tagName !== "th" &&
          tagName !== "ul" &&
          tagName !== "ol" &&
          tagName !== "li"
        ) {
          $el.remove();
        }
      }
    });

    // Get the cleaned HTML
    let cleanedHtml = $.html();

    // Preserve &nbsp; entities - they're used for indentation
    // Cheerio may decode them, so we don't need to do anything special
    // The entities will be preserved in the HTML output

    // Remove excessive whitespace while preserving structure
    cleanedHtml = cleanedHtml
      .replace(/\n\s*\n\s*\n/g, "\n\n") // Multiple blank lines → double newline
      .replace(/[ \t]+/g, " ") // Multiple spaces/tabs → single space (but not &nbsp;)
      .trim();

    return cleanedHtml;
  } catch (error) {
    // If preprocessing fails, return original HTML
    // Log warning but don't throw - LLM can still process unpreprocessed HTML
    console.warn("Failed to preprocess footnotes HTML:", error);
    return html;
  }
}
