import type { AIClient } from "./types.js";
import { OpenAIClient } from "./openai-client.js";
import { GoogleClient } from "./google-client.js";
import { FallbackClient } from "./fallback.js";

export type AIProvider = "anthropic" | "openai" | "ollama" | "google";

export interface AIProviderConfig {
  provider: AIProvider;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  googleApiKey?: string;
}

/**
 * Tạo AIClient phù hợp dựa trên config provider. Có hỗ trợ Fallback tự động.
 */
export function createAIClient(cfg: AIProviderConfig): AIClient {
  switch (cfg.provider) {
    case "anthropic": {
      throw new Error("Anthropic has been temporarily disabled. Please use openai provider.");
    }

    case "openai":
      return new OpenAIClient(cfg.openaiApiKey ?? "", cfg.openaiBaseUrl);

    case "ollama":
      // Ollama dùng OpenAI-compatible API, default port 11434
      return new OpenAIClient(
        cfg.openaiApiKey ?? "ollama",
        cfg.openaiBaseUrl ?? "http://localhost:11434/v1"
      );

    case "google":
      return new GoogleClient(cfg.googleApiKey ?? "");

    default:
      throw new Error(`Unknown AI provider: ${cfg.provider}`);
  }
}
