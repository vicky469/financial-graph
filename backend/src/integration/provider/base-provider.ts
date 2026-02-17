import {
  LLMProvider,
  LLMProviderConfig,
  LLMProviderInput,
  LLMProviderParseResponse,
} from "./types";

export abstract class BaseLLMProvider<TInput extends LLMProviderInput>
  implements LLMProvider<TInput>
{
  constructor(public readonly config: LLMProviderConfig) {}

  protected abstract buildRequest(input: TInput): Promise<unknown> | unknown;

  protected abstract executeRequest(
    request: unknown,
    input: TInput,
  ): Promise<unknown>;

  protected abstract parseResponse(
    response: unknown,
  ): LLMProviderParseResponse | null;

  abstract isRetryable(error: unknown): boolean;

  abstract mapError(error: unknown): Error;

  async execute(input: TInput): Promise<LLMProviderParseResponse | null> {
    const request = await this.buildRequest(input);
    try {
      const response = await this.executeRequest(request, input);
      return this.parseResponse(response);
    } catch (error) {
      throw this.mapError(error);
    }
  }
}

