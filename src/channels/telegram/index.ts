import { Bot, InlineKeyboard, InputFile } from "grammy";
import type { IChannel, StreamHandle } from "../types.js";
import type { InboundMessage, OutboundMessage } from "../../core/types.js";
import type { CommandDeps } from "./commands.js";
import { TelegramStreamSender } from "./stream-sender.js";
import { formatForTelegram } from "./formatter.js";
import { handleCommand } from "./commands.js";
import { chunkText } from "./chunker.js";
import { resolveApproval, getApprovalUserId } from "../../pipeline/approval.js";

export class TelegramChannel implements IChannel {
  readonly id = "telegram";
  onMessage: ((msg: InboundMessage) => Promise<void>) | null = null;

  private bot: Bot;
  private commandDeps: CommandDeps | null = null;
  private allowedUserIds: Set<string>;

  constructor(token: string, private throttleMs: number, allowedUserIds: string[] = []) {
    this.bot = new Bot(token);
    this.allowedUserIds = new Set(allowedUserIds);

    // Text messages (including commands)
    this.bot.on("message:text", async (ctx) => {
      if (!this.isAllowed(ctx.from.id)) {
        await ctx.reply("⛔ Bạn không được phép sử dụng bot này.");
        return;
      }

      const text = ctx.message.text ?? "";

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
      if (!this.isAllowed(ctx.from.id)) {
        await ctx.reply("⛔ Bạn không được phép sử dụng bot này.");
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
      if (!this.isAllowed(ctx.from.id)) return;
      await ctx.reply("🎙 Tin nhắn thoại chưa được hỗ trợ. Vui lòng gửi văn bản.");
    });

    // Video messages — not supported
    this.bot.on("message:video", async (ctx) => {
      if (!this.isAllowed(ctx.from.id)) return;
      await ctx.reply("🎥 Video chưa được hỗ trợ. Vui lòng gửi ảnh hoặc văn bản.");
    });

    // Callback query — xử lý approval buttons
    this.bot.on("callback_query:data", async (ctx) => {
      if (!this.isAllowed(ctx.from.id)) {
        await ctx.answerCallbackQuery({ text: "⛔ Bạn không được phép sử dụng bot này." });
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

  private isAllowed(userId: number): boolean {
    if (this.allowedUserIds.size === 0) return true;
    return this.allowedUserIds.has(String(userId));
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
