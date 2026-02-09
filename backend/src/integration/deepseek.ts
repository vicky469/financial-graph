import { createLogger } from "../utils/logger";

const logger = createLogger("integration/deepseek");

export enum DeepSeekErrorCode {
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

export class DeepSeekError extends Error {
  constructor(
    public code: DeepSeekErrorCode,
    message: string,
    public originalError?: Error,
    public httpStatus?: number,
  ) {
    super(message);
    this.name = "DeepSeekError";
  }

  get isRetryable(): boolean {
    return [
      DeepSeekErrorCode.NETWORK_ERROR,
      DeepSeekErrorCode.TIMEOUT_ERROR,
      DeepSeekErrorCode.SERVER_ERROR,
      DeepSeekErrorCode.SERVER_OVERLOADED,
      DeepSeekErrorCode.RATE_LIMIT,
    ].includes(this.code);
  }
}

export interface DeepSeekSubsidiaryRecord {
  name: string;
  jurisdiction: string;
  ownership_percentage?: number | null;
}

export interface DeepSeekParseResponse {
  subsidiaries: DeepSeekSubsidiaryRecord[];
}

export type DeepSeekRequestOptions = {
  requestTimeout?: number;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 4000;
const MAX_HTML_CHARS = 50000;

function buildPrompt(html: string): string {
  return `You are parsing SEC Exhibit 21 (Subsidiaries of the Registrant) from HTML files. Extract subsidiary information with careful attention to separating company names from jurisdictions.

IMPORTANT PARSING RULES:
1. Company names often contain jurisdictions in parentheses, or at the end
2. Common patterns to parse:
   - "Company Name (State)" → name: "Company Name", jurisdiction: "State"
   - "Company Name, Inc. (Delaware)" → name: "Company Name, Inc.", jurisdiction: "Delaware"
   - "Company Name Limited" → name: "Company Name Limited", jurisdiction: extract from context
   - "Cui Yi Information Science and Technology (Shanghai) Company Limited" → name: "Cui Yi Information Science and Technology Company Limited", jurisdiction: "Shanghai"
3. Jurisdictions are typically: US states, countries, or cities (like Shanghai, Hong Kong)
4. Legal suffixes (Inc., LLC, Ltd., Limited, Corp., etc.) are part of the company name
5. If jurisdiction appears within the company name, extract it separately

For each entity, extract:
- name: Clean company name without jurisdiction info in parentheses
- jurisdiction: Geographic location (state, country, or city)
- ownership_percentage: Number if explicitly stated, otherwise null

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

HTML content:
${html.substring(0, MAX_HTML_CHARS)}`;
}

export async function callDeepSeekForSubsidiaries(
  html: string,
  options: DeepSeekRequestOptions = {},
): Promise<DeepSeekParseResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekError(
      DeepSeekErrorCode.AUTH_FAILED,
      "DEEPSEEK_API_KEY environment variable not set",
    );
  }

  const {
    requestTimeout = 30000,
    model = DEFAULT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = options;

  const prompt = buildPrompt(html);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      const statusText = response.statusText;
      const message = `DeepSeek API error: ${status} ${statusText}`;

      switch (status) {
        case 400:
          throw new DeepSeekError(
            DeepSeekErrorCode.INVALID_FORMAT,
            message,
            undefined,
            status,
          );
        case 401:
          throw new DeepSeekError(
            DeepSeekErrorCode.AUTH_FAILED,
            message,
            undefined,
            status,
          );
        case 402:
          throw new DeepSeekError(
            DeepSeekErrorCode.INSUFFICIENT_BALANCE,
            message,
            undefined,
            status,
          );
        case 422:
          throw new DeepSeekError(
            DeepSeekErrorCode.INVALID_PARAMS,
            message,
            undefined,
            status,
          );
        case 429:
          throw new DeepSeekError(
            DeepSeekErrorCode.RATE_LIMIT,
            message,
            undefined,
            status,
          );
        case 500:
          throw new DeepSeekError(
            DeepSeekErrorCode.SERVER_ERROR,
            message,
            undefined,
            status,
          );
        case 503:
          throw new DeepSeekError(
            DeepSeekErrorCode.SERVER_OVERLOADED,
            message,
            undefined,
            status,
          );
        default:
          throw new DeepSeekError(
            DeepSeekErrorCode.UNKNOWN_ERROR,
            message,
            undefined,
            status,
          );
      }
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new DeepSeekError(
        DeepSeekErrorCode.NO_CONTENT_ERROR,
        "No content in DeepSeek API response",
      );
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new DeepSeekError(
        DeepSeekErrorCode.NO_CONTENT_ERROR,
        "No JSON found in LLM response",
      );
    }

    try {
      return JSON.parse(jsonMatch[0]) as DeepSeekParseResponse;
    } catch (parseError) {
      throw new DeepSeekError(
        DeepSeekErrorCode.JSON_PARSE_ERROR,
        `JSON Parse error: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`,
        parseError instanceof Error ? parseError : undefined,
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DeepSeekError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new DeepSeekError(
        DeepSeekErrorCode.TIMEOUT_ERROR,
        `Request timeout after ${requestTimeout}ms`,
        error,
      );
    }

    logger.warn("DeepSeek request failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    throw new DeepSeekError(
      DeepSeekErrorCode.NETWORK_ERROR,
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
    );
  }
}
