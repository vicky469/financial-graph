import { createLogger } from "../utils/logger";

const logger = createLogger("integration/qwen");

export enum QwenErrorCode {
  // Network/Infrastructure errors (retryable)
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  SERVER_OVERLOADED = "SERVER_OVERLOADED",
  RATE_LIMIT = "RATE_LIMIT",

  // Client errors (non-retryable)
  INVALID_FORMAT = "INVALID_FORMAT",
  AUTH_FAILED = "AUTH_FAILED",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INVALID_PARAMS = "INVALID_PARAMS",

  // Our internal parsing errors (non-retryable)
  JSON_PARSE_ERROR = "JSON_PARSE_ERROR",
  NO_CONTENT_ERROR = "NO_CONTENT_ERROR",

  // Unknown errors (non-retryable by default)
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class QwenError extends Error {
  constructor(
    public code: QwenErrorCode,
    message: string,
    public originalError?: Error,
    public httpStatus?: number,
  ) {
    super(message);
    this.name = "QwenError";
  }

  get isRetryable(): boolean {
    return [
      QwenErrorCode.NETWORK_ERROR,
      QwenErrorCode.TIMEOUT_ERROR,
      QwenErrorCode.SERVER_ERROR,
      QwenErrorCode.SERVER_OVERLOADED,
      QwenErrorCode.RATE_LIMIT,
    ].includes(this.code);
  }
}

export interface QwenSubsidiaryRecord {
  name: string;
  jurisdiction: string;
  ownership_percentage?: number | null;
}

export interface QwenParseResponse {
  subsidiaries: QwenSubsidiaryRecord[];
}

export type QwenRequestOptions = {
  requestTimeout?: number;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  imageUrls?: string[]; // Image URLs for vision model
  pdfUrl?: string; // PDF URL for document parsing
};

const DEFAULT_VISION_MODEL = "qwen/qwen-2-vl-72b-instruct"; // Qwen vision model via OpenRouter
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 4000;

function buildVisionPrompt(): string {
  return `You are parsing SEC Exhibit 21 (Subsidiaries of the Registrant) from images or PDF documents. The content shows subsidiary data in tables or lists.

CRITICAL INSTRUCTIONS:
1. Look VERY CAREFULLY at the image(s) provided
2. Extract ALL company names and their jurisdictions that you can see
3. If you see a table, extract every row
4. If you see a list, extract every item
5. DO NOT make up or hallucinate data - only extract what you actually see in the image
6. If you cannot see any subsidiary information clearly, return an empty array

PARSING RULES:
1. Extract company names and their jurisdictions from the image/document
2. Company names often have jurisdictions in parentheses or in adjacent columns
3. Common patterns:
   - "Company Name (State)" → name: "Company Name", jurisdiction: "State"
   - Table format: Name column | Jurisdiction column
   - List format: "Company Name - State"
4. Jurisdictions are typically: US states, countries, or cities
5. Legal suffixes (Inc., LLC, Ltd., Limited, Corp., etc.) are part of the company name
6. Look for headers like "Subsidiaries", "Name", "Jurisdiction", "State of Incorporation"

For each entity visible in the images/document, extract:
- name: Clean company name (REQUIRED - must be visible in image)
- jurisdiction: Geographic location (REQUIRED - must be visible in image)
- ownership_percentage: Number if explicitly stated, otherwise null

IMPORTANT: Only return subsidiaries that you can ACTUALLY SEE in the image. Do not invent example data.

Return ONLY a JSON object with this structure:
{
  "subsidiaries": [
    {
      "name": "Company Name",
      "jurisdiction": "Delaware",
      "ownership_percentage": 100
    }
  ]
}

If you cannot see any subsidiary data in the image, return:
{
  "subsidiaries": []
}`;
}

export async function callQwenForSubsidiaries(
  imageUrls: string[],
  options: QwenRequestOptions = {},
): Promise<QwenParseResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new QwenError(
      QwenErrorCode.AUTH_FAILED,
      "OPENROUTER_API_KEY environment variable not set",
    );
  }

  const {
    requestTimeout = 30000,
    model = DEFAULT_VISION_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    pdfUrl,
  } = options;

  const prompt = buildVisionPrompt();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

  try {
    // Build message content with text and images/PDF (OpenRouter format)
    const content: any[] = [{ type: "text", text: prompt }];
    
    // Add PDF if provided
    if (pdfUrl) {
      content.push({
        type: "file",
        file: {
          filename: "exhibit.pdf",
          file_data: pdfUrl,
        },
      });
    }
    
    // Add all image URLs
    for (const url of imageUrls) {
      content.push({
        type: "image_url",
        image_url: { url },
      });
    }

    const messages = [
      {
        role: "user",
        content,
      },
    ];

    // OpenRouter API endpoint
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/your-repo", // Optional: for rankings
        "X-Title": "Financial Graph Subsidiary Parser", // Optional: for rankings
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        // Use mistral-ocr engine for better PDF parsing (especially for scanned documents)
        plugins: pdfUrl ? [
          {
            id: "file-parser",
            pdf: {
              engine: "mistral-ocr", // Better for scanned/image-based PDFs
            },
          },
        ] : undefined,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      const statusText = response.statusText;
      const message = `Qwen API error: ${status} ${statusText}`;

      switch (status) {
        case 400:
          throw new QwenError(
            QwenErrorCode.INVALID_FORMAT,
            message,
            undefined,
            status,
          );
        case 401:
          throw new QwenError(
            QwenErrorCode.AUTH_FAILED,
            message,
            undefined,
            status,
          );
        case 402:
          throw new QwenError(
            QwenErrorCode.INSUFFICIENT_BALANCE,
            message,
            undefined,
            status,
          );
        case 422:
          throw new QwenError(
            QwenErrorCode.INVALID_PARAMS,
            message,
            undefined,
            status,
          );
        case 429:
          throw new QwenError(
            QwenErrorCode.RATE_LIMIT,
            message,
            undefined,
            status,
          );
        case 500:
          throw new QwenError(
            QwenErrorCode.SERVER_ERROR,
            message,
            undefined,
            status,
          );
        case 503:
          throw new QwenError(
            QwenErrorCode.SERVER_OVERLOADED,
            message,
            undefined,
            status,
          );
        default:
          throw new QwenError(
            QwenErrorCode.UNKNOWN_ERROR,
            message,
            undefined,
            status,
          );
      }
    }

    const data = await response.json();
    const content_response = data.choices?.[0]?.message?.content;

    if (!content_response) {
      throw new QwenError(
        QwenErrorCode.NO_CONTENT_ERROR,
        "No content in Qwen API response",
      );
    }

    const jsonMatch = content_response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new QwenError(
        QwenErrorCode.NO_CONTENT_ERROR,
        "No JSON found in LLM response",
      );
    }

    try {
      return JSON.parse(jsonMatch[0]) as QwenParseResponse;
    } catch (parseError) {
      throw new QwenError(
        QwenErrorCode.JSON_PARSE_ERROR,
        `JSON Parse error: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`,
        parseError instanceof Error ? parseError : undefined,
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof QwenError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new QwenError(
        QwenErrorCode.TIMEOUT_ERROR,
        `Request timeout after ${requestTimeout}ms`,
        error,
      );
    }

    logger.warn("Qwen request failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    throw new QwenError(
      QwenErrorCode.NETWORK_ERROR,
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
    );
  }
}
