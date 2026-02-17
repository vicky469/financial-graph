import {
  getDefaultProviderRouter,
} from "../../integration/provider/provider-router";
import { LLMProvider } from "../../integration/provider/types";
import { QwenError } from "../../integration/qwen";
import { DeepSeekError } from "../../integration/deepseek";
import { parsePositiveInt } from "../../utils/env-parsing";
import { createLogger } from "../../utils/logger";
import { getLLMWorkerPool } from "../../utils/llm-worker-pool";

import {
  FallbackExecution,
  FallbackProvider,
  FilingContext,
  LLMParseResponse,
} from "./types";

const logger = createLogger("validation/llm-fallback");

const DEFAULT_TEXT_CHUNK_SIZE_CHARS = 45000;
const DEFAULT_TEXT_CHUNK_OVERLAP_CHARS = 2000;
const DEFAULT_VISION_CHUNK_SIZE_IMAGES = 2;
const MIN_TEXT_CHUNK_BOUNDARY_CHARS = 5000;

function resolveTextChunkSizeChars(): number {
  return parsePositiveInt(
    process.env.LLM_TEXT_CHUNK_SIZE_CHARS,
    DEFAULT_TEXT_CHUNK_SIZE_CHARS,
  );
}

function resolveTextChunkOverlapChars(chunkSizeChars: number): number {
  const configured = parsePositiveInt(
    process.env.LLM_TEXT_CHUNK_OVERLAP_CHARS,
    DEFAULT_TEXT_CHUNK_OVERLAP_CHARS,
  );
  return Math.min(configured, Math.max(0, chunkSizeChars - 1));
}

function resolveVisionChunkSizeImages(): number {
  return parsePositiveInt(
    process.env.LLM_VISION_CHUNK_SIZE_IMAGES,
    DEFAULT_VISION_CHUNK_SIZE_IMAGES,
  );
}

function findChunkBoundary(input: string, start: number, maxEnd: number): number {
  const searchStart = Math.max(start + MIN_TEXT_CHUNK_BOUNDARY_CHARS, start);
  if (maxEnd <= searchStart) {
    return maxEnd;
  }

  const window = input.slice(searchStart, maxEnd);
  const boundaryPatterns = ["</table>", "</tr>", "</div>", "</p>", "\n", " "];

  for (const pattern of boundaryPatterns) {
    const idx = window.lastIndexOf(pattern);
    if (idx !== -1) {
      return searchStart + idx + pattern.length;
    }
  }

  return maxEnd;
}

function splitTextIntoChunks(
  input: string,
  chunkSizeChars: number,
  overlapChars: number,
): string[] {
  if (!input.trim()) {
    return [];
  }

  if (input.length <= chunkSizeChars) {
    return [input];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < input.length) {
    const maxEnd = Math.min(start + chunkSizeChars, input.length);
    const end = findChunkBoundary(input, start, maxEnd);
    const chunk = input.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= input.length) {
      break;
    }

    const nextStart = Math.max(end - overlapChars, start + 1);
    start = nextStart;
  }

  return chunks;
}

function splitArrayIntoChunks<T>(items: T[], chunkSize: number): T[][] {
  if (items.length === 0) {
    return [];
  }

  const normalizedChunkSize = Math.max(1, chunkSize);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += normalizedChunkSize) {
    chunks.push(items.slice(i, i + normalizedChunkSize));
  }
  return chunks;
}

function normalizeSubsidiaryKey(
  subsidiary: LLMParseResponse["subsidiaries"][number],
): string {
  const normalizedName = (subsidiary.name || "").trim().toLowerCase();
  const normalizedJurisdiction = (subsidiary.jurisdiction || "")
    .trim()
    .toLowerCase();
  return `${normalizedName}||${normalizedJurisdiction}`;
}

