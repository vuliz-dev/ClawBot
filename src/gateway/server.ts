import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { config } from "../config/env.js";

export async function createServer(port: number) {
  const app = Fastify({ logger: false });

  await app.register(websocket);

  app.get("/health", async () => ({
    ok: true,
    ts: Date.now(),
    service: "clawbot",
  }));

  app.register(async (wsApp) => {
    wsApp.get("/ws", { websocket: true }, (socket, request) => {
      if (config.wsSecret) {
        const token = (request.query as Record<string, string>).token;
        if (token !== config.wsSecret) {
          socket.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
          socket.close();
          return;
        }
      }

      socket.on("message", (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          socket.send(JSON.stringify({ type: "ack", received: msg }));
        } catch {
          socket.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        }
      });
    });
  });

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`[gateway] listening on http://0.0.0.0:${port}`);

  return app;
}
