import OpenAI from "openai";
import type { AIClient, AIRequest, AIStreamEvent, ToolDefinition } from "./types.js";

/**
 * OpenAI-compatible client — hỗ trợ OpenAI API và Ollama (openai-compatible endpoint).
 * Ollama: đặt OPENAI_BASE_URL=http://localhost:11434/v1 và OPENAI_API_KEY=ollama
 */
export class OpenAIClient implements AIClient {
  private client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || "ollama",
      baseURL: baseUrl,
    });
  }

  async *stream(req: AIRequest): AsyncGenerator<AIStreamEvent> {
    let fullText = "";

    try {
      const messages = buildMessages(req);
      const tools = req.toolHandler?.tools.map(toOpenAITool) ?? [];

      const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
        model: req.model,
        max_tokens: req.maxTokens,
        messages,
        stream: true,
        ...(tools.length ? { tools, tool_choice: "auto" as const } : {}),
      };

      const stream = await this.client.chat.completions.create(params, {
        signal: req.signal,
      });

      // Accumulate tool calls across chunks
      const toolCallsMap: Record<number, {
        id: string;
        name: string;
        arguments: string;
      }> = {};

      let finishReason: string | null = null;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        finishReason = choice.finish_reason ?? finishReason;
        const delta = choice.delta;

        // Stream text
        if (delta.content) {
          fullText += delta.content;
          yield { type: "delta", delta: delta.content, fullText };
        }

        // Accumulate tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallsMap[tc.index]) {
              toolCallsMap[tc.index] = { id: tc.id ?? "", name: "", arguments: "" };
            }
            const entry = toolCallsMap[tc.index];
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name += tc.function.name;
            if (tc.function?.arguments) entry.arguments += tc.function.arguments;
          }
        }
      }

      const toolCalls = Object.values(toolCallsMap);

      // Handle tool calls
      if (finishReason === "tool_calls" && req.toolHandler && toolCalls.length > 0) {
        const toolResultMsgs: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];

        for (const tc of toolCalls) {
          let input: unknown;
          try {
            input = JSON.parse(tc.arguments || "{}");
          } catch {
            input = {};
          }
          const result = await req.toolHandler.execute(tc.name, input);
          toolResultMsgs.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }

        // Build assistant message with tool_calls
        const assistantToolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        }));

        const assistantMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
          role: "assistant",
          content: fullText || null,
          tool_calls: assistantToolCalls,
        };

        const messages2: OpenAI.Chat.ChatCompletionMessageParam[] = [
          ...messages,
          assistantMsg,
          ...toolResultMsgs,
        ];

        fullText = "";

        const stream2 = await this.client.chat.completions.create(
          {
            model: req.model,
            max_tokens: req.maxTokens,
            messages: messages2,
            stream: true,
          },
          { signal: req.signal }
        );

        for await (const chunk of stream2) {
          const d = chunk.choices[0]?.delta?.content;
          if (d) {
            fullText += d;
            yield { type: "delta", delta: d, fullText };
          }
        }
      }

      yield { type: "done", fullText };
    } catch (err) {
      yield { type: "error", error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMessages(req: AIRequest): OpenAI.Chat.ChatCompletionMessageParam[] {
  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (req.systemPrompt) {
    msgs.push({ role: "system", content: req.systemPrompt });
  }

  for (const h of req.history) {
    msgs.push({ role: h.role, content: h.content });
  }

  if (req.imageBase64) {
    msgs.push({
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:${req.imageMimeType ?? "image/jpeg"};base64,${req.imageBase64}`,
          },
        },
        { type: "text", text: req.userMessage },
      ],
    });
  } else {
    msgs.push({ role: "user", content: req.userMessage });
  }

  return msgs;
}

function toOpenAITool(t: ToolDefinition): OpenAI.Chat.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: t.input_schema.properties,
        required: t.input_schema.required ?? [],
      },
    },
  };
}
