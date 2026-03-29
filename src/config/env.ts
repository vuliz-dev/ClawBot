import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),

  // ── AI Provider ────────────────────────────────────────────────────────────
  // "anthropic" (default) | "openai" | "ollama"
  AI_PROVIDER: z.enum(["anthropic", "openai", "ollama"]).default("anthropic"),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().default("auto"),

  // OpenAI / Ollama
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default(""),  // e.g. http://localhost:11434/v1 for Ollama

  // Image generation (Hugging Face) — token miễn phí tại huggingface.co/settings/tokens
  // Nếu không set, generate_image tool sẽ báo không khả dụng
  IMAGE_API_KEY: z.string().default(""),

  // Workspace dir cho file I/O tools (read_file, write_file, list_dir)
  WORKSPACE_DIR: z.string().default("./workspace"),

  // ── Model ─────────────────────────────────────────────────────────────────
  CLAUDE_MODEL: z.string().default("claude-sonnet-4-6"),
  CLAUDE_MAX_TOKENS: z.coerce.number().default(4096),

  // ── System ────────────────────────────────────────────────────────────────
  SYSTEM_PROMPT: z.string().default(""),  // nếu trống, dùng DEFAULT_SYSTEM_PROMPT bên dưới
  DB_PATH: z.string().default("./data/clawbot.db"),
  GATEWAY_PORT: z.coerce.number().default(3000),
  STREAM_THROTTLE_MS: z.coerce.number().default(800),

  // ── History / Context ─────────────────────────────────────────────────────
  MAX_HISTORY_TURNS: z.coerce.number().default(20),
  // Token budget cho context (rough estimate: 4 chars = 1 token)
  // Mặc định 80k tokens (tương đương ~320k ký tự)
  MAX_CONTEXT_TOKENS: z.coerce.number().default(80000),

  // ── Access control ────────────────────────────────────────────────────────
  ALLOWED_USER_IDS: z.string().default(""),
  BASH_TIMEOUT_MS: z.coerce.number().default(30000),

  // ── Exec approval ─────────────────────────────────────────────────────────
  // "always" = luôn hỏi | "never" = không hỏi (trust AI) | "smart" = chỉ hỏi lệnh nguy hiểm
  BASH_APPROVAL_MODE: z.enum(["always", "never", "smart"]).default("smart"),

  // ── Gateway WebSocket ──────────────────────────────────────────────────────
  // Nếu set, /ws endpoint yêu cầu ?token=<WS_SECRET> để kết nối
  WS_SECRET: z.string().default(""),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const err of parsed.error.errors) {
    console.error(`  ${err.path.join(".")}: ${err.message}`);
  }
  process.exit(1);
}

// ─── Default system prompt ────────────────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `Mày là Clawbot — trợ lý AI cá nhân của NT777 chạy trên Telegram.

## Cách tư duy (Structured Reasoning)

Trước khi trả lời BẤT KỲ câu hỏi nào, hãy làm nhanh trong đầu:
1. Yêu cầu thực sự là gì? (đôi khi khác với những gì được nói)
2. Cách tiếp cận tốt nhất là gì?
3. Có rủi ro/lưu ý nào cần báo không?

Với câu đơn giản (hi, ok, cảm ơn) — bỏ qua bước này, trả lời thẳng.
Với câu phức tạp (code, phân tích, tạo nội dung) — luôn làm đủ 3 bước trước khi output.

## Tính cách

Thẳng thắn, không rườm rà. Bỏ hết "Xin chào! Tôi rất vui..." — đi thẳng vào việc.
Có chính kiến. Không đồng ý thì nói, không trung lập giả tạo.
Chủ động. Thấy vấn đề tiềm ẩn thì nêu ra dù không được hỏi.
Làm luôn. Không nói "để mình làm" rồi không làm. Làm ngay hoặc giải thích tại sao không được.

## Giao tiếp

Ngôn ngữ: theo user — Tiếng Việt thì trả lời Tiếng Việt.
Formatting: KHÔNG dùng bold/italic trong chat thường. Không dùng ký tự * hay **. Plain text tự nhiên.
Emoji: tối đa 1/tin, chỉ khi tự nhiên. Không spam.
Độ dài: "hi" → 1-2 câu. Câu phức tạp → đủ ý, không thừa.
Xưng: mình. Gọi user: NT777.

## Tools

Dùng tools tự động khi được yêu cầu rõ ràng. Tìm kiếm khi cần thông tin mới. Tạo file thực khi được yêu cầu.
Sau khi dùng tool: trình bày kết quả tự nhiên, không paste raw.

create_reminder WORKFLOW (bắt buộc theo đúng thứ tự):
  Bước 1: User có dùng từ rõ ràng như "nhắc tôi", "thông báo lúc", "đặt lịch" không? Nếu không → DỪNG, đừng tạo reminder.
  Bước 2: User đã nói rõ 1 lần hay lặp lại chưa? Nếu chưa → HỎI: "NT777 muốn nhắc 1 lần hay lặp lại hằng ngày?"
  Bước 3: Chỉ gọi create_reminder SAU KHI đã có đủ thông tin: thời gian + nội dung + 1 lần hay lặp lại.
  Mặc định: 1 lần (one-shot) trừ khi user nói rõ "mỗi ngày", "hằng ngày", "hàng tuần".

## Môi trường

Windows, PowerShell. Workspace: ./workspace/. Không bịa thông tin.`;

export const config = {
  telegramBotToken: parsed.data.TELEGRAM_BOT_TOKEN,

  // AI provider
  aiProvider: parsed.data.AI_PROVIDER,
  anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
  openaiApiKey: parsed.data.OPENAI_API_KEY,
  openaiBaseUrl: parsed.data.OPENAI_BASE_URL || undefined,

  // Model
  model: parsed.data.CLAUDE_MODEL,
  maxTokens: parsed.data.CLAUDE_MAX_TOKENS,

  // System
  systemPrompt: parsed.data.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
  dbPath: parsed.data.DB_PATH,
  gatewayPort: parsed.data.GATEWAY_PORT,
  streamThrottleMs: parsed.data.STREAM_THROTTLE_MS,

  // History / Context
  maxHistoryTurns: parsed.data.MAX_HISTORY_TURNS,
  maxContextTokens: parsed.data.MAX_CONTEXT_TOKENS,

  // Access
  allowedUserIds: parsed.data.ALLOWED_USER_IDS
    ? parsed.data.ALLOWED_USER_IDS.split(",").map((s) => s.trim()).filter(Boolean)
    : [],
  bashTimeoutMs: parsed.data.BASH_TIMEOUT_MS,
  bashApprovalMode: parsed.data.BASH_APPROVAL_MODE,

  // Image generation
  imageApiKey: parsed.data.IMAGE_API_KEY || parsed.data.OPENAI_API_KEY || "",

  // File I/O workspace
  workspaceDir: parsed.data.WORKSPACE_DIR,

  // Gateway
  wsSecret: parsed.data.WS_SECRET || undefined,
} as const;

export type Config = typeof config;
