// Common AI types shared across all providers

export type MessageRole = "user" | "assistant";

export interface MessageParam {
  role: MessageRole;
  content: string;
}

export interface AIStreamEvent {
  type: "delta" | "done" | "error";
  delta?: string;
  fullText?: string;
  error?: Error;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface ToolHandler {
  tools: ToolDefinition[];
  execute: (name: string, input: unknown) => Promise<string>;
}

export interface AIRequest {
  history: MessageParam[];
  userMessage: string;
  imageBase64?: string;
  imageMimeType?: string;
  model: string;
  maxTokens: number;
  systemPrompt: string;
  signal?: AbortSignal;
  toolHandler?: ToolHandler;
  /** Internal flag: đánh dấu đây là retry sau khi refresh token, tránh vòng lặp vô hạn */
  _retried?: boolean;
}

export interface AIClient {
  stream(req: AIRequest): AsyncGenerator<AIStreamEvent>;
}
