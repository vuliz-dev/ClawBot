import type { ConversationTurn, SessionKey } from "../core/types.js";
import { JsonStore } from "../db/client.js";

export class SessionStore {
  constructor(private db: JsonStore) {}

  getSession(key: SessionKey) {
    return this.db.getSession(key);
  }

  upsertSession(data: { key: string; channel: string; userId: string; chatId: string }) {
    this.db.upsertSession(data);
  }

  getTurns(key: SessionKey, limit: number): ConversationTurn[] {
    return this.db.getTurns(key, limit);
  }

  appendTurn(key: SessionKey, turn: ConversationTurn) {
    this.db.appendTurn(key, turn);
  }

  deleteTurns(key: SessionKey) {
    this.db.deleteTurns(key);
  }
}
