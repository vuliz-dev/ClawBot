import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),

  // ── AI Provider ────────────────────────────────────────────────────────────
  // "anthropic" (default) | "openai" | "ollama" | "google"
  AI_PROVIDER: z.enum(["anthropic", "openai", "ollama", "google"]).default("anthropic"),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().default("auto"),

  // OpenAI / Ollama
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default(""),  // e.g. http://localhost:11434/v1 for Ollama

  // Google Generative AI
  GOOGLE_API_KEY: z.string().default(""),

  // Image generation (Hugging Face) — token miễn phí tại huggingface.co/settings/tokens
  // Nếu không set, generate_image tool sẽ báo không khả dụng
  IMAGE_API_KEY: z.string().default(""),

  // Workspace dir cho file I/O tools (read_file, write_file, list_dir)
  WORKSPACE_DIR: z.string().default("./workspace"),

  // ── Model ─────────────────────────────────────────────────────────────────
  CLAUDE_MODEL: z.string().default("claude-sonnet-4-6"),
  CLAUDE_MAX_TOKENS: z.coerce.number().default(8192),
  THINKING_BUDGET_TOKENS: z.coerce.number().default(4096),

  // ── System ────────────────────────────────────────────────────────────────
  SYSTEM_PROMPT: z.string().default(""),  // nếu trống, dùng DEFAULT_SYSTEM_PROMPT bên dưới
  DB_PATH: z.string().default("./data/clawbot.db"),
  GATEWAY_PORT: z.coerce.number().default(3000),
  STREAM_THROTTLE_MS: z.coerce.number().default(800),

  // ── History / Context ─────────────────────────────────────────────────────
  // Nâng max_turns lên 100 vòng (200 messages) để tránh bot quên task (âm mưu/kịch bản) khi tự thầu nguyên project
  MAX_HISTORY_TURNS: z.coerce.number().default(100),
  // Token budget cho context: Model Gemma 4 (trên Google Studio) hỗ trợ ~1M tokens. Nâng budget lên cực đại!
  // Mặc định 250k tokens (tương đương 1 triệu ký tự)
  MAX_CONTEXT_TOKENS: z.coerce.number().default(250000),

  // ── Access control ────────────────────────────────────────────────────────
  ALLOWED_USER_IDS: z.string().default(""),
  // Dùng cho Pairing Mode. Nếu để trống, ai không nằm trong ALLOWED_USER_IDS sẽ bị block cứng.
  PAIRING_CODE: z.string().default(""),
  BASH_TIMEOUT_MS: z.coerce.number().default(30000),

  // ── Exec approval ─────────────────────────────────────────────────────────
  // "always" = luôn hỏi | "never" = không hỏi (trust AI) | "smart" = chỉ hỏi lệnh nguy hiểm
  BASH_APPROVAL_MODE: z.enum(["always", "never", "smart"]).default("smart"),
  ALLOW_HOST_BASH: z.enum(["true", "false"]).default("false"),

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

## Tương tác
Thẳng thắn, không rườm rà. Bỏ hết "Xin chào! Tôi rất vui..." — đi thẳng vào việc. Có chính kiến.
**Lệnh bài miễn tử (Absolute rule)**: TỐI KỴ việc nói "Để mình làm ngay" hoặc "Tôi đã nháp xong phần 1, bạn xem nhé" rồi dừng lại chờ user phản hồi.
**TUYỆT ĐỐI KHÔNG DỪNG GIỮA CHỪNG.** Lời hứa phải đi kèm với Tool Use NGAY LẬP TỨC. Khi có nhiều bước (ví dụ tạo 5 file), hãy móc nối tools liên tiếp xuyên suốt các vòng lặp ngầm. Bạn KHÔNG THỂ "làm ngầm" mà không dùng tools. Nếu bạn gõ text mà không dùng Tool, hệ thống sẽ tự động gãy vòng lặp hoặc khóa mõm bạn. CHỈ KHI NÀO MỌI THỨ HOÀN TẤT 100% mới được feedback lại cho User!

## Lên Kế Hoạch (Planning & Checklist)
Nếu user giao task lớn (cần tạo/sửa >2 file hoặc research lớn), hãy dùng tool 'manage_tasks' với action='create' để vẽ ra Checklist trước khi làm bất cứ thứ gì.
Ví dụ:
1. Tạo thư mục/setup
2. Viết file A
3. Viết file B
Sau mỗi bước, bạn tiếp tục dùng 'manage_tasks' (action='update', status='done') để tick xanh ô đó, rồi vòng lặp sẽ trôi tiếp qua task kế tiếp cho đến khi hoàn thiện.

## QUY TRÌNH XỬ LÝ SIÊU TÀI LIỆU
Hệ thống KHÔNG cho phép khởi tạo nội dung > 4.000 từ trong một tệp tin duy nhất vì sẽ làm sập API.
Nếu User yêu cầu nội dung CỰC LỚN (ví dụ: bài luận 10 trang, sách, báo cáo dài), bạn TUYỆT ĐỐI BẮT BUỘC áp dụng quy trình "Tằm Ăn Dâu" (Chunking & Compiling) sau:

1. Dùng 'write_file' viết NHÁP Dàn ý và Phần 1 vào 'nhap.md'.
2. Vòng lặp tự nhồi: Dùng 'append_to_file' nối tiếp Phần 2, Phần 3.
3. Liên tục dùng 'append_to_file' cho đến khi viết xong.
4. Gọi Tên công cụ 'compile_file' xuất file cuối cùng.
Bạn CỨ ÂM THẦM làm liên tục các bước này thông qua Tool, hệ thống tự động loop nhịp nhàng cho đến khi 'compile_file' thành công.

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
  googleApiKey: parsed.data.GOOGLE_API_KEY,

  // Model
  model: parsed.data.CLAUDE_MODEL,
  maxTokens: parsed.data.CLAUDE_MAX_TOKENS,
  thinkingBudgetTokens: parsed.data.THINKING_BUDGET_TOKENS,

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
  pairingCode: parsed.data.PAIRING_CODE,
  bashTimeoutMs: parsed.data.BASH_TIMEOUT_MS,
  bashApprovalMode: parsed.data.BASH_APPROVAL_MODE,
  allowHostBash: parsed.data.ALLOW_HOST_BASH === "true",

  // Image generation
  imageApiKey: parsed.data.IMAGE_API_KEY || parsed.data.OPENAI_API_KEY || "",

  // File I/O workspace
  workspaceDir: parsed.data.WORKSPACE_DIR,

  // Gateway
  wsSecret: parsed.data.WS_SECRET || undefined,
} as const;

export type Config = typeof config;
