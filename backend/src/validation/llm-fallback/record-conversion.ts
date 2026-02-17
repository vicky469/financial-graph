import { generateCompanyId } from "@financial-graph/shared/ids";
import { CompanyType } from "@financial-graph/shared/types";
import { SubsidiaryRecord } from "../../pipeline/subsidiary/types";
import { createLogger } from "../../utils/logger";
import {
  appearsInCorpus,
  getGroundingFailureReason,
  GroundingCorpus,
} from "./grounding";
import { FilingContext, LLMSubsidiaryRecord } from "./types";

const logger = createLogger("validation/llm-fallback");

function normalizeText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseOwnership(value: unknown): number | undefined {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return undefined;
  }
  if (numericValue < 0 || numericValue > 100) {
    return undefined;
  }
  return numericValue;
}

export function convertLLMSubsidiariesToRecords(
  llmSubsidiaries: LLMSubsidiaryRecord[],
  filingInfo: FilingContext,
  groundingCorpus: GroundingCorpus | null,
): SubsidiaryRecord[] {
  const validSubsidiaries: SubsidiaryRecord[] = [];

  for (const llmSub of llmSubsidiaries) {
    const normalizedName = normalizeText(llmSub.name);
    let normalizedJurisdiction = normalizeText(llmSub.jurisdiction);

    if (!normalizedName) {
      logger.warn(
        `Skipping invalid LLM subsidiary: missing name, jurisdiction="${llmSub?.jurisdiction}"`,
      );
      continue;
    }

    const groundingFailure = getGroundingFailureReason(
      {
        name: normalizedName,
      },
      groundingCorpus,
    );
    if (groundingFailure) {
      logger.warn(
        `Skipping ungrounded LLM subsidiary for ${filingInfo.accession_number}: reason=${groundingFailure}, name="${normalizedName}", jurisdiction="${normalizedJurisdiction}"`,
      );
      continue;
    }

    if (
      groundingCorpus &&
      normalizedJurisdiction &&
      !appearsInCorpus(normalizedJurisdiction, groundingCorpus)
    ) {
      logger.warn(
        `LLM jurisdiction not found in canonical source for ${filingInfo.accession_number}; setting jurisdiction=null (name="${normalizedName}", jurisdiction="${normalizedJurisdiction}")`,
      );
      normalizedJurisdiction = "";
    }

    const subsidiaryId = generateCompanyId({
      type: CompanyType.SUBSIDIARY,
      name: normalizedName,
      jurisdiction_raw: normalizedJurisdiction || undefined,
    });
    const record: SubsidiaryRecord = {
      id: subsidiaryId,
      name: normalizedName,
      jurisdiction: normalizedJurisdiction,
      nestingLevel: 0,
      ownership: parseOwnership(llmSub.ownership_percentage),
      footnoteRefs: [],
      indentationSpaces: 0,
      isNested: false,
    };

    validSubsidiaries.push(record);
  }

  return validSubsidiaries;
}
