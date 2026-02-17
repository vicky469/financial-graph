import { createDefaultProviderRegistry, ProviderRegistry } from "./provider-registry";
import { LLMProvider, ProviderName, ProviderRoute } from "./types";
import { DocumentClassification } from "../../parser/subsidiary/parser-types";

export function resolveProviderRoute(classification: string): ProviderRoute {
  if (classification === DocumentClassification.PDF_BASED) {
    return {
      providerName: "qwen-vl",
      requestType: "pdf",
    };
  }

  if (classification === DocumentClassification.IMAGE_BASED) {
    return {
      providerName: "qwen-vl",
      requestType: "vision",
    };
  }

  return {
    providerName: "deepseek",
    requestType: "text",
    fallbackProviderName: "gpt",
  };
}

export class ProviderRouter {
  constructor(private readonly registry: ProviderRegistry) {}

  resolveRoute(classification: string): ProviderRoute {
    return resolveProviderRoute(classification);
  }

  getProvider(providerName: ProviderName): LLMProvider {
    return this.registry.getProvider(providerName);
  }
}

export function createProviderRouter(
  registry: ProviderRegistry = createDefaultProviderRegistry(),
): ProviderRouter {
  return new ProviderRouter(registry);
}

let defaultProviderRouter: ProviderRouter | null = null;

export function getDefaultProviderRouter(): ProviderRouter {
  if (!defaultProviderRouter) {
    defaultProviderRouter = createProviderRouter();
  }
  return defaultProviderRouter;
}