function mergeChunkedSubsidiaries(results: LLMParseResponse[]): LLMParseResponse {
  const merged = new Map<string, LLMParseResponse["subsidiaries"][number]>();

  for (const result of results) {
    for (const subsidiary of result.subsidiaries || []) {
      const key = normalizeSubsidiaryKey(subsidiary);
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, { ...subsidiary });
        continue;
      }

      // Prefer records with richer optional fields when duplicate name/jurisdiction appears.
      if (!existing.ownership_percentage && subsidiary.ownership_percentage) {
        existing.ownership_percentage = subsidiary.ownership_percentage;
      }
      if (!existing.jurisdiction && subsidiary.jurisdiction) {
        existing.jurisdiction = subsidiary.jurisdiction;
      }
    }
  }

  return {
    subsidiaries: Array.from(merged.values()),
  };
}

async function runTextChunks(
  chunks: string[],
  accessionNumber: string,
  providerLabel: string,
  executeChunk: (
    chunk: string,
    chunkIndex: number,
    totalChunks: number,
  ) => Promise<LLMParseResponse | null>,
): Promise<LLMParseResponse> {
  const results: LLMParseResponse[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkIndex = i + 1;
    logger.info(
      `Processing text chunk ${chunkIndex}/${chunks.length} for ${accessionNumber} via ${providerLabel}`,
    );
    const result = await executeChunk(chunks[i], chunkIndex, chunks.length);
    if (result?.subsidiaries?.length) {
      results.push(result);
    }
  }

  const merged = mergeChunkedSubsidiaries(results);
  logger.info(
    `Text chunk merge complete for ${accessionNumber} via ${providerLabel}: ${merged.subsidiaries.length} unique subsidiaries`,
  );
  return merged;
}

async function runVisionChunks(
  imageUrls: string[],
  accessionNumber: string,
  providerName: FallbackProvider,
): Promise<LLMParseResponse> {
  const chunkSize = resolveVisionChunkSizeImages();
  const imageChunks = splitArrayIntoChunks(imageUrls, chunkSize);
  const results: LLMParseResponse[] = [];
  let hadSuccessfulCall = false;
  let lastError: unknown;

  logger.info(
    `Prepared ${imageChunks.length} vision chunk(s) for ${accessionNumber} (chunkSize=${chunkSize})`,
  );

  for (let i = 0; i < imageChunks.length; i++) {
    const chunk = imageChunks[i];
    const chunkIndex = i + 1;
    const chunkRequestId = `${accessionNumber}:vision-chunk-${chunkIndex}-of-${imageChunks.length}`;

    logger.info(
      `Processing vision chunk ${chunkIndex}/${imageChunks.length} for ${accessionNumber} (${chunk.length} image(s))`,
    );

    try {
      const chunkResult = await callVisionProviderAPI(
        chunk,
        accessionNumber,
        providerName,
        chunkRequestId,
      );
      hadSuccessfulCall = true;
      if (chunkResult?.subsidiaries?.length) {
        results.push(chunkResult);
      }
      continue;
    } catch (chunkError) {
      lastError = chunkError;
      const chunkErrorCode = resolveErrorCode(chunkError);
      logger.warn(
        `Vision chunk ${chunkIndex}/${imageChunks.length} failed for ${accessionNumber} (code=${chunkErrorCode}); retrying each image in this chunk`,
      );
    }

    for (let j = 0; j < chunk.length; j++) {
      const imageGlobalIndex = i * chunkSize + j + 1;
      const imageRequestId = `${accessionNumber}:vision-image-${imageGlobalIndex}-of-${imageUrls.length}`;

      try {
        const imageResult = await callVisionProviderAPI(
          [chunk[j]],
          accessionNumber,
          providerName,
          imageRequestId,
        );
        hadSuccessfulCall = true;
        if (imageResult?.subsidiaries?.length) {
          results.push(imageResult);
        }
      } catch (imageError) {
        lastError = imageError;
        const imageErrorCode = resolveErrorCode(imageError);
        logger.error(
          `Vision image fallback failed for ${accessionNumber} image ${imageGlobalIndex}/${imageUrls.length} (code=${imageErrorCode})`,
        );
      }
    }
  }

  if (!hadSuccessfulCall && lastError) {
    throw lastError;
  }

  const merged = mergeChunkedSubsidiaries(results);
  logger.info(
    `Vision chunk merge complete for ${accessionNumber}: ${merged.subsidiaries.length} unique subsidiaries`,
  );
  return merged;
}

