import { config } from "./config/env.js";
import { JsonStore } from "./db/client.js";
import { SessionStore } from "./session/store.js";
import { SessionManager } from "./session/manager.js";
import { createAIClient } from "./ai/factory.js";
import { ChannelRegistry } from "./channels/registry.js";
import { TelegramChannel } from "./channels/telegram/index.js";
import { CLIChannel } from "./channels/cli/index.js";
import { handleInbound, ensureSkillsLoaded } from "./pipeline/handler.js";
import type { HandlerDeps } from "./pipeline/handler.js";
import { createServer } from "./gateway/server.js";
import { CronManager } from "./plugins/cron.js";
import { SecurityManager } from "./core/security.js";
import { BrowserManager } from "./plugins/browser.js";
import { ContextManager } from "./core/context.js";
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
    googleApiKey: config.googleApiKey,
  });
  console.log(`[clawbot] ai provider: ${config.aiProvider}`);

  // 4. Security & Channels
  const securityManager = new SecurityManager();
  const registry = new ChannelRegistry();

  if (config.telegramBotToken) {
    const telegram = new TelegramChannel(
      config.telegramBotToken,
      config.streamThrottleMs,
      securityManager
    );
    registry.register(telegram);
  }

  // CLI Channel
  const cli = new CLIChannel(securityManager);
  registry.register(cli);

  const browserManager = new BrowserManager(config.workspaceDir);
  const contextManager = new ContextManager(config);

  // 5. Pipeline deps
  const deps: HandlerDeps = {
    sessionManager,
    aiClient,
    channelRegistry: registry,
    config,
    browserManager,
    contextManager,
  };
  
  // Gắn event onMessage chung cho tất cả channel
  registry.getAll().forEach((channel) => {
    channel.onMessage = (msg) => handleInbound(msg, deps);
  });

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

  // 7. Command deps (dành riêng cho nền tảng có bot command như telegram)
  const tgChannel = registry.getAll().find(c => c.id === "telegram") as TelegramChannel | undefined;
  if (tgChannel) {
    tgChannel.setCommandDeps({
      sessionManager,
      config,
      aiClient,
      channelRegistry: registry,
      cronManager,
      browserManager,
    });
  }

  // 8. Start channels
  const startPromises = registry.getAll().map(c => c.start());
  await Promise.all(startPromises);
  
  ensureSkillsLoaded().catch(e => console.log("[MCP] Boot background failed:", e));

  const server = await createServer(config.gatewayPort);

  console.log(`[clawbot] model: ${config.model}`);
  console.log(`[clawbot] bash approval: ${config.bashApprovalMode}`);
  console.log(`[clawbot] max context: ${config.maxContextTokens} tokens`);
  if (config.allowedUserIds.length > 0) {
    console.log(`[clawbot] allowlist: ${config.allowedUserIds.join(", ")}`);
  } else if (config.pairingCode) {
    console.log("[clawbot] allowlist: locked (pairing pin active)");
  } else {
    console.log("[clawbot] allowlist: LOCKED HARD (unconfigured)");
  }
  console.log("[clawbot] ready ✓");

  // Start Dreaming Service
  const { startDreamingService } = await import("./ai/dream.js");
  const channelForNotify = registry.get("telegram");
  const adminId = config.allowedUserIds[0];
  const adminNotify = adminId && channelForNotify && channelForNotify.send ? async (msg: string) => {
     await channelForNotify.send!({ channel: "telegram", chatId: adminId, text: msg, isFinal: true });
  } : undefined;
  startDreamingService(config, aiClient, db, adminNotify);

  // 9. Graceful shutdown
  const shutdown = async () => {
    console.log("\n[clawbot] shutting down...");
    cronManager.stopAll();
    
    try { await browserManager.close(); } catch {}
    
    for (const channel of registry.getAll()) {
      await channel.stop();
    }
    
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
