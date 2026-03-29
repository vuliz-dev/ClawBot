import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function runBash(
  command: string,
  timeoutMs: number
): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    return output || "(no output)";
  } catch (err: unknown) {
    if (err && typeof err === "object") {
      const e = err as { killed?: boolean; stdout?: string; stderr?: string; message?: string };
      if (e.killed) return `⏱ Command timed out after ${timeoutMs / 1000}s`;
      const out = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
      return out || e.message || "Command failed";
    }
    return String(err);
  }
}
