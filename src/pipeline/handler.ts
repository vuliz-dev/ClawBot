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
import { webSearch, executeGlob, executeGrep } from "../plugins/search.js";
import { searchMemory } from "../memory/search.js";
import { hookRegistry, initHooks } from "../hooks/index.js";
import { readFile, writeFile, listDir } from "../plugins/fileio.js";
import path from "node:path";
import fs from "node:fs";
import { classifyComplexity, selectModel } from "../ai/router.js";
import type { BrowserManager } from "../plugins/browser.js";

initHooks();

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
  // Windows PowerShell Core Threats
  /Remove-Item(\s+-Recurse|\s+-Force|\s+-Confirm|\s+-\w+)*\s+([A-Za-z]:[\\/]|\\)/i,
  /Invoke-WebRequest|iwr\s+/i,
  /Invoke-RestMethod|irm\s+/i,
  /Set-ExecutionPolicy/i,
  /Stop-Process|taskkill/i,
  /net\s+user/i,
  /Start-Process.*-Verb\s+RunAs/i,
  /Set-ItemProperty.*HKLM/i,
  /New-ItemProperty/i,
  /Remove-ItemProperty/i,
  /Clear-ItemProperty/i,
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
    name: "list_reminders",
    description: "List all active reminders and scheduled jobs for the current user/chat. Use when the user asks what tasks or reminders are currently scheduled.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "delete_reminder",
    description: "Delete a specific reminder by its ID. Use when the user asks to cancel or remove a scheduled reminder.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the reminder to delete (usually the last 6 characters or full ID).",
        },
      },
      required: ["id"],
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
      "Execute a shell command. By default, this runs securely in a Docker sandbox (node:22-alpine). " +
      "If the sandbox is not available, it FALLS BACK to executing NATIVELY on the HOST OS. " +
      "Since the host is Windows, you MUST use PowerShell commands if the execution is native.",
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
    name: "glob_search",
    description:
      "Liệt kê tất cả các file khớp với mẫu (wildcard pattern) trong thư mục gốc. " +
      "Dùng khi bạn muốn lấy danh sách tất cả các file có đuôi nhất định, ví dụ: 'src/**/*.ts' để lấy hết code TS.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Mẫu tìm kiếm (Glob pattern), ví dụ: 'src/**/*.ts', '*.md'",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "grep_search",
    description:
      "Sử dụng công cụ RipGrep Native để tìm kiếm text chính xác hoặc RegEx trong hàng loạt các file với tốc độ siêu nhanh. " +
      "Sử dụng công cụ này thay vì dùng run_bash với grep nếu bạn muốn rà soát code trên hệ thống.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Từ khóa hoặc đoạn text cần tìm (Regex cũng được).",
        },
        dir: {
          type: "string",
          description: "Thư mục để khoanh vùng quét (Tương đối so với workspace), ví dụ: 'src'. Mặc định quét tất cả '.'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "replace_in_file",
    description:
      "Sửa điểm (Surgical edit) nội dung trên một file bằng cách tìm `target_content` và thay bằng `replacement_content`.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        target_content: { type: "string" },
        replacement_content: { type: "string" },
      },
      required: ["path", "target_content", "replacement_content"],
    },
  },
  {
    name: "append_to_file",
    description:
      "Nối thêm nội dung vào cuối tệp tin văn bản (text/markdown/code). Dùng riêng cho Chunking Workflow để viết các văn bản khổng lồ.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Đường dẫn file (VD: nhap.md)" },
        content: { type: "string", description: "Nội dung cần nối thêm" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "compile_file",
    description:
      "Biên dịch file nguồn (như .md, .csv) thành file đích như .docx, .pdf, .xlsx. " +
      "Dùng riêng trong Chunking Workflow để tổng hợp file cuối cùng giao cho user mà không vi phạm Token Limit.",
    input_schema: {
      type: "object",
      properties: {
        source_path: { type: "string", description: "File nguồn, VD: bai_luan.md" },
        target_path: { type: "string", description: "File đích, VD: bai_luan.docx" },
      },
      required: ["source_path", "target_path"],
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
  {
    name: "browser_action",
    description: "Điều khiển trình duyệt ảo (Headless). Hỗ trợ điều hướng, click, gõ text, trích xuất text, chụp ảnh và chạy JS. LƯU Ý: Khi gọi screenshot hoặc element_screenshot, ẢNH ĐƯỢC CHỤP SẼ TỰ ĐỘNG GỬI TRỰC TIẾP QUA TELEGRAM CHO USER.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["goto", "click", "type", "scroll", "extract_text", "screenshot", "element_screenshot", "evaluate"],
          description: "Hành động cần thực thi."
        },
        target: {
          type: "string",
          description: "URL (dành cho goto), CSS Selector (dành cho click/type), hoặc JS Code (dành cho evaluate)."
        },
        value: {
          type: "string",
          description: "Text cần gõ (dành cho type) hoặc 'up'/'down' (dành cho scroll)."
        }
      },
      required: ["action"]
    }
  }
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HandlerDeps {
  sessionManager: SessionManager;
  aiClient: AIClient;
  channelRegistry: ChannelRegistry;
  config: Config;
  cronManager?: CronManager;
  browserManager: BrowserManager;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleInbound(
  msg: InboundMessage,
  deps: HandlerDeps,
  opts: { noHistory?: boolean } = {}
): Promise<void> {
  const { sessionManager, aiClient, channelRegistry, config, cronManager, browserManager } = deps;
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

  // Helper: Hiển thị tiến trình UI rõ ràng giúp người dùng hết cảm giác bị mù (Blind UX)
  let progressMsgId: string | undefined;
  const sendProgress = async (text?: string) => {
    try {
      if (!progressMsgId) {
        progressMsgId = await channel.send({ 
          channel: msg.channel, 
          chatId: msg.chatId, 
          text: `⏳ Đang xử lý...`, 
          isFinal: false 
        });
      } else if (text && channel.send) {
        // Cập nhật trạng thái Tool thật sự để User có thể đọc thay vì "Không update text nữa"
        await channel.send({ 
          channel: msg.channel, 
          chatId: msg.chatId, 
          text: `⏳ ${text}`, 
          isFinal: false, 
          editMessageId: progressMsgId 
        });
      }
    } catch { /* ignore */ }
  };

  // Tool executor
  const toolHandler: ToolHandler = {
    tools: TOOLS,
    execute: async (name, input): Promise<string> => {
      const i = input as Record<string, string>;

      const hookCtx = {
        chatId: msg.chatId,
        userId: msg.userId,
        channel: msg.channel,
        deps,
        historySize: history.length,
      };
      
      const hookRes = await hookRegistry.runPreToolUse(hookCtx, name, i);
      if (!hookRes.allowed) {
        return hookRes.reason ?? "Execution blocked by hook.";
      }

      switch (name) {
        case "create_reminder": {
          if (!cronManager) return "Reminder feature is not available.";
          await sendProgress(`Đang tạo lịch nhắc...`);
          const job = cronManager.add(msg.chatId, msg.userId, i.cron_expression, i.message);
          if (job) {
            return `Reminder created. ID: ${job.id.slice(-6)}. Schedule: "${i.cron_expression}". Message: "${i.message}"`;
          }
          return `Failed to create reminder. Invalid cron expression: "${i.cron_expression}"`;
        }

        case "list_reminders": {
          if (!cronManager) return "Reminder feature is not available.";
          await sendProgress(`Đang lấy danh sách công việc...`);
          const jobs = cronManager.list(msg.chatId);
          if (jobs.length === 0) return "No active reminders found for this chat.";
          return "Active reminders:\n" + jobs.map((j) => `- ID: ${j.id.slice(-6)} | Cron: ${j.expression} | Msg: ${j.prompt}`).join("\n");
        }

        case "delete_reminder": {
          if (!cronManager) return "Reminder feature is not available.";
          const id = i.id ?? "";
          if (!id) return "Error: Missing reminder ID.";
          await sendProgress(`Đang xóa công việc ID ${id}...`);
          
          const jobs = cronManager.list(msg.chatId);
          const target = jobs.find((j) => j.id === id || j.id.endsWith(id));
          if (!target) return `Error: Reminder ID "${id}" not found.`;
          
          const success = cronManager.delete(msg.chatId, target.id);
          return success ? `Reminder ${target.id.slice(-6)} deleted successfully.` : `Failed to delete reminder ${id}.`;
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
          await sendProgress(`Đang chạy: \`${command.slice(0, 80)}\``);
          return await runBash(command, config.bashTimeoutMs, config.workspaceDir);
        }

        case "fetch_url":
          await sendProgress(`Đang đọc: ${(i.url ?? "").slice(0, 60)}...`);
          return await fetchUrl(i.url ?? "");

        case "web_search":
          await sendProgress(`Đang tìm kiếm: "${i.query ?? ""}"`);
          return await webSearch(i.query ?? "");

        case "glob_search": {
          const { executeGlob } = await import("../plugins/search.js");
          return await executeGlob(config.workspaceDir, i.pattern as string);
        }

        case "grep_search": {
          const { executeGrep } = await import("../plugins/search.js");
          return await executeGrep(config.workspaceDir, i.query as string, i.dir || ".");
        }

        case "memory_search":
          await sendProgress(`Đang tìm trong memory: "${i.query ?? ""}"`);
          return await searchMemory(i.query ?? "", memoriesDir);

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

        case "replace_in_file": {
          const filePath = i.path ?? "";
          const target = i.target_content ?? "";
          const replacement = i.replacement_content ?? "";
          await sendProgress(`Đang sửa đổi file: ${filePath}`);
          const { replaceInFile } = await import("../plugins/fileio.js");
          return replaceInFile(config.workspaceDir, filePath, target, replacement);
        }

        case "append_to_file": {
          const filePath = i.path ?? "";
          const content = i.content ?? "";
          await sendProgress(`Đang viết tiếp vào file: ${filePath}`);
          const { appendToFile } = await import("../plugins/fileio.js");
          return appendToFile(config.workspaceDir, filePath, content);
        }

        case "compile_file": {
          const sourcePath = i.source_path ?? "";
          const targetPath = i.target_path ?? "";
          await sendProgress(`Đang biên dịch ${sourcePath} -> ${targetPath}...`);
          const { compileFile } = await import("../plugins/fileio.js");
          const result = await compileFile(config.workspaceDir, sourcePath, targetPath);
          
          if (result.startsWith("✅") && channel.sendFileBuffer) {
            try {
              const fs = await import("node:fs");
              const resolvedTarget = path.resolve(config.workspaceDir, targetPath);
              const fileBuffer = fs.readFileSync(resolvedTarget);
              const filename = path.basename(targetPath);
              await channel.sendFileBuffer(msg.chatId, fileBuffer, filename);
            } catch {
              // Ignore sending errors
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

        case "browser_action": {
          const action = i.action ?? "";
          const target = i.target ?? undefined;
          const value = i.value ?? undefined;
          
          await sendProgress(`Đang điều khiển trình duyệt: ${action} ${target || ''}`.trim());
          const result = await browserManager.executeAction(action, target, value);
          
          if (Buffer.isBuffer(result)) {
            // Nếu là ảnh chụp màn hình
            await channel.sendPhoto?.(msg.chatId, result, undefined);
            return "Đã chụp ảnh màn hình và gửi thành công.";
          }
          return result;
        }

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

  const soulBlock = soulContent ? `\n\n---\n${soulContent}` : "";
  const userBlock = userContent ? `\n\n---\n${userContent}` : "";
  const memoryBlock = memoryContent ? `\n\n---\n[MEMORY - ĐỌC TRƯỚC KHI TRẢ LỜI]\n${memoryContent}` : "";

  // Thay thế hardcoded dynamicContext bằng luồng SessionStart Hooks
  const hookCtx = {
    chatId: msg.chatId,
    userId: msg.userId,
    channel: msg.channel,
    deps,
    historySize: history.length,
  };
  const dynamicContextText = await hookRegistry.runSessionStart(hookCtx);
  const dynamicContext = dynamicContextText ? `\n\n${dynamicContextText}` : "";

  // ─── Model routing — tự chọn model theo độ phức tạp ─────────────────────
  const complexity = classifyComplexity(msg.text, history);
  const selectedModel = selectModel(complexity, config.model);
  console.log(`[router] complexity=${complexity} model=${selectedModel} msg="${msg.text.slice(0, 40)}..."`);

  const dynamicSystemPrompt = config.systemPrompt + soulBlock + userBlock + memoryBlock + dynamicContext;

  // Begin streaming — tự động retry khi server overloaded (529)
  let overloadAttempt = 0;
  const MAX_OVERLOAD_RETRIES = 3;
  let fullText = "";
  let finalAssistantMessages: any[] | undefined = undefined;

  try {
    while (true) {
      const streamHandle = channel.beginStream?.(msg.chatId);
      fullText = "";

      // Áp dụng Controller mới cho từng lượt Retry (Tối đa 60s/lượt để tránh lỗi Treo Chết)
      const loopController = new AbortController();
      const enforceTimeout = setTimeout(() => { loopController.abort("Quá thời gian phản hồi (Hard Timeout API)"); }, 60000);

      try {
        for await (const event of aiClient.stream({
          history,
          userMessage: msg.text,
          imageBase64,
          imageMimeType,
          model: selectedModel,
          maxTokens: config.maxTokens,
          thinkingBudgetTokens: complexity === "complex" ? config.thinkingBudgetTokens : undefined,
          systemPrompt: dynamicSystemPrompt,
          signal: loopController.signal,
          toolHandler,
        })) {
          if (loopController.signal.aborted) break;

          if (event.type === "delta") {
            fullText = event.fullText ?? fullText;
            streamHandle?.update(fullText);
          } else if (event.type === "done") {
            fullText = event.fullText ?? fullText;
            finalAssistantMessages = event.assistantMessages;
          } else if (event.type === "error") {
            throw event.error;
          }
        }

        if (controller.signal.aborted) {
          await streamHandle?.abort();
          return;
        }

        await streamHandle?.finalize();
        break; // thành công

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
          const delayMs = overloadAttempt * 5000;
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
      } finally {
        clearTimeout(enforceTimeout);
      }
    }
  } finally {
    deregisterStream(msg.chatId);
    if (progressMsgId && channel.id === "telegram") {
      try { await (channel as any).bot.api.deleteMessage(msg.chatId, Number(progressMsgId)); } catch {}
    }
  }

  if (!opts.noHistory) {
    if (finalAssistantMessages && finalAssistantMessages.length > 0) {
      for (const message of finalAssistantMessages) {
        if (message.role === "assistant") {
          sessionManager.appendAssistantTurn(sessionKey, message.content);
        } else if (message.role === "user") {
          sessionManager.appendUserTurn(sessionKey, message.content);
        }
      }
    } else if (fullText) {
      sessionManager.appendAssistantTurn(sessionKey, fullText);
    }
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
