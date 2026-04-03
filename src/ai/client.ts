import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam as AnthropicMsgParam } from "@anthropic-ai/sdk/resources/messages.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import type { AIClient, AIRequest, AIStreamEvent, ToolDefinition, MessageParam } from "./types.js";

const CREDENTIALS_PATH = path.join(os.homedir(), ".claude", ".credentials.json");
const OAUTH_HEADERS = {
  "anthropic-beta": "claude-code-20250219,oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14,max-tokens-3-5-sonnet-2024-07-15,prompt-caching-2024-07-31",
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
          { type: "text" as const, text: req.systemPrompt, cache_control: { type: "ephemeral" as const } },
        ]
      : [
          { type: "text" as const, text: req.systemPrompt, cache_control: { type: "ephemeral" as const } }
        ];

    let fullText = "";

    try {
      const client = this.getClient();
      const reqOptions = req.signal ? { signal: req.signal } : undefined;
      const anthropicTools = req.toolHandler?.tools.map(toAnthropicTool) ?? [];
      
      // Gắn cờ Prompt Caching vào tool cuối cùng (Sẽ group toàn bộ system và tools phía trước vào 1 cache block)
      if (anthropicTools.length > 0) {
        (anthropicTools[anthropicTools.length - 1] as any).cache_control = { type: "ephemeral" };
      }

      let currentMessages: AnthropicMsgParam[] = [...messages];
      const MAX_STEPS = 25;

      for (let step = 0; step < MAX_STEPS; step++) {
        let finalMaxTokens = req.maxTokens;
        let thinkingOptions: any = undefined;
        
        if (req.thinkingBudgetTokens && req.thinkingBudgetTokens >= 1024) {
           thinkingOptions = { type: "enabled", budget_tokens: req.thinkingBudgetTokens };
           finalMaxTokens = Math.max(req.maxTokens, req.thinkingBudgetTokens + 4000); // Đảm bảo output có không gian trả lời sau khi ngốn đống budget để suy nghĩ
        }

        const params = {
          model: req.model,
          max_tokens: finalMaxTokens,
          ...(thinkingOptions ? { thinking: thinkingOptions } : {}),
          system,
          messages: currentMessages,
          ...(anthropicTools.length ? { tools: anthropicTools } : {}),
        } as Parameters<typeof client.messages.stream>[0];

        const reqOptions = {
          headers: { ...OAUTH_HEADERS },
          ...(req.signal ? { signal: req.signal } : {}),
        };

        console.log(`[ai/client] step ${step} maxTokens param sent:`, params.max_tokens);

        const stream = client.messages.stream(params, reqOptions);

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullText += event.delta.text;
            yield { type: "delta", delta: event.delta.text, fullText };
          }
        }

        const finalMsg = await stream.finalMessage();
        console.log(`[ai/client] step ${step} stop_reason:`, finalMsg.stop_reason);

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

          currentMessages.push({ role: "assistant", content: finalMsg.content as AnthropicMsgParam["content"] });
          currentMessages.push({ role: "user", content: toolResults as AnthropicMsgParam["content"] });

          if (fullText && !fullText.endsWith("\n")) {
            fullText += "\n";
          }
          // Lặp lại vòng lặp step để bot nhận tool result và chém tiếp
        } else {
          // Thực sự gõ xong
          break;
        }
      } // end for loop

      yield { 
        type: "done", 
        fullText,
        assistantMessages: currentMessages.slice(messages.length) as MessageParam[]
      };
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
        
        // Auto trigger Claude Code CLI ngầm để nó tự refresh token
        try {
          const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
          execSync(`${cmd} -y @anthropic-ai/claude-code -p "K"`, { stdio: "ignore" });
        } catch (e) {
          console.error("[ai/client] Failed to trigger claude-code refresh", e);
        }

        invalidateTokenCache();
        yield* this.stream({ ...req, _retried: true });
        return;
      }

      yield { type: "error", error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}
