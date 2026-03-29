import type { InboundMessage, OutboundMessage } from "../core/types.js";

export interface StreamHandle {
  update(fullText: string): void;
  finalize(): Promise<void>;
  abort(): Promise<void>;
}

export interface IChannel {
  readonly id: string;
  onMessage: ((msg: InboundMessage) => Promise<void>) | null;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(msg: OutboundMessage): Promise<string | undefined>;
  sendDocument?(chatId: string, content: string, filename: string, caption?: string): Promise<void>;
  beginStream?(chatId: string): StreamHandle;

  /**
   * Gửi tin nhắn approval (với nút Cho phép / Từ chối) lên channel.
   * Không cần trả về promise — promise được quản lý bởi approval.ts.
   */
  sendApprovalMessage?(chatId: string, approvalId: string, command: string): Promise<void>;

  /**
   * Gửi ảnh lên channel (dùng cho generate_image tool).
   */
  sendPhoto?(chatId: string, imageBuffer: Buffer, caption?: string): Promise<void>;

  /**
   * Gửi file dưới dạng Buffer lên channel (dùng cho write_file tool).
   */
  sendFileBuffer?(chatId: string, buffer: Buffer, filename: string, caption?: string): Promise<void>;
}
