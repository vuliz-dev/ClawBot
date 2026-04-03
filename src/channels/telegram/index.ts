import { Bot, InlineKeyboard, InputFile } from "grammy";
import type { IChannel, StreamHandle } from "../types.js";
import type { InboundMessage, OutboundMessage } from "../../core/types.js";
import type { CommandDeps } from "./commands.js";
import { TelegramStreamSender } from "./stream-sender.js";
import { formatForTelegram } from "./formatter.js";
import { handleCommand } from "./commands.js";
import { chunkText } from "./chunker.js";
import { resolveApproval, getApprovalUserId } from "../../pipeline/approval.js";
import type { SecurityManager } from "../../core/security.js";

export class TelegramChannel implements IChannel {
  readonly id = "telegram";
  onMessage: ((msg: InboundMessage) => Promise<void>) | null = null;

  private bot: Bot;
  private commandDeps: CommandDeps | null = null;
  private security: SecurityManager;

  constructor(token: string, private throttleMs: number, securityManager: SecurityManager) {
    this.bot = new Bot(token);
    this.security = securityManager;

    // Text messages (including commands)
    this.bot.on("message:text", async (ctx) => {
      let text = ctx.message.text ?? "";
      
      const replyMsg = ctx.message.reply_to_message;
      if (replyMsg) {
        // @ts-ignore - grammy types sometimes don't expose text/caption dynamically
        const repliedText = replyMsg.text || replyMsg.caption;
        if (repliedText) {
          text = `_[Người dùng đang reply lại tin nhắn: "${repliedText}"]_\n\n${text}`;
        }
      }
      
      const access = this.security.checkAccess(String(ctx.from.id), text);
      if (!access.isAllowed) {
        await ctx.reply(access.message || "⛔ Bot bị khoá.");
        return;
      }
      if (access.isNewlyPaired) {
        // Tự động xóa tin nhắn chứa PIN của User để bảo mật
        await ctx.deleteMessage().catch(() => {});
        await ctx.reply(access.message || "✅ Ghép nối thành công!");
        return;
      }

      // Handle commands
      if (text.startsWith("/") && this.commandDeps) {
        const command = text.split(" ")[0]!.toLowerCase();
        const handled = await handleCommand(ctx, command, this.commandDeps);
        if (handled) return;
      }

      const inbound: InboundMessage = {
        id: `telegram:${ctx.from.id}:${ctx.message.message_id}`,
        channel: "telegram",
        userId: String(ctx.from.id),
        chatId: String(ctx.chat.id),
        text,
        receivedAt: new Date().toISOString(),
        raw: ctx,
      };

      void ctx.replyWithChatAction("typing");

      try {
        await this.onMessage?.(inbound);
      } catch (err) {
        console.error("[telegram] onMessage error:", err);
      }
    });

    // Photo messages — send image to Claude
    this.bot.on("message:photo", async (ctx) => {
      const access = this.security.checkAccess(String(ctx.from.id), "");
      if (!access.isAllowed) {
        await ctx.reply(access.message || "⛔ Bot bị khoá.");
        return;
      }

      const caption = ctx.message.caption ?? "";
      const photo = ctx.message.photo.at(-1); // largest size
      if (!photo) return;

      let imageBase64: string | undefined;
      try {
        const file = await ctx.getFile();
        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        const resp = await fetch(fileUrl);
        const buf = await resp.arrayBuffer();
        imageBase64 = Buffer.from(buf).toString("base64");
      } catch (err) {
        console.error("[telegram] photo download error:", err);
      }

      const inbound: InboundMessage = {
        id: `telegram:${ctx.from.id}:${ctx.message.message_id}`,
        channel: "telegram",
        userId: String(ctx.from.id),
        chatId: String(ctx.chat.id),
        text: caption || "Ảnh này có gì?",
        receivedAt: new Date().toISOString(),
        raw: { ctx, imageBase64, mimeType: "image/jpeg" },
      };

      void ctx.replyWithChatAction("typing");

      try {
        await this.onMessage?.(inbound);
      } catch (err) {
        console.error("[telegram] photo onMessage error:", err);
      }
    });

    // Voice messages — not supported yet
    this.bot.on("message:voice", async (ctx) => {
      const access = this.security.checkAccess(String(ctx.from.id), "");
      if (!access.isAllowed) return;
      await ctx.reply("🎙 Tin nhắn thoại chưa được hỗ trợ. Vui lòng gửi văn bản.");
    });

    // Video messages — not supported
    this.bot.on("message:video", async (ctx) => {
      const access = this.security.checkAccess(String(ctx.from.id), "");
      if (!access.isAllowed) return;
      await ctx.reply("🎥 Video chưa được hỗ trợ. Vui lòng gửi ảnh hoặc văn bản.");
    });

    // Callback query — xử lý approval buttons
    this.bot.on("callback_query:data", async (ctx) => {
      const access = this.security.checkAccess(String(ctx.from.id), "");
      if (!access.isAllowed) {
        await ctx.answerCallbackQuery({ text: "⛔ Bot bị khoá." });
        return;
      }

      const data = ctx.callbackQuery.data;

      if (data.startsWith("approve:") || data.startsWith("reject:")) {
        const [action, approvalId] = data.split(":");

        // Chỉ chủ sở hữu approval mới có thể approve/reject
        const approvalOwner = getApprovalUserId(approvalId!);
        if (approvalOwner && approvalOwner !== String(ctx.from.id)) {
          await ctx.answerCallbackQuery({ text: "⛔ Chỉ người tạo lệnh mới có thể phê duyệt." });
          return;
        }

        const result = action === "approve" ? "approved" : "rejected";
        const resolved = resolveApproval(approvalId!, result);

        if (resolved) {
          const label = result === "approved" ? "✅ Đã cho phép" : "❌ Đã từ chối";
          try {
            await ctx.editMessageText(`${label}\n\`${ctx.callbackQuery.message?.text?.split("\n")[1] ?? ""}\``);
          } catch {
            // ignore edit errors
          }
          await ctx.answerCallbackQuery({ text: label });
        } else {
          await ctx.answerCallbackQuery({ text: "⚠️ Request đã hết hạn." });
        }
        return;
      }

      await ctx.answerCallbackQuery();
    });

    this.bot.catch((err) => {
      console.error("[telegram] bot error:", err);
    });
  }

