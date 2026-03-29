import type { AIClient } from "./types.js";
import { AnthropicClient } from "./client.js";
import { OpenAIClient } from "./openai-client.js";

export type AIProvider = "anthropic" | "openai" | "ollama";

export interface AIProviderConfig {
  provider: AIProvider;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
}

/**
 * Tạo AIClient phù hợp dựa trên config provider.
 */
export function createAIClient(cfg: AIProviderConfig): AIClient {
  switch (cfg.provider) {
    case "anthropic":
      return new AnthropicClient(cfg.anthropicApiKey ?? "auto");

    case "openai":
      return new OpenAIClient(cfg.openaiApiKey ?? "", cfg.openaiBaseUrl);

    case "ollama":
      // Ollama dùng OpenAI-compatible API, default port 11434
      return new OpenAIClient(
        cfg.openaiApiKey ?? "ollama",
        cfg.openaiBaseUrl ?? "http://localhost:11434/v1"
      );

    default:
      throw new Error(`Unknown AI provider: ${cfg.provider}`);
  }
}
