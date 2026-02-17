import { DeepSeekProvider } from "./deepseek-provider";
import { OpenRouterTextProvider } from "./openrouter-text-provider";
import { OpenRouterVisionProvider } from "./openrouter-vision-provider";
import { LLMProvider, ProviderName } from "./types";

export class ProviderRegistry {
  private readonly providers: Map<ProviderName, LLMProvider>;

  constructor(providers: Iterable<LLMProvider>) {
    this.providers = new Map();
    for (const provider of providers) {
      this.providers.set(provider.config.providerName, provider);
    }
  }

  getProvider(providerName: ProviderName): LLMProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider not registered: ${providerName}`);
    }
    return provider;
  }
}

export type ProviderRegistryOverrides = Partial<Record<ProviderName, LLMProvider>>;

export function createDefaultProviderRegistry(
  overrides: ProviderRegistryOverrides = {},
): ProviderRegistry {
  const deepseek = overrides.deepseek || new DeepSeekProvider();
  const qwen = overrides["qwen-vl"] || new OpenRouterVisionProvider();
  const gpt = overrides.gpt || new OpenRouterTextProvider();
  return new ProviderRegistry([deepseek, qwen, gpt]);
}