  setCommandDeps(deps: CommandDeps) {
    this.commandDeps = deps;
  }

  async start(): Promise<void> {
    void this.bot.start({ drop_pending_updates: true });
    console.log("[telegram] bot started (polling)");
  }

  async stop(): Promise<void> {
    await this.bot.stop();
    console.log("[telegram] bot stopped");
  }

  async send(msg: OutboundMessage): Promise<string | undefined> {
    const chunks = chunkText(msg.text);
    let lastId: string | undefined;

    // Handle Edit Message Update Phase
    if (msg.editMessageId && chunks.length > 0) {
      try {
        await this.bot.api.editMessageText(
          Number(msg.chatId),
          Number(msg.editMessageId),
          formatForTelegram(chunks[0]),
          { parse_mode: "MarkdownV2" }
        );
        return msg.editMessageId;
      } catch (err: any) {
        // If edit fails (e.g., text hasn't changed), ignore and don't spam a new send
        if (err?.description?.includes("message is not modified")) {
          return msg.editMessageId;
        }
        try {
          await this.bot.api.editMessageText(
            Number(msg.chatId),
            Number(msg.editMessageId),
            chunks[0]
          );
          return msg.editMessageId;
        } catch { } // Error fallback -> will proceed to send new.
      }
    }

    // Default New Message Send Phase
    for (const chunk of chunks) {
      try {
        const result = await this.bot.api.sendMessage(
          Number(msg.chatId),
          formatForTelegram(chunk),
          { parse_mode: "MarkdownV2" }
        );
        lastId = String(result.message_id);
      } catch {
        try {
          const result = await this.bot.api.sendMessage(Number(msg.chatId), chunk);
          lastId = String(result.message_id);
        } catch (err) {
          console.error("[telegram] send error:", err);
        }
      }
    }

    return lastId;
  }

  async sendDocument(chatId: string, content: string, filename: string, caption?: string): Promise<void> {
    const buf = Buffer.from(content, "utf8");
    await this.bot.api.sendDocument(
      Number(chatId),
      new InputFile(buf, filename),
      caption ? { caption } : undefined
    );
  }

  async sendFileBuffer(chatId: string, buffer: Buffer, filename: string, caption?: string): Promise<void> {
    await this.bot.api.sendDocument(
      Number(chatId),
      new InputFile(buffer, filename),
      caption ? { caption } : undefined
    );
  }

  beginStream(chatId: string): StreamHandle {
    return new TelegramStreamSender(this.bot, Number(chatId), this.throttleMs);
  }

  async sendPhoto(chatId: string, imageBuffer: Buffer, caption?: string): Promise<void> {
    await this.bot.api.sendPhoto(
      Number(chatId),
      new InputFile(imageBuffer, "image.png"),
      caption ? { caption } : undefined
    );
  }

  /**
   * Gửi tin nhắn approval với inline keyboard Cho phép / Từ chối.
   * Promise được quản lý bởi approval.ts (registerApproval đã được gọi trước).
   */
  async sendApprovalMessage(chatId: string, approvalId: string, command: string): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text("✅ Cho phép", `approve:${approvalId}`)
      .text("❌ Từ chối", `reject:${approvalId}`);

    const displayCmd = command.length > 100 ? command.slice(0, 100) + "..." : command;

    try {
      await this.bot.api.sendMessage(
        Number(chatId),
        `⚠️ *AI muốn chạy lệnh shell:*\n\`${displayCmd}\`\n\nBạn có muốn cho phép không? _(timeout: 5 phút)_`,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    } catch (err) {
      console.error("[telegram] approval send error:", err);
    }
  }
}
