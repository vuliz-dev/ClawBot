import fs from "node:fs";
import path from "node:path";
import type { ConversationTurn, SessionKey } from "../core/types.js";

interface SessionRow {
  key: string;
  channel: string;
  userId: string;
  chatId: string;
  createdAt: string;
  updatedAt: string;
  turns: ConversationTurn[];
}

interface Store {
  sessions: Record<string, SessionRow>;
}

export class JsonStore {
  private store: Store;
  private dirty = false;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      this.store = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } else {
      this.store = { sessions: {} };
      this.flush();
    }
  }

  getSession(key: SessionKey): SessionRow | undefined {
    return this.store.sessions[key];
  }

  upsertSession(data: { key: string; channel: string; userId: string; chatId: string }) {
    const now = new Date().toISOString();
    if (!this.store.sessions[data.key]) {
      this.store.sessions[data.key] = {
        ...data,
        createdAt: now,
        updatedAt: now,
        turns: [],
      };
    } else {
      this.store.sessions[data.key]!.updatedAt = now;
    }
    this.scheduleSave();
  }

  getTurns(key: SessionKey, limit: number): ConversationTurn[] {
    const session = this.store.sessions[key];
    if (!session) return [];
    const turns = session.turns;
    return turns.slice(-limit);
  }

  appendTurn(key: SessionKey, turn: ConversationTurn) {
    const session = this.store.sessions[key];
    if (!session) return;
    session.turns.push(turn);
    session.updatedAt = new Date().toISOString();
    this.scheduleSave();
  }

  deleteTurns(key: SessionKey) {
    const session = this.store.sessions[key];
    if (!session) return;
    session.turns = [];
    session.updatedAt = new Date().toISOString();
    this.scheduleSave();
  }

  close() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flush();
  }

  private scheduleSave() {
    this.dirty = true;
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush();
      }, 500);
    }
  }

  private flush() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.store, null, 2), { encoding: "utf8" });
    this.dirty = false;
  }
}
