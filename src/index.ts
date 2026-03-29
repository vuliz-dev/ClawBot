import { config } from "./config/env.js";
import { JsonStore } from "./db/client.js";
import { SessionStore } from "./session/store.js";
import { SessionManager } from "./session/manager.js";
import { createAIClient } from "./ai/factory.js";
import { ChannelRegistry } from "./channels/registry.js";
import { TelegramChannel } from "./channels/telegram/index.js";
import { handleInbound } from "./pipeline/handler.js";
import type { HandlerDeps } from "./pipeline/handler.js";
import { createServer } from "./gateway/server.js";
import { CronManager } from "./plugins/cron.js";
import path from "node:path";

async function main() {
  console.log("[clawbot] starting...");

  // 1. Store
  const db = new JsonStore(config.dbPath);
  console.log(`[clawbot] session store: ${config.dbPath}`);

  // 2. Session (với token-based pruning)
  const store = new SessionStore(db);
  const sessionManager = new SessionManager(store, config.maxHistoryTurns, config.maxContextTokens);

  // 3. AI client — chọn provider từ config
  const aiClient = createAIClient({
    provider: config.aiProvider,
    anthropicApiKey: config.anthropicApiKey,
    openaiApiKey: config.openaiApiKey,
    openaiBaseUrl: config.openaiBaseUrl,
  });
  console.log(`[clawbot] ai provider: ${config.aiProvider}`);

  // 4. Channels
  const registry = new ChannelRegistry();
  const telegram = new TelegramChannel(
    config.telegramBotToken,
    config.streamThrottleMs,
    config.allowedUserIds
  );
  registry.register(telegram);

  // 5. Pipeline deps
  const deps: HandlerDeps = {
    sessionManager,
    aiClient,
    channelRegistry: registry,
    config,
  };
  telegram.onMessage = (msg) => handleInbound(msg, deps);

  // 6. Cron manager
  const dataDir = path.dirname(config.dbPath);
  const cronManager = new CronManager(dataDir, async (job) => {
    console.log(`[cron] firing job ${job.id} for chat ${job.chatId}`);
    await handleInbound(
      {
        id: `cron:${job.id}:${Date.now()}`,
        channel: "telegram",
        userId: job.userId,
        chatId: job.chatId,
        text: job.prompt,
        receivedAt: new Date().toISOString(),
        raw: null,
      },
      deps
    );
  });

  deps.cronManager = cronManager;

  // 7. Command deps
  telegram.setCommandDeps({
    sessionManager,
    config,
    aiClient,
    channelRegistry: registry,
    cronManager,
  });

  // 8. Start
  await telegram.start();
  const server = await createServer(config.gatewayPort);

  console.log(`[clawbot] model: ${config.model}`);
  console.log(`[clawbot] bash approval: ${config.bashApprovalMode}`);
  console.log(`[clawbot] max context: ${config.maxContextTokens} tokens`);
  if (config.allowedUserIds.length > 0) {
    console.log(`[clawbot] allowlist: ${config.allowedUserIds.join(", ")}`);
  } else {
    console.log("[clawbot] allowlist: open (all users)");
  }
  console.log("[clawbot] ready ✓");

  // 9. Graceful shutdown
  const shutdown = async () => {
    console.log("\n[clawbot] shutting down...");
    cronManager.stopAll();
    await telegram.stop();
    await server.close();
    db.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[clawbot] fatal:", err);
  process.exit(1);
});
