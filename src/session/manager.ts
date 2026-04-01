import type { MessageParam } from "../ai/types.js";
import type { SessionKey } from "../core/types.js";
import { SessionStore } from "./store.js";

// Rough token estimate: 4 chars ≈ 1 token
const CHARS_PER_TOKEN = 4;

export class SessionManager {
  constructor(
    private store: SessionStore,
    private maxTurns: number,
    private maxContextTokens: number = 80000
  ) {}

  private makeKey(channel: string, userId: string, chatId: string): SessionKey {
    return `${channel}:${userId}:${chatId}`;
  }

  getOrCreate(channel: string, userId: string, chatId: string) {
    const key = this.makeKey(channel, userId, chatId);
    const existing = this.store.getSession(key);
    if (!existing) {
      this.store.upsertSession({ key, channel, userId, chatId });
    }
    return key;
  }

  getHistory(key: SessionKey): MessageParam[] {
    const turns = this.store.getTurns(key, this.maxTurns * 2);
    const messages: MessageParam[] = turns.map((t) => ({
      role: t.role as MessageParam["role"],
      content: typeof t.content === "string" ? t.content : JSON.stringify(t.content),
    }));
    return this.pruneByTokens(messages);
  }

  /**
   * Cắt bớt lịch sử từ đầu nếu tổng token vượt quá maxContextTokens.
   * Xóa theo cặp (user + assistant) để giữ đúng alternation pattern.
   * Luôn giữ lại ít nhất 2 turns cuối.
   */
  private pruneByTokens(messages: MessageParam[]): MessageParam[] {
    const budget = this.maxContextTokens * CHARS_PER_TOKEN; // chars

    let totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);

    if (totalChars <= budget) return messages;

    const result = [...messages];
    // Xóa 2 messages mỗi lần (1 cặp user+assistant) để không phá vỡ alternation
    while (result.length > 2 && totalChars > budget) {
      const first = result.shift()!;
      totalChars -= first.content.length;
      if (result.length > 2) {
        const second = result.shift()!;
        totalChars -= second.content.length;
      }
    }

    return result;
  }

  appendUserTurn(key: SessionKey, content: string) {
    this.store.appendTurn(key, {
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    });
  }

  appendAssistantTurn(key: SessionKey, content: string) {
    this.store.appendTurn(key, {
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
    });
  }

  reset(key: SessionKey) {
    this.store.deleteTurns(key);
  }
}
