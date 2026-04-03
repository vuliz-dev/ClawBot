import { isDockerReady, runInSandbox } from "./sandbox.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config/env.js";

const execAsync = promisify(exec);

export async function runBash(
  command: string,
  timeoutMs: number,
  workspaceDir?: string
): Promise<string> {
  // Mode: if Docker is ready and we want to sandbox, run in sandbox
  const dockerReady = await isDockerReady();

  if (dockerReady) {
    return await runInSandbox(command, workspaceDir, timeoutMs);
  }
  if (!config.allowHostBash) {
    return "⚠️ ❌ Lỗi Bảo mật: Tính năng chạy lệnh Bash thẳng trên máy chủ (Host Bash) đã bị vô hiệu hóa để bảo vệ an toàn hệ thống. Hãy cài đặt Docker môi trường ảo hoặc cấu hình ALLOW_HOST_BASH=true !";
  }

  // Fallback to local execution if Docker is not available
  console.warn("⚠️ [bash] Docker is not ready. Falling back to native local execution on host OS.");
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      cwd: workspaceDir,
      shell: "powershell.exe",
    });
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    return output || "(no output)";
  } catch (err: unknown) {
    if (err && typeof err === "object") {
      const e = err as { killed?: boolean; stdout?: string; stderr?: string; message?: string; code?: number };
      if (e.killed) return `⏱ Native execution timed out after ${timeoutMs / 1000}s`;
      const out = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
      return out || e.message || `Native command failed with code ${e.code}`;
    }
    return String(err);
  }
}
