import { getLLMWorkerPool } from "../../utils/llm-worker-pool";
import {
  callQwenForSubsidiaries,
  callQwenWithRetries,
  QwenError,
} from "../../integration/qwen";
import { callGPT4ForSubsidiaries } from "../../integration/gpt";
import { DeepSeekError } from "../../integration/deepseek";
import { createLogger } from "../../utils/logger";
import {
  FallbackExecution,
  FallbackProvider,
  FilingContext,
  LLMParseResponse,
} from "./types";

const logger = createLogger("validation/llm-fallback");

const DEFAULT_QWEN_VISION_MODEL = "qwen/qwen-2-vl-72b-instruct";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_OPENROUTER_GPT_MODEL = "openai/gpt-4.1";

function resolveErrorCode(error: unknown): string {
  if (error instanceof QwenError || error instanceof DeepSeekError) {
    return error.code;
  }
  return "UNKNOWN_ERROR";
}

function resolveOpenRouterTextModel(): string {
  return process.env.OPENROUTER_TEXT_MODEL || DEFAULT_OPENROUTER_GPT_MODEL;
}

function resolveQwenVisionModel(): string {
  return process.env.OPENROUTER_VISION_MODEL || DEFAULT_QWEN_VISION_MODEL;
}

function resolveDeepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
}

export async function requestFallbackLLMResult(
  doc: string,
  classification: string,
  filingInfo: FilingContext,
): Promise<FallbackExecution> {
  const isVisionModel = classification === "image-based";
  const isPDF = classification === "pdf-based";
  let provider: FallbackProvider = isPDF || isVisionModel ? "qwen-vl" : "deepseek";
  const qwenVisionModel = resolveQwenVisionModel();
  const deepseekModel = resolveDeepSeekModel();

  if (isPDF) {
    logger.info(
      `Using Qwen-VL vision model for PDF document ${filingInfo.accession_number}`,
    );
    const llmResult = await callQwenPDFAPI(
      doc,
      filingInfo.accession_number,
      filingInfo.cik,
      qwenVisionModel,
    );
    return {
      provider,
      llmResult,
      telemetry: {
        provider,
        model: qwenVisionModel,
        requestType: "pdf",
      },
    };
  }

  if (isVisionModel) {
    const llmResult = await callQwenVisionAPI(
      doc,
      filingInfo.accession_number,
      filingInfo.cik,
      qwenVisionModel,
    );
    return {
      provider,
      llmResult,
      telemetry: {
        provider,
        model: qwenVisionModel,
        requestType: "vision",
      },
    };
  }

  try {
    const llmResult = await callDeepSeekAPI(
      doc,
      filingInfo.accession_number,
      filingInfo.cik,
      false,
    );
    return {
      provider,
      llmResult,
      telemetry: {
        provider,
        model: deepseekModel,
        requestType: "text",
      },
    };
  } catch (deepseekError) {
    const deepseekCode = resolveErrorCode(deepseekError);
    const gptModel = resolveOpenRouterTextModel();
    logger.warn(
      `DeepSeek failed for ${filingInfo.accession_number} (code=${deepseekCode}); falling back to GPT text model (${gptModel})`,
    );
    provider = "gpt";
    const llmResult = await callGPTTextAPI(
      doc,
      filingInfo.accession_number,
      gptModel,
    );
    return {
      provider,
      llmResult,
      telemetry: {
        provider,
        model: gptModel,
        requestType: "text",
        fallbackFrom: "deepseek",
        fallbackReasonCode: deepseekCode,
      },
    };
  }
}

/**
 * Call Qwen-VL API for PDF document parsing
 * Uses OpenRouter's mistral-ocr engine to parse PDF, then Qwen-VL vision model to extract subsidiaries
 */
