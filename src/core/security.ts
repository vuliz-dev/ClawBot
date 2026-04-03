import fs from "node:fs";
import path from "node:path";
import { config } from "../config/env.js";

interface IPairingState {
  isAllowed: boolean;
  message?: string;
  isNewlyPaired?: boolean;
}

export class SecurityManager {
  private whitelistedUsers = new Set<string>();
  private lockouts = new Map<string, { attempts: number; lockUntil: number }>();
  private whitelistPath: string;

  constructor() {
    this.whitelistPath = path.join(path.dirname(config.dbPath), "whitelist.json");
    this.loadWhitelist();

    // Thêm tĩnh các user cố định từ config vào set
    for (const id of config.allowedUserIds) {
      this.whitelistedUsers.add(id);
    }
  }

  private loadWhitelist() {
    if (fs.existsSync(this.whitelistPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.whitelistPath, "utf8"));
        if (Array.isArray(data)) {
          for (const id of data) this.whitelistedUsers.add(String(id));
        }
      } catch (err) {
        console.error("[security] failed to load whitelist:", err);
      }
    }
  }

  private saveWhitelist() {
    try {
      // Chỉ lưu những ID không nằm trong hardcode config để tránh trùng lặp
      const dynamicUsers = Array.from(this.whitelistedUsers).filter(id => !config.allowedUserIds.includes(id));
      fs.writeFileSync(this.whitelistPath, JSON.stringify(dynamicUsers, null, 2), "utf8");
    } catch (err) {
      console.error("[security] failed to save whitelist:", err);
    }
  }

  /**
   * Kiểm tra xem user có được phép sử dụng bot không.
   * Nếu user nhắn tin chứa mã Pairing Code hợp lệ, họ sẽ được cấp quyền vĩnh viễn.
   */
  public checkAccess(userId: string, incomingText: string): IPairingState {
    const now = Date.now();
    const lockout = this.lockouts.get(userId);
    if (lockout && lockout.lockUntil > now) {
      const remainMins = Math.ceil((lockout.lockUntil - now) / 60000);
      return { isAllowed: false, message: `⛔ BẠN ĐÃ BỊ KHOÁ MÕM! Nhập sai quá nhiều lần. Vui lòng thử lại sau ${remainMins} phút.` };
    }

    if (lockout && lockout.lockUntil <= now) {
      this.lockouts.delete(userId);
    }

    // 1. Phân quyền cốt lõi (Hard-Block Mode): Nếu ko điền ALLOWED_USER và ko điền PAIRING, CHẶN SẠCH!
    if (config.allowedUserIds.length === 0 && !config.pairingCode) {
      if (this.whitelistedUsers.has(userId)) return { isAllowed: true };
      return { isAllowed: false, message: "⛔ Bot chưa được cấu hình ALLOWED_USER_IDS hoặc PAIRING_CODE. Vui lòng cấu hình trên Server." };
    }

    // 2. Nếu đã có trong danh sách
    if (this.whitelistedUsers.has(userId)) {
      return { isAllowed: true };
    }

    // 3. User chưa có quyền. Kiểm tra xem file cấu hình có bật chế độ Pairing Pin không
    if (!config.pairingCode) {
      // Nếu không cấu hình Pairing Code, chặn hoàn toàn
      return { isAllowed: false, message: "⛔ Bạn không có quyền truy cập Bot này." };
    }

    // 4. Nếu họ nhập đúng Pairing Code
    if (incomingText.trim() === config.pairingCode) {
      this.whitelistedUsers.add(userId);
      this.lockouts.delete(userId);
      this.saveWhitelist();
      return { 
        isAllowed: true, 
        isNewlyPaired: true,
        message: "✅ Ghép nối thành công! Bạn đã được cấp quyền sử dụng hệ thống AI." 
      };
    }

    // 5. Nếu họ nhập sai hoặc nhắn tin bình thường
    const currentAttempts = (this.lockouts.get(userId)?.attempts || 0) + 1;
    if (currentAttempts >= 5) {
      this.lockouts.set(userId, { attempts: currentAttempts, lockUntil: now + 15 * 60 * 1000 });
      return { isAllowed: false, message: "⛔ Bạn đã bị khóa 15 phút do nhập sai mã 5 lần liên tiếp để chống Brute-force." };
    } else {
      this.lockouts.set(userId, { attempts: currentAttempts, lockUntil: 0 });
    }

    return { 
      isAllowed: false, 
      message: `🔒 Hệ thống đang khoá. Vui lòng nhập mã PIN ghép nối để trò chuyện (Bạn đã nhập sai ${currentAttempts}/5 lần):` 
    };
  }
}