function resolveErrorCode(error: unknown): string {
  if (error instanceof QwenError || error instanceof DeepSeekError) {
    return error.code;
  }
  return "UNKNOWN_ERROR";
}

function getProvider(providerName: FallbackProvider): LLMProvider {
  return getDefaultProviderRouter().getProvider(providerName);
}

function resolveProviderModel(providerName: FallbackProvider): string {
  return getProvider(providerName).config.modelName;
}

async function callTextProviderAPI(
  html: string,
  accessionNumber: string,
  providerName: FallbackProvider,
  requestId?: string,
): Promise<LLMParseResponse | null> {
  const provider = getProvider(providerName);
  const effectiveRequestId = requestId || accessionNumber;
  const workerPool = getLLMWorkerPool();

  logger.info(
    `Calling ${providerName} text provider for ${effectiveRequestId} (model=${provider.config.modelName})`,
  );
  const result = await workerPool.processProviderTask({
    requestId: effectiveRequestId,
    providerKey: providerName,
    requestType: "text",
    payload: { html },
  });
  logger.info(
    `${providerName} text provider completed for ${effectiveRequestId} (model=${provider.config.modelName})`,
  );
  return result as LLMParseResponse | null;
}

async function callVisionProviderAPI(
  imageUrls: string[],
  accessionNumber: string,
  providerName: FallbackProvider,
  requestId?: string,
): Promise<LLMParseResponse | null> {
  const provider = getProvider(providerName);
  const effectiveRequestId = requestId || accessionNumber;
  const workerPool = getLLMWorkerPool();

  logger.debug(
    `Calling ${providerName} vision provider for ${effectiveRequestId} (images=${imageUrls.length}, model=${provider.config.modelName})`,
  );
  const result = await workerPool.processProviderTask({
    requestId: effectiveRequestId,
    providerKey: providerName,
    requestType: "vision",
    payload: { imageUrls },
  });
  return result as LLMParseResponse | null;
}

async function callPDFProviderAPI(
  pdfContent: string,
  accessionNumber: string,
  providerName: FallbackProvider,
): Promise<LLMParseResponse | null> {
  const provider = getProvider(providerName);
  const workerPool = getLLMWorkerPool();

  logger.debug(
    `Calling ${providerName} PDF provider for ${accessionNumber} (model=${provider.config.modelName})`,
  );

  // Convert PDF content to Buffer using latin1 (binary-safe encoding)
  const pdfBuffer = Buffer.from(pdfContent, "latin1");
  const base64Pdf = pdfBuffer.toString("base64");
  const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;

  const result = await workerPool.processProviderTask({
    requestId: accessionNumber,
    providerKey: providerName,
    requestType: "pdf",
    payload: { pdfDataUrl },
  });
  return result as LLMParseResponse | null;
}

