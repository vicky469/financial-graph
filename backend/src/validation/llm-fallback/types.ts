export interface LLMSubsidiaryRecord {
  name: string;
  jurisdiction?: string | null;
  ownership_percentage?: number | null;
}

export interface LLMParseResponse {
  subsidiaries: LLMSubsidiaryRecord[];
}

export type FilingContext = {
  accession_number: string;
  cik: string;
  filingCompanyId: string;
  filingCompanyName: string;
};

export type FallbackProvider = "deepseek" | "qwen-vl" | "gpt";

export type ProviderRequestType = "pdf" | "vision" | "text";

export type FallbackProviderTelemetry = {
  provider: FallbackProvider;
  model: string;
  requestType: ProviderRequestType;
  fallbackFrom?: FallbackProvider;
  fallbackReasonCode?: string;
};

export type FallbackExecution = {
  provider: FallbackProvider;
  llmResult: LLMParseResponse | null;
  telemetry: FallbackProviderTelemetry;
};
