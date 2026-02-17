import type { Logger } from "@financial-graph/shared";
import { parseSubsidiaryJsonResponse } from "./llm-json";
import {
  buildRawResponsePreview,
  writeRawResponseSnapshot,
} from "./llm-debug";

type ParseContext = {
  provider: string;
  providerLabel: string;
  model: string;
  requestType: "text" | "vision" | "pdf";
  accessionNumber?: string;
  logger: Logger;
};

type ParseErrorFactory<TError extends Error> = (
  message: string,
  parseError: unknown,
) => TError;

export async function parseSubsidiaryContentOrThrow<
  TOutput extends { subsidiaries: unknown[] },
  TError extends Error,
>(
  content: string,
  context: ParseContext,
  createParseError: ParseErrorFactory<TError>,
): Promise<TOutput> {
  const { provider, providerLabel, model, requestType, accessionNumber, logger } =
    context;

  try {
    const parsed = parseSubsidiaryJsonResponse<TOutput>(content);
    if (parsed.recovered) {
      logger.warn(`${providerLabel} response required JSON recovery`, {
        provider,
        model,
        requestType,
        accessionNumber,
        recoveredCount: parsed.recoveredCount,
      });
    }
    return parsed.value;
  } catch (parseError) {
    const rawResponsePath = await writeRawResponseSnapshot({
      provider,
      model,
      requestType,
      accessionNumber,
      reason: "json_parse_error",
      content,
    });
    logger.error(`${providerLabel} JSON parse failed`, {
      provider,
      model,
      requestType,
      accessionNumber,
      parseError:
        parseError instanceof Error ? parseError.message : String(parseError),
      rawResponsePreview: buildRawResponsePreview(content),
      rawResponsePath,
    });
    throw createParseError(
      `JSON Parse error: ${
        parseError instanceof Error ? parseError.message : String(parseError)
      }`,
      parseError,
    );
  }
}
