import type { Bot } from "grammy";

/**
 * TelegramStreamSender — tích lũy toàn bộ response rồi gửi 1 lần duy nhất.
 * Không stream-edit liên tục vì dễ bị race condition + text bị cắt.
 * Hiển thị "typing..." indicator trong lúc chờ.
 */
export class TelegramStreamSender {
  private fullText = "";
  private stopped = false;
  private typingInterval: NodeJS.Timeout | null = null;
  private typingMsgId: number | null = null;

  constructor(
    private bot: Bot,
    private chatId: number,
    private _throttleMs: number // kept for interface compat
  ) {
    // Gửi "đang soạn..." indicator ngay khi bắt đầu
    void this.startTyping();
  }

  private async startTyping(): Promise<void> {
    // Chỉ dùng typing action, không gửi tin nhắn ⌛ (gây delay khi delete)
    void this.bot.api.sendChatAction(this.chatId, "typing").catch(() => {});
    this.typingInterval = setInterval(() => {
      void this.bot.api.sendChatAction(this.chatId, "typing").catch(() => {});
    }, 4000);
  }

  update(fullText: string): void {
    if (this.stopped) return;
    this.fullText = fullText;
  }

  async finalize(): Promise<void> {
    this.stopped = true;
    this.clearTyping();

    const text = this.fullText.trim() || "…";

    // Gửi response hoàn chỉnh, chia nhỏ nếu cần
    const chunks = this.splitMessage(text);
    for (const chunk of chunks) {
      try {
        await this.bot.api.sendMessage(this.chatId, chunk);
      } catch (err) {
        console.error("[telegram] send error:", err);
      }
    }
  }

  async abort(): Promise<void> {
    this.stopped = true;
    this.clearTyping();
  }

  private clearTyping(): void {
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
      this.typingInterval = null;
    }
  }

  private splitMessage(text: string, maxLen = 4096): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      let cutAt = maxLen;
      // Cố cắt ở dòng mới thay vì giữa chừng
      const lastNewline = remaining.lastIndexOf("\n", maxLen);
      if (lastNewline > maxLen * 0.6) cutAt = lastNewline + 1;
      chunks.push(remaining.slice(0, cutAt).trimEnd());
      remaining = remaining.slice(cutAt).trimStart();
    }
    return chunks;
  }
}
