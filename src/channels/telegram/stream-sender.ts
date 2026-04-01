import type { Bot } from "grammy";
import { formatForTelegram } from "./formatter.js";

const MIN_CHARS_BEFORE_SEND = 20; // Chờ ít nhất 20 ký tự trước khi gửi tin đầu
const THROTTLE_MS = 1200;         // Edit tối đa 1 lần/1.2s để không bị rate limit

/**
 * TelegramStreamSender — gửi 1 message ngay khi có đủ text, sau đó edit liên tục
 * mỗi THROTTLE_MS khi token mới đến. Khi finalize() được gọi, thực hiện edit cuối
 * với text hoàn chỉnh đã format.
 */
export class TelegramStreamSender {
  private fullText = "";
  private stopped = false;

  // ID của tin nhắn đang stream (undefined = chưa gửi lần đầu)
  private streamMessageId: number | undefined;

  // Throttle state
  private pendingEdit = false;
  private lastEditAt = 0;
  private throttleTimer: NodeJS.Timeout | null = null;

  // Typing indicator interval
  private typingInterval: NodeJS.Timeout | null = null;

  constructor(
    private bot: Bot,
    private chatId: number,
    private _throttleMs: number // kept for interface compat
  ) {
    void this.startTyping();
  }

  private startTyping(): void {
    void this.bot.api.sendChatAction(this.chatId, "typing").catch(() => {});
    this.typingInterval = setInterval(() => {
      if (!this.streamMessageId) {
        // Chỉ giữ typing khi chưa có message
        void this.bot.api.sendChatAction(this.chatId, "typing").catch(() => {});
      }
    }, 4000);
  }

  private clearTyping(): void {
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
      this.typingInterval = null;
    }
  }

  /** Được gọi liên tục mỗi khi có token mới từ AI */
  update(fullText: string): void {
    if (this.stopped) return;
    this.fullText = fullText;
    void this.scheduleEdit();
  }

  private async scheduleEdit(): Promise<void> {
    const now = Date.now();
    const sinceLastEdit = now - this.lastEditAt;

    // Chưa đủ text để gửi lần đầu
    if (this.fullText.length < MIN_CHARS_BEFORE_SEND && !this.streamMessageId) return;

    // Đang chờ throttle timer
    if (this.throttleTimer) return;

    // Đủ thời gian giữa các edit → gửi ngay
    if (sinceLastEdit >= THROTTLE_MS) {
      await this.doEdit();
      return;
    }

    // Chưa đủ thời gian → đặt timer để gửi sau
    if (!this.pendingEdit) {
      this.pendingEdit = true;
      this.throttleTimer = setTimeout(async () => {
        this.throttleTimer = null;
        this.pendingEdit = false;
        if (!this.stopped) {
          await this.doEdit();
        }
      }, THROTTLE_MS - sinceLastEdit);
    }
  }

  private async doEdit(): Promise<void> {
    if (this.stopped) return;

    const text = this.fullText.trim();
    if (!text) return;

    this.lastEditAt = Date.now();

    // Giới hạn 4096 ký tự cho Telegram trong khi stream
    const preview = text.length > 4000 ? text.slice(0, 4000) + "\n…" : text;

    try {
      if (!this.streamMessageId) {
        // Lần đầu: gửi message mới
        this.clearTyping();
        const result = await this.bot.api.sendMessage(this.chatId, preview);
        this.streamMessageId = result.message_id;
      } else {
        // Các lần sau: edit message đang có
        try {
          await this.bot.api.editMessageText(this.chatId, this.streamMessageId, preview);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Bỏ qua lỗi "message is not modified"
          if (!msg.includes("not modified") && !msg.includes("MESSAGE_NOT_MODIFIED")) {
            console.warn("[stream-sender] editMessageText error:", msg);
          }
        }
      }
    } catch (err) {
      console.error("[stream-sender] doEdit error:", err);
    }
  }

  async finalize(): Promise<void> {
    this.stopped = true;
    this.clearTyping();

    // Hủy timer còn pending
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }

    const text = this.fullText.trim() || "…";
    const chunks = this.splitMessage(text);

    if (this.streamMessageId) {
      // Đã có message đang stream — edit chunk đầu với text format đẹp
      const firstChunk = formatForTelegram(chunks[0]!);
      try {
        await this.bot.api.editMessageText(this.chatId, this.streamMessageId, firstChunk, {
          parse_mode: "MarkdownV2",
        });
      } catch {
        // Fallback không format nếu MarkdownV2 lỗi
        try {
          await this.bot.api.editMessageText(this.chatId, this.streamMessageId, chunks[0]!);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes("not modified")) {
            console.error("[stream-sender] finalize edit error:", msg);
          }
        }
      }
      // Gửi các chunk còn lại (nếu text > 4096)
      for (const chunk of chunks.slice(1)) {
        await this.sendChunk(chunk);
      }
    } else {
      // Chưa có message nào — gửi lần đầu
      this.clearTyping();
      for (const chunk of chunks) {
        await this.sendChunk(chunk);
      }
    }
  }

  private async sendChunk(text: string): Promise<void> {
    const formatted = formatForTelegram(text);
    try {
      await this.bot.api.sendMessage(this.chatId, formatted, { parse_mode: "MarkdownV2" });
    } catch {
      try {
        await this.bot.api.sendMessage(this.chatId, text);
      } catch (err) {
        console.error("[stream-sender] sendChunk error:", err);
      }
    }
  }

  async abort(): Promise<void> {
    this.stopped = true;
    this.clearTyping();
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
  }

  private splitMessage(text: string, maxLen = 4096): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      let cutAt = maxLen;
      const lastNewline = remaining.lastIndexOf("\n", maxLen);
      if (lastNewline > maxLen * 0.6) cutAt = lastNewline + 1;
      chunks.push(remaining.slice(0, cutAt).trimEnd());
      remaining = remaining.slice(cutAt).trimStart();
    }
    return chunks;
  }
}
