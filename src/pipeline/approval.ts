// Exec approval system — AI phải xin phép user trước khi chạy lệnh nguy hiểm

import crypto from "node:crypto";

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000; // 5 phút

type ApprovalResult = "approved" | "rejected" | "timeout";

interface PendingApproval {
  resolve: (result: ApprovalResult) => void;
  chatId: string;
  userId: string;
}

const pending = new Map<string, PendingApproval>();

/**
 * Đăng ký một approval với ID cho trước.
 * Trả về promise sẽ resolve khi user approve/reject hoặc hết timeout.
 */
export function registerApproval(approvalId: string, chatId: string, userId: string): Promise<ApprovalResult> {
  return new Promise<ApprovalResult>((resolve) => {
    const timer = setTimeout(() => {
      if (pending.has(approvalId)) {
        pending.delete(approvalId);
        resolve("timeout");
      }
    }, APPROVAL_TIMEOUT_MS);

    pending.set(approvalId, {
      resolve: (result) => {
        clearTimeout(timer);
        pending.delete(approvalId);
        resolve(result);
      },
      chatId,
      userId,
    });
  });
}

/**
 * Tạo approvalId mới và đăng ký.
 */
export function createApproval(chatId: string, userId: string): { approvalId: string; promise: Promise<ApprovalResult> } {
  const approvalId = `appr_${crypto.randomBytes(16).toString("hex")}`;
  const promise = registerApproval(approvalId, chatId, userId);
  return { approvalId, promise };
}

/**
 * Lấy userId của approval đang chờ (để verify trước khi resolve).
 */
export function getApprovalUserId(approvalId: string): string | undefined {
  return pending.get(approvalId)?.userId;
}

/**
 * Gọi khi user bấm nút Approve/Reject trên Telegram.
 * Trả về true nếu tìm thấy pending approval.
 */
export function resolveApproval(
  approvalId: string,
  result: "approved" | "rejected"
): boolean {
  const item = pending.get(approvalId);
  if (!item) return false;
  item.resolve(result);
  return true;
}

/**
 * Kiểm tra có pending approval nào cho chatId này không.
 */
export function hasPendingApproval(chatId: string): boolean {
  for (const item of pending.values()) {
    if (item.chatId === chatId) return true;
  }
  return false;
}
