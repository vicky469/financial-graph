export type ProviderName = "deepseek" | "qwen-vl" | "gpt";

export type ProviderRequestType = "text" | "vision" | "pdf";

export type LLMProviderConfig = {
  providerName: ProviderName;
  modelName: string;
  url: string;
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
  maxRetries: number;
  retryBaseDelayMs: number;
};

type ProviderRequestBase = {
  accessionNumber: string;
  requestId?: string;
};

export type TextProviderInput = ProviderRequestBase & {
  requestType: "text";
  html: string;
};

export type VisionProviderInput = ProviderRequestBase & {
  requestType: "vision";
  imageUrls: string[];
};

export type PdfProviderInput = ProviderRequestBase & {
  requestType: "pdf";
  pdfDataUrl: string;
};

export type LLMProviderInput =
  | TextProviderInput
  | VisionProviderInput
  | PdfProviderInput;

export type LLMProviderParseResponse = {
  subsidiaries: Array<{
    name: string;
    jurisdiction?: string | null;
    ownership_percentage?: number | null;
  }>;
};

export interface LLMProvider<TInput extends LLMProviderInput = LLMProviderInput> {
  readonly config: LLMProviderConfig;
  execute(input: TInput): Promise<LLMProviderParseResponse | null>;
  isRetryable(error: unknown): boolean;
  mapError(error: unknown): Error;
}

export type ProviderRoute = {
  providerName: ProviderName;
  requestType: ProviderRequestType;
  fallbackProviderName?: ProviderName;
};