export async function requestFallbackLLMResult(
  doc: string,
  classification: string,
  filingInfo: FilingContext,
): Promise<FallbackExecution> {
  const route = getDefaultProviderRouter().resolveRoute(classification);
  let provider = route.providerName as FallbackProvider;

  if (route.requestType === "pdf") {
    logger.info(`Using ${provider} provider for PDF document ${filingInfo.accession_number}`);
    const llmResult = await callPDFProviderAPI(
      doc,
      filingInfo.accession_number,
      provider,
    );
    return {
      provider,
      llmResult,
      telemetry: {
        provider,
        model: resolveProviderModel(provider),
        requestType: "pdf",
      },
    };
  }

  if (route.requestType === "vision") {
    const llmResult = await callVisionDocumentAPI(
      doc,
      filingInfo.accession_number,
      filingInfo.cik,
      provider,
    );
    return {
      provider,
      llmResult,
      telemetry: {
        provider,
        model: resolveProviderModel(provider),
        requestType: "vision",
      },
    };
  }

  const chunkSizeChars = resolveTextChunkSizeChars();
  const chunkOverlapChars = resolveTextChunkOverlapChars(chunkSizeChars);
  const textChunks = splitTextIntoChunks(doc, chunkSizeChars, chunkOverlapChars);
  logger.info(
    `Prepared ${textChunks.length} text chunk(s) for ${filingInfo.accession_number} (chunkSize=${chunkSizeChars}, overlap=${chunkOverlapChars})`,
  );

  try {
    const llmResult = await runTextChunks(
      textChunks,
      filingInfo.accession_number,
      provider,
      (chunk, chunkIndex, totalChunks) =>
        callTextProviderAPI(
          chunk,
          filingInfo.accession_number,
          provider,
          `${filingInfo.accession_number}:text-chunk-${chunkIndex}-of-${totalChunks}`,
        ),
    );
    return {
      provider,
      llmResult,
      telemetry: {
        provider,
        model: resolveProviderModel(provider),
        requestType: "text",
      },
    };
  } catch (deepseekError) {
    const deepseekCode = resolveErrorCode(deepseekError);
    const fallbackProvider = (route.fallbackProviderName || "gpt") as FallbackProvider;
    const fallbackModel = resolveProviderModel(fallbackProvider);
    logger.warn(
      `${provider} failed for ${filingInfo.accession_number} (code=${deepseekCode}); falling back to ${fallbackProvider} text model (${fallbackModel})`,
    );
    provider = fallbackProvider;
    const llmResult = await runTextChunks(
      textChunks,
      filingInfo.accession_number,
      provider,
      (chunk, chunkIndex, totalChunks) =>
        callTextProviderAPI(
          chunk,
          filingInfo.accession_number,
          provider,
          `${filingInfo.accession_number}:text-chunk-${chunkIndex}-of-${totalChunks}`,
        ),
    );
    return {
      provider,
      llmResult,
      telemetry: {
        provider,
        model: fallbackModel,
        requestType: "text",
        fallbackFrom: route.providerName as FallbackProvider,
        fallbackReasonCode: deepseekCode,
      },
    };
  }
}

async function callVisionDocumentAPI(
  html: string,
  accessionNumber: string,
  cik: string,
  providerName: FallbackProvider,
): Promise<LLMParseResponse | null> {
  try {
    logger.debug(`Calling ${providerName} vision provider for ${accessionNumber}`);

    // Extract image URLs from HTML
    const imageUrls = extractImageUrls(html, accessionNumber, cik);

    if (imageUrls.length === 0) {
      logger.warn(`No images found for vision model in ${accessionNumber}`);
      return null;
    }

    const result = await runVisionChunks(imageUrls, accessionNumber, providerName);
    logger.debug(`${providerName} vision request completed for ${accessionNumber}`);
    return result;
  } catch (error) {
    if (error instanceof QwenError) {
      logger.error(`${providerName} vision request failed for ${accessionNumber}: ${error.code} - ${error.message}`);
    } else {
      logger.error(`${providerName} vision request failed for ${accessionNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
}

/**
 * Extract image URLs from HTML and convert to absolute SEC Edgar URLs
 */
function extractImageUrls(html: string, accessionNumber: string, cik: string): string[] {
  const imageUrls: string[] = [];

  // Remove dashes from accession number for URL construction
  const accessionNoDashes = accessionNumber.replace(/-/g, "");

  // Match img tags with src attribute
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];

    // Skip data URLs and absolute URLs
    if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
      if (src.startsWith("http://") || src.startsWith("https://")) {
        imageUrls.push(src);
      }
      continue;
    }

    // For relative paths, construct the full SEC Edgar URL
    // Format: https://www.sec.gov/Archives/edgar/data/{CIK}/{ACCESSION}/{filename}
    const fullUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDashes}/${src}`;
    logger.debug(`Converted image URL: ${src} -> ${fullUrl}`);
    imageUrls.push(fullUrl);
  }

  logger.info(`Extracted ${imageUrls.length} image URLs for ${accessionNumber}`);
  return imageUrls;
}