async function callQwenPDFAPI(
  pdfContent: string,
  accessionNumber: string,
  cik: string,
  model: string,
): Promise<LLMParseResponse | null> {
  try {
    logger.debug(`Calling Qwen-VL (with mistral-ocr) for PDF ${accessionNumber}`);

    // Convert PDF content to Buffer using latin1 (binary-safe encoding)
    const pdfBuffer = Buffer.from(pdfContent, "latin1");

    // Upload PDF directly to OpenRouter with mistral-ocr engine for parsing
    logger.info(`Uploading PDF to Qwen-VL (mistral-ocr engine) for ${accessionNumber}`);
    const base64Pdf = pdfBuffer.toString("base64");
    const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;

    const result = await callQwenWithRetries(
      accessionNumber,
      "pdf",
      () => callQwenForSubsidiaries([], { pdfUrl: pdfDataUrl, model, accessionNumber }),
    );

    if (result && result.subsidiaries && result.subsidiaries.length > 0) {
      logger.info(`Qwen-VL extracted ${result.subsidiaries.length} subsidiaries from PDF ${accessionNumber}`);
      const samples = result.subsidiaries.slice(0, 3).map(s => `${s.name} (${s.jurisdiction})`).join(", ");
      logger.info(`Sample subsidiaries: ${samples}`);
    } else {
      logger.warn(`Qwen-VL returned no subsidiaries for PDF ${accessionNumber}`);
    }

    return result;
  } catch (error) {
    if (error instanceof QwenError) {
      logger.error(`Qwen-VL PDF request failed for ${accessionNumber}: ${error.code} - ${error.message}`);
    } else {
      logger.error(`Qwen-VL PDF request failed for ${accessionNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
}

/**
 * Call Qwen-VL API for vision-based parsing
 */
async function callQwenVisionAPI(
  html: string,
  accessionNumber: string,
  cik: string,
  model: string,
): Promise<LLMParseResponse | null> {
  try {
    logger.debug(`Calling Qwen-VL for ${accessionNumber}`);

    // Extract image URLs from HTML
    const imageUrls = extractImageUrls(html, accessionNumber, cik);

    if (imageUrls.length === 0) {
      logger.warn(`No images found for vision model in ${accessionNumber}`);
      return null;
    }

    logger.info(`Extracted ${imageUrls.length} image URLs for ${accessionNumber}`);

    // Vision requests can trigger upstream SEC URL throttling; retry on retryable errors.
    const result = await callQwenWithRetries(
      accessionNumber,
      "vision",
      () => callQwenForSubsidiaries(imageUrls, { model, accessionNumber }),
    );
    logger.debug(`Qwen-VL request completed for ${accessionNumber}`);
    return result;
  } catch (error) {
    if (error instanceof QwenError) {
      logger.error(`Qwen-VL request failed for ${accessionNumber}: ${error.code} - ${error.message}`);
    } else {
      logger.error(`Qwen-VL request failed for ${accessionNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
}

/**
 * Call GPT text model for text-based fallback when DeepSeek fails
 */
async function callGPTTextAPI(
  html: string,
  accessionNumber: string,
  model: string,
): Promise<LLMParseResponse | null> {
  try {
    logger.info(
      `Calling GPT text fallback for ${accessionNumber} (model=${model})`,
    );
    const result = await callQwenWithRetries(
      accessionNumber,
      "text",
      () => callGPT4ForSubsidiaries(html, { model, accessionNumber }),
    );
    logger.info(
      `GPT text fallback completed for ${accessionNumber} (model=${model})`,
    );
    return result;
  } catch (error) {
    if (error instanceof QwenError) {
      logger.error(`GPT text fallback failed for ${accessionNumber}: ${error.code} - ${error.message}`);
    } else {
      logger.error(`GPT text fallback failed for ${accessionNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
}

/**
 * Call DeepSeek V3.1 API for text or Qwen3-VL-Plus for vision using worker pool
 */
async function callDeepSeekAPI(
  html: string,
  accessionNumber: string,
  cik: string,
  isVisionModel: boolean = false,
): Promise<LLMParseResponse | null> {
  const workerPool = getLLMWorkerPool();

  try {
    logger.debug(`Queuing LLM request for ${accessionNumber}${isVisionModel ? " (vision model)" : ""}`);

    // Extract image URLs if using vision model
    const imageUrls = isVisionModel ? extractImageUrls(html, accessionNumber, cik) : [];

    if (isVisionModel && imageUrls.length === 0) {
      logger.warn(`Vision model requested but no images found in ${accessionNumber}`);
      return null;
    }

    const result = await workerPool.processRequest(accessionNumber, html, isVisionModel, imageUrls);
    logger.debug(`LLM request completed for ${accessionNumber}`);
    return result;
  } catch (error) {
    logger.error(`LLM worker pool request failed for ${accessionNumber}: ${error instanceof Error ? error.message : String(error)}`);
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
