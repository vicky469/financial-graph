/**
 * Parse Step
 *
 * Parses HTML to extract subsidiary records using the two-phase refactored parser.
 */

import { Step } from "../../core/types";
import { DecompressedFiling, ParsedFiling } from "../types";
import {
  parseExhibitRefactored,
  ParserError,
} from "../../../parser/subsidiary";
import type { ParseResult } from "../../../parser/subsidiary/types";

export const parseStep: Step<DecompressedFiling, ParsedFiling> = {
  name: "parse",

  async execute(file, _context) {
    try {
      // Use the refactored two-phase parser (now directly returns ParseResult)
      const parseResult = await parseExhibitRefactored(file.html, {
        accession_number: file.accessionNumber,
        cik: file.cik,
        filingCompanyId: file.companyId,
        filingCompanyName: file.companyName,
      });

      return {
        ...file,
        parseResult,
        success: parseResult.status !== "failed",
      };
    } catch (error: unknown) {
      // Handle parser errors gracefully
      const errorMessage =
        error instanceof ParserError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);

      const failedResult: ParseResult = {
        subsidiaries: [],
        method: "failed",
        status: "failed",
        tableCount: 0,
        maxNestingLevel: 0,
        footnotesHtml: "",
        errorMessage,
      };

      return {
        ...file,
        parseResult: failedResult,
        success: false,
      };
    }
  },
};
