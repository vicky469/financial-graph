/**
 * LLM Fallback for Subsidiary Parsing when rule-based parsing fails validation
 */

import { SubsidiaryRecord, ParseResult } from "../parser/subsidiary/types";
import { LLMModification } from "../parser/subsidiary/llm-enrichment";
import { createLogger } from "../utils/logger";
import { generateCompanyId } from "@financial-graph/shared/ids";
import { CompanyType } from "@financial-graph/shared/types";
import { getLLMWorkerPool } from "../utils/llm-worker-pool";
import { callQwenForSubsidiaries, QwenError } from "../integration/qwen";

const logger = createLogger("validation/llm-fallback");

interface LLMSubsidiaryRecord {
  name: string;
  jurisdiction: string;
  ownership_percentage?: number | null;
}

interface LLMParseResponse {
  subsidiaries: LLMSubsidiaryRecord[];
}

/**
 * Use DeepSeek V3.1 to re-parse HTML when validation fails
 * For image-based documents, uses Qwen-VL (vision model)
 * For PDF documents, uses Qwen-VL with PDF support
 */
export async function llmFallbackParse(
  doc: string,
  originalResult: ParseResult,
  filingInfo: {
    accession_number: string;
    cik: string;
    filingCompanyId: string;
    filingCompanyName: string;
  }
): Promise<ParseResult> {
  try {
    logger.info(`LLM fallback parsing for ${filingInfo.accession_number}`);

    // Determine if we need vision model based on classification
    const isVisionModel = originalResult.classification === "image-based";
    const isPDF = originalResult.classification === "pdf-based";
    
    let llmResult: LLMParseResponse | null;
    
    if (isPDF) {
      // Use Qwen-VL for PDF documents
      logger.info(`Using Qwen-VL vision model for PDF document ${filingInfo.accession_number}`);
      llmResult = await callQwenPDFAPI(doc, filingInfo.accession_number, filingInfo.cik);
    } else if (isVisionModel) {
      // Use Qwen-VL for image-based documents
      llmResult = await callQwenVisionAPI(doc, filingInfo.accession_number, filingInfo.cik);
    } else {
      // Use DeepSeek for text-based documents
      llmResult = await callDeepSeekAPI(doc, filingInfo.accession_number, filingInfo.cik, false);
    }
    
    if (!llmResult || !llmResult.subsidiaries || llmResult.subsidiaries.length === 0) {
      logger.warn(`LLM returned no subsidiaries for ${filingInfo.accession_number}`);
      return {
        ...originalResult,
        llmApplied: true,
        llmModified: false,
        status: "empty",
      };
    }

    // Convert LLM results to SubsidiaryRecord format and filter out invalid records
    const validSubsidiaries: SubsidiaryRecord[] = [];

    for (const llmSub of llmResult.subsidiaries) {
      // Skip records with null/empty name or jurisdiction
      if (!llmSub.name || !llmSub.name.trim() || !llmSub.jurisdiction || !llmSub.jurisdiction.trim()) {
        logger.warn(`Skipping invalid LLM subsidiary: name="${llmSub.name}", jurisdiction="${llmSub.jurisdiction}"`);
        continue;
      }

      // Determine company type based on jurisdiction presence
      const companyType = !llmSub.jurisdiction || llmSub.jurisdiction.trim() === '' 
        ? CompanyType.UNKNOWN 
        : CompanyType.SUBSIDIARY;

      const subsidiaryId = generateCompanyId({
        type: companyType,
        name: llmSub.name.trim(),
        jurisdiction_raw: llmSub.jurisdiction.trim(),
      });

      const record: SubsidiaryRecord = {
        id: subsidiaryId,
        name: llmSub.name.trim(),
        jurisdiction: llmSub.jurisdiction.trim(),
        nestingLevel: 0, // LLM doesn't provide nesting info
        ownership: llmSub.ownership_percentage || undefined,
        footnoteRefs: [],
        indentationSpaces: 0,
        isNested: false
      };
      validSubsidiaries.push(record);
    }

    // If no valid subsidiaries were extracted, return failed status
    if (validSubsidiaries.length === 0) {
      logger.warn(`LLM extracted ${llmResult.subsidiaries.length} subsidiaries but none were valid for ${filingInfo.accession_number}`);
      return {
        ...originalResult,
        llmApplied: true,
        llmModified: false,
        status: "failed",
        errorMessage: `LLM extracted ${llmResult.subsidiaries.length} subsidiaries but none had valid name and jurisdiction`,
      };
    }

    // Calculate modifications between original and LLM results
    const modifications = calculateModifications(originalResult.subsidiaries, validSubsidiaries);

    const enhancedResult: ParseResult = {
      subsidiaries: validSubsidiaries,
      method: originalResult.method ?? "unknown",
      llmApplied: true,
      llmModified: modifications.length > 0,
      status: "success",
      classification: originalResult.classification + " (LLM enhanced)",
      tableCount: originalResult.tableCount,
      expectedRowCount: originalResult.expectedRowCount,
      maxNestingLevel: 0, // LLM doesn't preserve nesting
      footnotesHtml: originalResult.footnotesHtml,
      llmModifications: modifications
    };

    logger.info(`LLM fallback successful: ${validSubsidiaries.length} valid subsidiaries extracted (${llmResult.subsidiaries.length - validSubsidiaries.length} invalid records skipped)`);
    return enhancedResult;

  } catch (error) {
    logger.error(`LLM fallback failed for ${filingInfo.accession_number}: ${error instanceof Error ? error.message : String(error)}`);
    
    return {
      ...originalResult,
      llmApplied: true,
      llmModified: false,
      status: "failed",
      errorMessage: `LLM fallback failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Call Qwen-VL API for PDF document parsing
 * Uses OpenRouter's mistral-ocr engine to parse PDF, then Qwen-VL vision model to extract subsidiaries
 */
async function callQwenPDFAPI(pdfContent: string, accessionNumber: string, cik: string): Promise<LLMParseResponse | null> {
  try {
    logger.debug(`Calling Qwen-VL (with mistral-ocr) for PDF ${accessionNumber}`);
    
    // Convert PDF content to Buffer using latin1 (binary-safe encoding)
    const pdfBuffer = Buffer.from(pdfContent, 'latin1');
    
    // Upload PDF directly to OpenRouter with mistral-ocr engine for parsing
    logger.info(`Uploading PDF to Qwen-VL (mistral-ocr engine) for ${accessionNumber}`);
    const base64Pdf = pdfBuffer.toString('base64');
    const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;
    
    const result = await callQwenForSubsidiaries([], { pdfUrl: pdfDataUrl });
    
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
async function callQwenVisionAPI(html: string, accessionNumber: string, cik: string): Promise<LLMParseResponse | null> {
  try {
    logger.debug(`Calling Qwen-VL for ${accessionNumber}`);
    
    // Extract image URLs from HTML
    const imageUrls = extractImageUrls(html, accessionNumber, cik);
    
    if (imageUrls.length === 0) {
      logger.warn(`No images found for vision model in ${accessionNumber}`);
      return null;
    }
    
    logger.info(`Extracted ${imageUrls.length} image URLs for ${accessionNumber}`);
    
    // Call Qwen-VL directly (not through worker pool since it's a different API)
    const result = await callQwenForSubsidiaries(imageUrls);
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
 * Call DeepSeek V3.1 API for text or Qwen3-VL-Plus for vision using worker pool
 */
async function callDeepSeekAPI(html: string, accessionNumber: string, cik: string, isVisionModel: boolean = false): Promise<LLMParseResponse | null> {
  const workerPool = getLLMWorkerPool();
  
  try {
    logger.debug(`Queuing LLM request for ${accessionNumber}${isVisionModel ? ' (vision model)' : ''}`);
    
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
  const accessionNoDashes = accessionNumber.replace(/-/g, '');
  
  // Match img tags with src attribute
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    
    // Skip data URLs and absolute URLs
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      if (src.startsWith('http://') || src.startsWith('https://')) {
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

/**
 * Calculate modifications between original and LLM results
 */
function calculateModifications(
  original: SubsidiaryRecord[],
  llmResult: SubsidiaryRecord[]
): LLMModification[] {
  const modifications: LLMModification[] = [];

  // Create a map for easier comparison
  const originalMap = new Map(original.map(s => [s.name.toLowerCase().trim(), s]));
  const llmMap = new Map(llmResult.map(s => [s.name.toLowerCase().trim(), s]));

  // Check each LLM result against original
  llmResult.forEach(llmSub => {
    const key = llmSub.name.toLowerCase().trim();
    const originalSub = originalMap.get(key);
    
    if (!originalSub) {
      // New subsidiary added by LLM
      modifications.push({
        subsidiaryId: llmSub.id,
        fieldChanges: [{
          field: "subsidiary_added",
          oldValue: null,
          newValue: llmSub.name
        }]
      });
    } else {
      // Compare fields for existing subsidiaries
      const fieldChanges: { field: string; oldValue: unknown; newValue: unknown }[] = [];
      
      if (originalSub.jurisdiction !== llmSub.jurisdiction) {
        fieldChanges.push({
          field: "jurisdiction",
          oldValue: originalSub.jurisdiction,
          newValue: llmSub.jurisdiction
        });
      }
      
      if (originalSub.ownership !== llmSub.ownership) {
        fieldChanges.push({
          field: "ownership",
          oldValue: originalSub.ownership,
          newValue: llmSub.ownership
        });
      }
      
      if (fieldChanges.length > 0) {
        modifications.push({
          subsidiaryId: llmSub.id,
          fieldChanges
        });
      }
    }
  });

  // Check for subsidiaries removed by LLM
  original.forEach(originalSub => {
    const key = originalSub.name.toLowerCase().trim();
    if (!llmMap.has(key)) {
      modifications.push({
        subsidiaryId: originalSub.id,
        fieldChanges: [{
          field: "subsidiary_removed",
          oldValue: originalSub.name,
          newValue: null
        }]
      });
    }
  });

  return modifications;
}
