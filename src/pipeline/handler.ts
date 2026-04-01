import type { InboundMessage } from "../core/types.js";
import type { AIClient, ToolHandler, ToolDefinition } from "../ai/types.js";
import type { SessionManager } from "../session/manager.js";
import type { ChannelRegistry } from "../channels/registry.js";
import type { Config } from "../config/env.js";
import type { CronManager } from "../plugins/cron.js";
import { registerStream, deregisterStream } from "./active-streams.js";
import { createApproval } from "./approval.js";
import { runBash } from "../plugins/bash.js";
import { getWeather } from "../plugins/skills/weather.js";
import { getDatetime } from "../plugins/skills/datetime.js";
import { calculate } from "../plugins/skills/calc.js";
import { fetchUrl } from "../plugins/fetch.js";
import { webSearch } from "../plugins/search.js";
import { searchMemory } from "../memory/search.js";
import { generateImage } from "../plugins/image.js";
import { readFile, writeFile, listDir } from "../plugins/fileio.js";
import path from "node:path";
import fs from "node:fs";
import { classifyComplexity, selectModel } from "../ai/router.js";

// ─── Dangerous command patterns (requires approval in "smart" mode) ───────────
const DANGEROUS_PATTERNS = [
  /rm\s+-rf?/i,
  /del\s+\/[sqf]/i,        // Windows del /s /q /f
  /rmdir\s+\/s/i,          // Windows rmdir /s
  /format\s+[a-z]:/i,
  /mkfs/i,
  /dd\s+if=/i,
  /shutdown|reboot|halt/i,
  />\s*\/dev\/(sd|hd|nvme)/i,
  /curl.*\|\s*(bash|sh|zsh)/i,
  /wget.*\|\s*(bash|sh|zsh)/i,
  /:\(\)\s*\{/,             // fork bomb
  /chmod\s+[0-7]*7[0-7]*\s+\//i,
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command));
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: ToolDefinition[] = [
  {
    name: "create_reminder",
    description:
      "Create a scheduled reminder (one-shot or recurring). " +
      "STRICT RULES: " +
      "1. ONLY call this tool when user EXPLICITLY requests a reminder with clear words: nhắc, đặt lịch, thông báo lúc, báo tôi lúc, remind me, set alarm. " +
      "2. NEVER call this tool just because user mentions time or activity. " +
      "3. ALWAYS ask 'Bạn muốn nhắc 1 lần hay lặp lại hằng ngày?' BEFORE calling this tool, unless user already specified. " +
      "4. For one-shot: use a future datetime cron or pass one_shot=true. " +
      "5. Default assumption is ONE-TIME unless user says daily/hằng ngày/mỗi ngày.",
    input_schema: {
      type: "object",
      properties: {
        cron_expression: {
          type: "string",
          description:
            "Standard 5-field cron expression: minute hour day month weekday. " +
            "Examples: '10 12 * * *' = daily at 12:10, '0 8 * * 1-5' = weekdays at 8:00",
        },
        message: {
          type: "string",
          description: "The reminder message to send. Use the same language as the user.",
        },
        one_shot: {
          type: "boolean",
          description: "If true, reminder runs once only. Default true unless user explicitly wants recurring.",
        },
      },
      required: ["cron_expression", "message"],
    },
  },
  {
    name: "get_weather",
    description:
      "Get the current weather for a location. Use when the user asks about weather, temperature, or forecast.",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City or location name, e.g. 'Ho Chi Minh City', 'Hanoi', 'London'",
        },
      },
      required: ["location"],
    },
  },
  {
    name: "get_datetime",
    description:
      "Get the current date and time. Use when the user asks what time or date it is.",
    input_schema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "Optional IANA timezone, e.g. 'Asia/Ho_Chi_Minh'. Defaults to Vietnam time.",
        },
      },
      required: [],
    },
  },
  {
    name: "calculate",
    description:
      "Evaluate a mathematical expression and return the result. Use for arithmetic, percentages, exponents, etc.",
    input_schema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Math expression, e.g. '(12 + 8) * 5 / 2', '2^10', '15% of 240'",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "run_bash",
    description:
      "Execute a shell command and return its output. Use when the user asks to run a command, check system info, list files, etc. " +
      "Dangerous commands (rm -rf, format, etc.) will require user approval before execution.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to run",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "fetch_url",
    description:
      "Fetch the text content of a URL. Use when the user asks to read a webpage, check a link, or get content from the internet.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The full URL to fetch, e.g. 'https://example.com'",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "web_search",
    description:
      "Search the web for information. Use when the user asks about current events, facts, or anything that requires searching online.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "memory_search",
    description:
      "Search through saved conversation history (memories) for relevant past discussions. " +
      "Use when the user references past conversations, asks 'what did we talk about', or seems to expect context from older chats.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keywords or topic to search for in past conversations",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "generate_image",
    description:
      "Tạo ảnh từ mô tả bằng Stable Diffusion XL. Dùng khi người dùng yêu cầu vẽ, tạo ảnh, hoặc minh họa. " +
      "Mô tả prompt bằng tiếng Anh chi tiết sẽ cho kết quả tốt hơn.",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Mô tả ảnh muốn tạo. Có thể là tiếng Việt hoặc tiếng Anh.",
        },
        size: {
          type: "string",
          description: "Kích thước ảnh: '1024x1024' (vuông, mặc định), '1792x1024' (ngang), '1024x1792' (dọc)",
          enum: ["1024x1024", "1792x1024", "1024x1792"],
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "read_file",
    description:
      "Đọc nội dung file trong workspace. Dùng khi cần xem code hiện tại, đọc config, hoặc review file.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Đường dẫn file tương đối trong workspace, ví dụ: 'src/index.ts', 'README.md'",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Ghi nội dung vào file trong workspace. Tự động chọn định dạng theo đuôi file: " +
      ".docx (Word) — content là text/markdown với heading #/##/###; " +
      ".xlsx (Excel) — content là CSV hoặc JSON array; " +
      ".pdf (PDF) — content là text/markdown với heading #/##/###; " +
      "các đuôi khác (.ts, .py, .json, .txt, .md, v.v.) — ghi text thuần. " +
      "Dùng khi tạo document, project, code, config, README, v.v.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Đường dẫn file tương đối trong workspace, ví dụ: 'report.docx', 'data.xlsx', 'src/index.ts'",
        },
        content: {
          type: "string",
          description: "Nội dung file. Với .docx/.pdf dùng markdown (#, ##, ###). Với .xlsx dùng CSV hoặc JSON array.",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_dir",
    description:
      "Liệt kê nội dung thư mục trong workspace. Dùng để xem cấu trúc project.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Đường dẫn thư mục tương đối, mặc định là '.' (root workspace)",
        },
      },
      required: [],
    },
  },
  {
    name: "export_chat",
    description:
      "Export the current chat history as a Markdown file and send it to the user. Use when the user asks to export, save, or download the conversation.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "reset_session",
    description:
      "Clear the chat history and start a fresh conversation. Use when the user asks to reset, clear history, or start over.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HandlerDeps {
  sessionManager: SessionManager;
  aiClient: AIClient;
  channelRegistry: ChannelRegistry;
  config: Config;
  cronManager?: CronManager;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleInbound(
  msg: InboundMessage,
  deps: HandlerDeps,
  opts: { noHistory?: boolean } = {}
): Promise<void> {
  const { sessionManager, aiClient, channelRegistry, config, cronManager } = deps;
  const channel = channelRegistry.get(msg.channel);
  const memoriesDir = path.join(path.dirname(config.dbPath), "memories");

  // Extract image data if present
  const raw = msg.raw as Record<string, unknown> | null;
  const imageBase64 = typeof raw?.imageBase64 === "string" ? raw.imageBase64 : undefined;
  const imageMimeType = typeof raw?.mimeType === "string" ? raw.mimeType : undefined;

  // Session
  const sessionKey = sessionManager.getOrCreate(msg.channel, msg.userId, msg.chatId);
  const history = opts.noHistory ? [] : sessionManager.getHistory(sessionKey);

  if (!opts.noHistory) {
    sessionManager.appendUserTurn(sessionKey, msg.text);
  }

  // Register abort controller
  const controller = registerStream(msg.chatId);

  // Helper: gửi progress update liên tục — user biết clawbot đang làm gì
  const sendProgress = async (text: string) => {
    try {
      await channel.send({ channel: msg.channel, chatId: msg.chatId, text, isFinal: true });
    } catch { /* ignore */ }
  };

  // Tool executor
  const toolHandler: ToolHandler = {
    tools: TOOLS,
    execute: async (name, input): Promise<string> => {
      const i = input as Record<string, string>;

      switch (name) {
        case "create_reminder": {
          if (!cronManager) return "Reminder feature is not available.";
          const job = cronManager.add(msg.chatId, msg.userId, i.cron_expression, i.message);
          if (job) {
            return `Reminder created. ID: ${job.id.slice(-6)}. Schedule: "${i.cron_expression}". Message: "${i.message}"`;
          }
          return `Failed to create reminder. Invalid cron expression: "${i.cron_expression}"`;
        }

        case "get_weather":
          return await getWeather(i.location ?? "Ho Chi Minh City");

        case "get_datetime":
          return getDatetime(i.timezone ?? undefined);

        case "calculate": {
          const expr = i.expression.replace(/(\d+)%\s+of\s+(\d+)/i, "($1/100)*$2");
          return calculate(expr);
        }

        case "run_bash": {
          const command = i.command ?? "";
          const needsApproval = shouldRequireApproval(command, config.bashApprovalMode);
          if (!needsApproval) await sendProgress(`Đang chạy: \`${command.slice(0, 80)}\``);

          if (needsApproval) {
            if (!channel.sendApprovalMessage) {
              // Channel không hỗ trợ approval — từ chối để an toàn
              return `Execution blocked: command requires approval but channel does not support it.\nCommand: ${command}`;
            }

            const { approvalId, promise } = createApproval(msg.chatId, msg.userId);
            await channel.sendApprovalMessage(msg.chatId, approvalId, command);

            const result = await promise;
            if (result === "approved") {
              return await runBash(command, config.bashTimeoutMs);
            } else if (result === "rejected") {
              return `Execution rejected by user: ${command}`;
            } else {
              return `Execution timed out waiting for approval: ${command}`;
            }
          }

          return await runBash(command, config.bashTimeoutMs);
        }

        case "fetch_url":
          await sendProgress(`Đang đọc: ${(i.url ?? "").slice(0, 60)}...`);
          return await fetchUrl(i.url ?? "");

        case "web_search":
          await sendProgress(`Đang tìm kiếm: "${i.query ?? ""}"`);
          return await webSearch(i.query ?? "");

        case "memory_search":
          await sendProgress(`Đang tìm trong memory: "${i.query ?? ""}"`);
          return searchMemory(i.query ?? "", memoriesDir);

        case "generate_image": {
          const prompt = i.prompt ?? "";
          const size = (i.size as "1024x1024" | "1792x1024" | "1024x1792") ?? "1024x1024";
          await sendProgress(`Đang tạo ảnh: "${prompt.slice(0, 60)}"...`);
          try {
            const result = await generateImage(prompt, config.imageApiKey, size);
            await channel.sendPhoto?.(msg.chatId, result.buffer, undefined);
            return "Đã tạo và gửi ảnh thành công.";
          } catch (err) {
            return `Lỗi tạo ảnh: ${err instanceof Error ? err.message : String(err)}`;
          }
        }

        case "read_file":
          await sendProgress(`Đang đọc file: ${i.path ?? ""}`);
          return readFile(config.workspaceDir, i.path ?? "");

        case "write_file": {
          const filePath = i.path ?? "";
          await sendProgress(`Đang tạo file: ${filePath}`);
          const result = await writeFile(config.workspaceDir, filePath, i.content ?? "");
          // Nếu ghi thành công, gửi file thật cho user
          if (result.startsWith("✅") && channel.sendFileBuffer) {
            try {
              const resolvedPath = path.resolve(config.workspaceDir, filePath);
              const fileBuffer = (await import("node:fs")).readFileSync(resolvedPath);
              const filename = path.basename(filePath);
              await channel.sendFileBuffer(msg.chatId, fileBuffer, filename);
            } catch {
              // Không thể đọc file để gửi — vẫn trả về text bình thường
            }
          }
          return result;
        }

        case "list_dir":
          await sendProgress(`Đang xem thư mục: ${i.path ?? "."}`);
          return listDir(config.workspaceDir, i.path ?? ".");

        case "export_chat": {
          const turns = sessionManager.getHistory(sessionKey);
          if (turns.length === 0) return "No chat history to export.";
          const content = buildExportMarkdown(sessionKey, turns);
          const filename = `chat-export-${Date.now()}.md`;
          await channel.sendDocument?.(msg.chatId, content, filename, "📄 Chat history");
          return `Chat history exported (${turns.length} turns).`;
        }

        case "reset_session":
          sessionManager.reset(sessionKey);
          return "Chat history cleared.";

        default:
          return `Unknown tool: ${name}`;
      }
    },
  };

  // ─── Load soul/user/memory files ────────────────────────────────────────────
  const dataDir = path.dirname(config.dbPath);

  function safeRead(filePath: string): string {
    try { return fs.readFileSync(filePath, "utf8"); } catch { return ""; }
  }

  // Chỉ load 2000 ký tự đầu mỗi file để tránh system prompt quá nặng
  const safeReadTrimmed = (filePath: string, maxChars = 2000): string => {
    const content = safeRead(filePath);
    return content.length > maxChars ? content.slice(0, maxChars) + "\n...(truncated)" : content;
  };

  const soulContent = safeReadTrimmed(path.join(dataDir, "soul.md"), 800);
  const userContent = safeReadTrimmed(path.join(dataDir, "user.md"), 800);
  const memoryContent = safeReadTrimmed(path.join(dataDir, "memory.md"), 1200);

  // ─── Build dynamic system prompt với context thời gian thực ────────────────
  const now = new Date();
  const vnTime = now.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const hour = parseInt(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "numeric", hour12: false }));
  const greeting =
    hour >= 5 && hour < 11 ? "buổi sáng" :
    hour >= 11 && hour < 14 ? "buổi trưa" :
    hour >= 14 && hour < 18 ? "buổi chiều" :
    hour >= 18 && hour < 22 ? "buổi tối" : "đêm khuya";

  const dynamicContext = `\n\n---\n[CONTEXT THỜI GIAN THỰC]\nGiờ hiện tại: ${vnTime} (${greeting})\nKhi chào hỏi, dùng đúng thời điểm "${greeting}" — KHÔNG dùng lời chào sai giờ (ví dụ không nói "ngủ ngon" hay "chào buổi sáng" sai thời điểm).`;

  const soulBlock = soulContent ? `\n\n---\n${soulContent}` : "";
  const userBlock = userContent ? `\n\n---\n${userContent}` : "";
  const memoryBlock = memoryContent ? `\n\n---\n[MEMORY - ĐỌC TRƯỚC KHI TRẢ LỜI]\n${memoryContent}` : "";

  // ─── Model routing — tự chọn model theo độ phức tạp ─────────────────────
  const complexity = classifyComplexity(msg.text, history);
  const selectedModel = selectModel(complexity, config.model);
  console.log(`[router] complexity=${complexity} model=${selectedModel} msg="${msg.text.slice(0, 40)}..."`);

  // Với câu phức tạp, inject thêm instruction để Claude suy nghĩ có cấu trúc
  // Với câu phức tạp: nhắc Claude áp dụng structured reasoning
  const thinkingInstruction = complexity === "complex"
    ? "\n\n[COMPLEX QUERY] Ap dung structured reasoning: 1) Phan tich yeu cau thuc su 2) Chon approach tot nhat 3) Thuc hien co cau truc 4) Kiem tra lai truoc khi output."
    : "";

  const dynamicSystemPrompt = config.systemPrompt + soulBlock + userBlock + memoryBlock + dynamicContext + thinkingInstruction;

  // Begin streaming — tự động retry khi server overloaded (429/529)
  let overloadAttempt = 0;
  const MAX_OVERLOAD_RETRIES = 3;
  let fullText = "";

  try {
    while (true) {
      const streamHandle = channel.beginStream?.(msg.chatId);
      fullText = "";

      try {
        for await (const event of aiClient.stream({
          history,
          userMessage: msg.text,
          imageBase64,
          imageMimeType,
          model: selectedModel,
          maxTokens: config.maxTokens,
          systemPrompt: dynamicSystemPrompt,
          signal: controller.signal,
          toolHandler,
        })) {
          if (controller.signal.aborted) break;

          if (event.type === "delta") {
            fullText = event.fullText ?? fullText;
            streamHandle?.update(fullText);
          } else if (event.type === "done") {
            fullText = event.fullText ?? fullText;
          } else if (event.type === "error") {
            throw event.error;
          }
        }

        if (controller.signal.aborted) {
          await streamHandle?.abort();
          return;
        }

        await streamHandle?.finalize();
        break; // thành công — thoát retry loop

      } catch (err) {
        const isAbort =
          err instanceof Error &&
          (err.name === "AbortError" || err.message.includes("abort"));

        if (isAbort) {
          await streamHandle?.abort();
          return;
        }

        console.error("[pipeline] AI error:", err);
        await streamHandle?.abort();

        const isOverloaded =
          err instanceof Error && (
            err.message.includes("overloaded_error") ||
            err.message.toLowerCase().includes("overloaded") ||
            (err as any).status === 529
          );

        if (isOverloaded && overloadAttempt < MAX_OVERLOAD_RETRIES) {
          overloadAttempt++;
          const delayMs = overloadAttempt * 5000; // 5s → 10s → 15s
          console.warn(`[pipeline] Overloaded, retry ${overloadAttempt}/${MAX_OVERLOAD_RETRIES} in ${delayMs / 1000}s`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        await channel.send({
          channel: msg.channel,
          chatId: msg.chatId,
          text: isOverloaded
            ? "Server Anthropic đang quá tải, vui lòng thử lại sau ít phút."
            : "Có lỗi xảy ra, vui lòng thử lại.",
          isFinal: true,
        });
        return;
      }
    }
  } finally {
    deregisterStream(msg.chatId);
  }

  if (fullText && !opts.noHistory) {
    sessionManager.appendAssistantTurn(sessionKey, fullText);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shouldRequireApproval(command: string, mode: Config["bashApprovalMode"]): boolean {
  if (mode === "never") return false;
  if (mode === "always") return true;
  // "smart": chỉ hỏi khi lệnh có pattern nguy hiểm
  return isDangerous(command);
}

function buildExportMarkdown(key: string, turns: { role: string; content: unknown }[]): string {
  const lines = [
    `# Chat Export`,
    `**Session:** ${key}`,
    `**Exported:** ${new Date().toISOString()}`,
    `**Turns:** ${turns.length}`,
    ``,
    `---`,
    ``,
  ];
  for (const t of turns) {
    const role = t.role === "user" ? "👤 User" : "🤖 Claude";
    const content = typeof t.content === "string" ? t.content : JSON.stringify(t.content);
    lines.push(`### ${role}\n\n${content}\n`);
  }
  return lines.join("\n");
}
