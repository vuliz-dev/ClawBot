import { InputFile } from "grammy";
import type { Context } from "grammy";
import type { SessionManager } from "../../session/manager.js";
import type { Config } from "../../config/env.js";
import type { ChannelRegistry } from "../../channels/registry.js";
import type { CronManager } from "../../plugins/cron.js";
import { runBash } from "../../plugins/bash.js";
import { runSkill, SKILL_LIST } from "../../plugins/skills/index.js";
import { cancelStream } from "../../pipeline/active-streams.js";
import { handleInbound } from "../../pipeline/handler.js";
import fs from "node:fs";
import path from "node:path";

export interface CommandDeps {
  sessionManager: SessionManager;
  config: Config;
  aiClient?: import("../../ai/types.js").AIClient;
  channelRegistry?: ChannelRegistry;
  cronManager?: CronManager;
}

function makeSessionKey(ctx: Context): string {
  const userId = String(ctx.from?.id ?? "unknown");
  const chatId = String(ctx.chat?.id ?? "unknown");
  return `telegram:${userId}:${chatId}`;
}

export async function handleCommand(
  ctx: Context,
  command: string,
  deps: CommandDeps
): Promise<boolean> {
  const { sessionManager, config } = deps;
  const text = (ctx.message as { text?: string })?.text ?? "";

  // Extract args after command (handle /cmd@botname args)
  const rawArgs = text.replace(/^\/\S+\s*/, "").trim();

  switch (command) {
    case "/help": {
      await ctx.reply(
        `🤖 *Clawbot* — Claude trên Telegram\n\n` +
        `*Lệnh cơ bản:*\n` +
        `/help — Hiện trợ giúp\n` +
        `/new — Bắt đầu cuộc trò chuyện mới\n` +
        `/reset — Xóa lịch sử chat\n` +
        `/id — Xem ID Telegram của bạn\n` +
        `/model — Xem model đang dùng\n` +
        `/stop — Dừng phản hồi đang chạy\n` +
        `/export — Xuất lịch sử chat\n\n` +
        `*Nâng cao:*\n` +
        `/btw <câu hỏi> — Hỏi nhanh không lưu lịch sử\n` +
        `/bash <lệnh> — Chạy lệnh shell\n` +
        `/skill <tên> <args> — Dùng skill\n` +
        `/cron add <cron> <prompt> — Thêm cron job\n` +
        `/cron list — Danh sách cron\n` +
        `/cron del <id> — Xóa cron job\n\n` +
        `*AI Tools (tự động):*\n` +
        `🌐 web_search — Tìm kiếm web\n` +
        `🔗 fetch_url — Đọc nội dung URL\n` +
        `💾 memory_search — Tìm trong lịch sử cũ\n` +
        `🔐 run_bash — Chạy lệnh (có xác nhận)\n\n` +
        `Model: \`${config.model}\``,
        { parse_mode: "Markdown" }
      );
      return true;
    }

    case "/new":
    case "/reset": {
      const key = makeSessionKey(ctx);
      await saveMemory(key, sessionManager, config);
      sessionManager.reset(key);
      await ctx.reply("✅ Đã bắt đầu cuộc trò chuyện mới.");
      return true;
    }

    case "/id":
    case "/whoami": {
      await ctx.reply(
        `👤 User ID: \`${ctx.from?.id}\`\n` +
        `💬 Chat ID: \`${ctx.chat?.id}\``,
        { parse_mode: "Markdown" }
      );
      return true;
    }

    case "/model": {
      await ctx.reply(`🧠 Model: \`${config.model}\``, { parse_mode: "Markdown" });
      return true;
    }

    case "/stop": {
      const chatId = String(ctx.chat?.id ?? "");
      const cancelled = cancelStream(chatId);
      await ctx.reply(cancelled ? "⏹ Đã dừng phản hồi." : "Không có phản hồi nào đang chạy.");
      return true;
    }

    case "/export": {
      const key = makeSessionKey(ctx);
      const turns = sessionManager.getHistory(key);
      if (turns.length === 0) {
        await ctx.reply("Không có lịch sử để xuất.");
        return true;
      }
      const content = buildExportMarkdown(key, turns);
      const tmpPath = path.join(
        path.dirname(config.dbPath),
        `export-${Date.now()}.md`
      );
      fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
      fs.writeFileSync(tmpPath, content, "utf8");
      try {
        await ctx.replyWithDocument(
          new InputFile(tmpPath, `chat-export-${Date.now()}.md`),
          { caption: "📄 Lịch sử chat" }
        );
      } finally {
        fs.rmSync(tmpPath, { force: true });
      }
      return true;
    }

    case "/bash": {
      if (!rawArgs) {
        await ctx.reply("Usage: /bash <command>");
        return true;
      }
      await ctx.replyWithChatAction("typing");
      const output = await runBash(rawArgs, config.bashTimeoutMs);
      const reply = output.length > 3800
        ? output.slice(0, 3800) + "\n...(truncated)"
        : output;
      await ctx.reply(`\`\`\`\n${reply}\n\`\`\``, { parse_mode: "Markdown" });
      return true;
    }

    case "/skill": {
      if (!rawArgs) {
        await ctx.reply(SKILL_LIST, { parse_mode: "Markdown" });
        return true;
      }
      await ctx.replyWithChatAction("typing");
      const result = await runSkill(rawArgs);
      if (!result) {
        await ctx.reply(`Skill không tìm thấy: \`${rawArgs.split(" ")[0]}\`\n\n${SKILL_LIST}`, {
          parse_mode: "Markdown",
        });
        return true;
      }
      await ctx.reply(result.output);
      return true;
    }

    case "/btw": {
      if (!rawArgs || !deps.aiClient || !deps.channelRegistry) return false;

      void ctx.replyWithChatAction("typing");
      const inbound = {
        id: `telegram:btw:${ctx.from?.id}:${Date.now()}`,
        channel: "telegram" as const,
        userId: String(ctx.from?.id ?? "unknown"),
        chatId: String(ctx.chat?.id ?? "unknown"),
        text: rawArgs,
        receivedAt: new Date().toISOString(),
        raw: null,
      };
      await handleInbound(
        inbound,
        {
          sessionManager,
          aiClient: deps.aiClient,
          channelRegistry: deps.channelRegistry,
          config,
        },
        { noHistory: true }
      );
      return true;
    }

    case "/cron": {
      const cronManager = deps.cronManager;
      if (!cronManager) {
        await ctx.reply("Cron not available.");
        return true;
      }
      const cronArgs = rawArgs.split(/\s+/);
      const sub = cronArgs[0]?.toLowerCase();
      const chatId = String(ctx.chat?.id ?? "");
      const userId = String(ctx.from?.id ?? "");

      if (sub === "list") {
        const jobs = cronManager.list(chatId);
        if (jobs.length === 0) {
          await ctx.reply("Không có cron job nào.");
          return true;
        }
        const lines = jobs.map(
          (j) => `• \`${j.id.slice(-6)}\` — \`${j.expression}\`\n  📝 ${j.prompt}`
        );
        await ctx.reply(`*Cron jobs:*\n${lines.join("\n\n")}`, { parse_mode: "Markdown" });
        return true;
      }

      if (sub === "del" || sub === "delete" || sub === "rm") {
        const jobIdPart = cronArgs[1];
        if (!jobIdPart) {
          await ctx.reply("Usage: /cron del <id>");
          return true;
        }
        // Find job whose id ends with the provided suffix
        const jobs = cronManager.list(chatId);
        const job = jobs.find((j) => j.id.endsWith(jobIdPart) || j.id === jobIdPart);
        if (!job) {
          await ctx.reply(`Không tìm thấy job: \`${jobIdPart}\``, { parse_mode: "Markdown" });
          return true;
        }
        cronManager.delete(chatId, job.id);
        await ctx.reply(`✅ Đã xóa job \`${job.id.slice(-6)}\``, { parse_mode: "Markdown" });
        return true;
      }

      if (sub === "add") {
        // /cron add <expr> <prompt>
        // expr can be "* * * * *" (5 parts) or named "@hourly" etc.
        const rest = cronArgs.slice(1).join(" ");
        // Try to extract cron expression: either @keyword or 5/6 space-separated fields
        let expression: string;
        let prompt: string;

        if (rest.startsWith("@")) {
          const spaceIdx = rest.indexOf(" ");
          if (spaceIdx === -1) {
            await ctx.reply("Usage: /cron add @hourly <prompt>");
            return true;
          }
          expression = rest.slice(0, spaceIdx);
          prompt = rest.slice(spaceIdx + 1).trim();
        } else {
          // Try 5 or 6 fields
          const parts = rest.split(/\s+/);
          const fields = parts.length >= 6 ? 6 : 5;
          expression = parts.slice(0, fields).join(" ");
          prompt = parts.slice(fields).join(" ");
        }

        if (!prompt) {
          await ctx.reply(
            "Usage: /cron add <cron-expression> <prompt>\n" +
            "Ví dụ: `/cron add 0 8 * * * Nhắc tôi uống nước`",
            { parse_mode: "Markdown" }
          );
          return true;
        }

        const job = cronManager.add(chatId, userId, expression, prompt);
        if (!job) {
          await ctx.reply(`❌ Cron expression không hợp lệ: \`${expression}\``, {
            parse_mode: "Markdown",
          });
          return true;
        }
        await ctx.reply(
          `✅ Đã thêm cron job \`${job.id.slice(-6)}\`\n` +
          `⏰ \`${expression}\`\n` +
          `📝 ${prompt}`,
          { parse_mode: "Markdown" }
        );
        return true;
      }

      await ctx.reply(
        "*Cron commands:*\n" +
        "`/cron add <expr> <prompt>` — Thêm job\n" +
        "`/cron list` — Danh sách jobs\n" +
        "`/cron del <id>` — Xóa job",
        { parse_mode: "Markdown" }
      );
      return true;
    }

    default:
      return false;
  }
}

function buildExportMarkdown(
  key: string,
  turns: { role: string; content: unknown }[]
): string {
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
    const content = typeof t.content === "string"
      ? t.content
      : JSON.stringify(t.content);
    lines.push(`### ${role}\n\n${content}\n`);
  }
  return lines.join("\n");
}

async function saveMemory(
  key: string,
  sessionManager: SessionManager,
  config: Config
): Promise<void> {
  const turns = sessionManager.getHistory(key);
  if (turns.length === 0) return;

  const memDir = path.join(path.dirname(config.dbPath), "memories");
  fs.mkdirSync(memDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toISOString().slice(11, 16).replace(":", "");
  const filename = `${date}-${time}-${key.replace(/:/g, "_")}.md`;

  const content = [
    `# Session Memory`,
    `**Key:** ${key}`,
    `**Saved:** ${new Date().toISOString()}`,
    `**Turns:** ${turns.length}`,
    ``,
    `## Conversation`,
    ...turns.map((t) => {
      const c = typeof t.content === "string" ? t.content : JSON.stringify(t.content);
      return `**${t.role === "user" ? "User" : "Claude"}:** ${c}`;
    }),
  ].join("\n");

  fs.writeFileSync(path.join(memDir, filename), content, "utf8");
}
