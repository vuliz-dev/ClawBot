import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam as AnthropicMsgParam } from "@anthropic-ai/sdk/resources/messages.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AIClient, AIRequest, AIStreamEvent, ToolDefinition } from "./types.js";

const CREDENTIALS_PATH = path.join(os.homedir(), ".claude", ".credentials.json");
const OAUTH_HEADERS = {
  "anthropic-beta": "claude-code-20250219,oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14",
  "anthropic-dangerous-direct-browser-access": "true",
  "user-agent": "claude-cli/2.1.75",
  "x-app": "cli",
};

// Cache token + mtime để tránh đọc file liên tục
let _cachedToken: string | null = null;
let _cachedMtime: number = 0;

function readOAuthToken(): string | null {
  try {
    const stat = fs.statSync(CREDENTIALS_PATH);
    const mtime = stat.mtimeMs;

    // Chỉ re-read nếu file thay đổi hoặc chưa có cache
    if (_cachedToken && mtime === _cachedMtime) {
      return _cachedToken;
    }

    const raw = fs.readFileSync(CREDENTIALS_PATH, "utf8");
    const data = JSON.parse(raw) as Record<string, { accessToken?: string; expiresAt?: number }>;

    let bestToken: string | null = null;
    let latestExpiry = 0;

    for (const val of Object.values(data)) {
      if (val?.accessToken?.startsWith("sk-ant-oat")) {
        // Ưu tiên token còn hạn dài nhất
        const expiry = val.expiresAt ?? 0;
        if (!bestToken || expiry > latestExpiry) {
          bestToken = val.accessToken;
          latestExpiry = expiry;
        }
      }
    }

    _cachedToken = bestToken;
    _cachedMtime = mtime;
    return bestToken;
  } catch {
    return null;
  }
}

// Force clear cache để đọc lại token mới sau khi refresh
function invalidateTokenCache(): void {
  _cachedToken = null;
  _cachedMtime = 0;
}

function makeClient(token: string): Anthropic {
  return new Anthropic({
    apiKey: null as unknown as string,
    authToken: token,
    dangerouslyAllowBrowser: true,
    defaultHeaders: OAUTH_HEADERS,
  });
}

function toAnthropicTool(t: ToolDefinition): Anthropic.Tool {
  return {
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  };
}

export class AnthropicClient implements AIClient {
  private staticApiKey: string;
  private isOAuth: boolean;

  constructor(apiKey: string) {
    this.staticApiKey = apiKey;
    this.isOAuth = apiKey.startsWith("sk-ant-oat") || apiKey === "auto";
  }

  private getClient(): Anthropic {
    if (!this.isOAuth) {
      return new Anthropic({ apiKey: this.staticApiKey });
    }
    const token = readOAuthToken() ?? this.staticApiKey;
    return makeClient(token);
  }

  async *stream(req: AIRequest): AsyncGenerator<AIStreamEvent> {
    // Auto-refresh: nếu token hết hạn hoặc lỗi 401, invalidate cache và thử lại
    const userContent: AnthropicMsgParam["content"] = req.imageBase64
      ? [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (req.imageMimeType ?? "image/jpeg") as "image/jpeg",
              data: req.imageBase64,
            },
          },
          { type: "text", text: req.userMessage },
        ]
      : req.userMessage;

    const messages: AnthropicMsgParam[] = [
      ...req.history.map((m) => ({ role: m.role, content: m.content } as AnthropicMsgParam)),
      { role: "user", content: userContent },
    ];

    const system = this.isOAuth
      ? [
          { type: "text" as const, text: "You are Claude Code, Anthropic's official CLI for Claude." },
          { type: "text" as const, text: req.systemPrompt },
        ]
      : req.systemPrompt;

    let fullText = "";

    try {
      const client = this.getClient();
      const reqOptions = req.signal ? { signal: req.signal } : undefined;
      const anthropicTools = req.toolHandler?.tools.map(toAnthropicTool) ?? [];

      const params = {
        model: req.model,
        max_tokens: req.maxTokens,
        system,
        messages,
        ...(anthropicTools.length ? { tools: anthropicTools } : {}),
      } as Parameters<typeof client.messages.stream>[0];

      const stream1 = client.messages.stream(params, reqOptions);

      for await (const event of stream1) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;
          yield { type: "delta", delta: event.delta.text, fullText };
        }
      }

      const finalMsg = await stream1.finalMessage();

      if (finalMsg.stop_reason === "tool_use" && req.toolHandler) {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of finalMsg.content) {
          if (block.type === "tool_use") {
            const result = await req.toolHandler.execute(block.name, block.input);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        const messages2: AnthropicMsgParam[] = [
          ...messages,
          { role: "assistant", content: finalMsg.content as AnthropicMsgParam["content"] },
          { role: "user", content: toolResults as AnthropicMsgParam["content"] },
        ];

        fullText = "";

        const stream2 = client.messages.stream(
          { model: req.model, max_tokens: req.maxTokens, system, messages: messages2 },
          reqOptions
        );

        for await (const event of stream2) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullText += event.delta.text;
            yield { type: "delta", delta: event.delta.text, fullText };
          }
        }
      }

      yield { type: "done", fullText };
    } catch (err) {
      // Auto-refresh: nếu lỗi 401 (token hết hạn), invalidate cache và retry 1 lần
      const isAuthError =
        err instanceof Error &&
        (err.message.includes("401") ||
          err.message.includes("authentication") ||
          err.message.includes("unauthorized") ||
          err.message.toLowerCase().includes("token"));

      if (isAuthError && this.isOAuth && !req._retried) {
        console.warn("[ai/client] OAuth token expired, invalidating cache and retrying...");
        invalidateTokenCache();
        yield* this.stream({ ...req, _retried: true });
        return;
      }

      yield { type: "error", error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}
