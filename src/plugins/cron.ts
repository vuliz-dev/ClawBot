import { Cron } from "croner";
import fs from "node:fs";
import path from "node:path";

export interface CronJob {
  id: string;
  chatId: string;
  userId: string;
  expression: string;
  prompt: string;
  createdAt: string;
}

export type CronFireCallback = (job: CronJob) => Promise<void>;

export class CronManager {
  private jobs = new Map<string, { job: CronJob; cron: Cron }>();
  private storePath: string;
  private onFire: CronFireCallback;

  constructor(dataDir: string, onFire: CronFireCallback) {
    this.storePath = path.join(dataDir, "cron-jobs.json");
    this.onFire = onFire;
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.storePath)) return;
      const data = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as CronJob[];
      for (const job of data) {
        this.scheduleInternal(job);
      }
      console.log(`[cron] loaded ${data.length} jobs`);
    } catch (err) {
      console.error("[cron] load error:", err);
    }
  }

  private save(): void {
    const jobs = [...this.jobs.values()].map((e) => e.job);
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, JSON.stringify(jobs, null, 2), "utf8");
  }

  private scheduleInternal(job: CronJob): boolean {
    try {
      const cron = new Cron(job.expression, { timezone: "Asia/Ho_Chi_Minh" }, async () => {
        await this.onFire(job);
      });
      this.jobs.set(job.id, { job, cron });
      return true;
    } catch {
      console.error(`[cron] invalid expression for job ${job.id}: ${job.expression}`);
      return false;
    }
  }

  add(chatId: string, userId: string, expression: string, prompt: string): CronJob | null {
    // Kiểm tra duplicate: cùng chatId + expression + prompt tương tự → không thêm
    const existing = [...this.jobs.values()].find(
      (e) => e.job.chatId === chatId && e.job.expression === expression
    );
    if (existing) {
      console.log(`[cron] duplicate job blocked: ${chatId} ${expression}`);
      // Xóa job cũ trùng rồi tạo lại với prompt mới
      existing.cron.stop();
      this.jobs.delete(existing.job.id);
    }

    const id = `${chatId}-${Date.now()}`;
    const job: CronJob = {
      id,
      chatId,
      userId,
      expression,
      prompt,
      createdAt: new Date().toISOString(),
    };
    if (!this.scheduleInternal(job)) return null;
    this.save();
    return job;
  }

  list(chatId: string): CronJob[] {
    return [...this.jobs.values()]
      .filter((e) => e.job.chatId === chatId)
      .map((e) => e.job);
  }

  delete(chatId: string, jobId: string): boolean {
    const entry = this.jobs.get(jobId);
    if (!entry || entry.job.chatId !== chatId) return false;
    entry.cron.stop();
    this.jobs.delete(jobId);
    this.save();
    return true;
  }

  stopAll(): void {
    for (const { cron } of this.jobs.values()) {
      cron.stop();
    }
  }
}
