/**
 * LLM Provider abstraction
 * 
 * Supports multiple LLM backends:
 * - Ollama (via HTTP API)
 * - llama.cpp (via node-llama-cpp with batch support)
 * 
 * Configure via environment variables:
 * - LLM_PROVIDER: "ollama" | "llamacpp"
 * - LLM_MODEL: model name/path
 * - LLM_BATCH_SIZE: number of prompts to process in parallel (llamacpp only)
 * - LLM_CONTEXT_SIZE: context window size (default: 4096)
 * - LLM_THREADS: number of CPU threads (default: auto)
 */

export interface LLMProvider {
  generate(prompt: string): Promise<string>;
  generateBatch(prompts: string[]): Promise<string[]>;
  getName(): string;
  dispose?(): Promise<void>;
}

/**
 * Ollama provider (HTTP API)
 */
export class OllamaProvider implements LLMProvider {
  private host: string;
  private model: string;

  constructor(host: string = "http://localhost:11434", model: string = "qwen2:7b") {
    this.host = host;
    this.model = model;
  }

  async generate(prompt: string): Promise<string> {
    const { Ollama } = await import("ollama");
    const ollama = new Ollama({ host: this.host });
    
    const response = await ollama.generate({
      model: this.model,
      prompt,
      stream: false,
    });

    return response.response.trim();
  }

  async generateBatch(prompts: string[]): Promise<string[]> {
    // Ollama doesn't support native batching, process sequentially
    const results: string[] = [];
    for (const prompt of prompts) {
      results.push(await this.generate(prompt));
    }
    return results;
  }

  getName(): string {
    return `ollama:${this.model}`;
  }
}

/**
 * llama.cpp provider (using llama-server HTTP API)
 * 
 * Uses the llama-server binary installed via Homebrew.
 * Requires llama-server to be running on the specified host/port.
 * 
 * Start llama-server:
 *   llama-server -m /path/to/model.gguf -c 4096 --port 8080
 * 
 * On M1 Max 65GB, you can:
 * - Load 1 model instance (~8GB for 7B Q5)
 * - Process multiple requests in parallel via HTTP
 * - Use Metal GPU acceleration automatically
 */
export class LlamaCppProvider implements LLMProvider {
  private host: string;
  private modelName: string;

  constructor(
    host: string = "http://localhost:8080",
    modelName: string = "qwen2"
  ) {
    this.host = host;
    this.modelName = modelName;
  }

  async generate(prompt: string): Promise<string> {
    const response = await fetch(`${this.host}/v1/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        max_tokens: 128, // Reduced from 256 - most responses are short
        temperature: 0.1,
        stop: ["\n\n", "###"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`llama-server error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].text.trim();
  }

  /**
   * Batch processing: sends requests in parallel (up to 4 concurrent)
   * llama-server has 4 slots for parallel processing
   */
  async generateBatch(prompts: string[]): Promise<string[]> {
    const BATCH_SIZE = 4; // Match llama-server parallel slots
    const results: string[] = [];
    
    // Process in batches of 4
    for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
      const chunk = prompts.slice(i, i + BATCH_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(prompt => this.generate(prompt))
      );
      results.push(...chunkResults);
    }
    
    return results;
  }

  getName(): string {
    return `llamacpp-server:${this.modelName}`;
  }
}

/**
 * Factory function to create LLM provider based on environment config
 */
export function createLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "ollama";
  const model = process.env.LLM_MODEL;

  switch (provider.toLowerCase()) {
    case "ollama":
      return new OllamaProvider(
        process.env.OLLAMA_HOST || "http://localhost:11434",
        model || "qwen2:7b"
      );

    case "llamacpp":
      return new LlamaCppProvider(
        process.env.LLAMACPP_HOST || "http://localhost:8080",
        model || "qwen2"
      );

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
