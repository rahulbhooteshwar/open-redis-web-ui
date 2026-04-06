import { createServer } from "http";
import next from "next";
import { parse } from "url";
import { WebSocketServer } from "ws";
import { wsHandler } from "./src/lib/server/ws-handler";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "2604", 10);

const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  // Attach WebSocket server to the same HTTP server
  const wss = new WebSocketServer({ noServer: true });
  wsHandler(wss);

  const nextUpgradeHandler = app.getUpgradeHandler();

  server.on("upgrade", (req, socket, head) => {
    const pathname = parse(req.url || "/").pathname;
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      // Forward HMR and other Next.js WebSocket upgrades
      nextUpgradeHandler(req, socket, head);
    }
  });

  server.listen(port, () => {
    console.log(`> Open Redis Web UI ready on http://localhost:${port}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("Received SIGTERM — shutting down...");
    server.close(() => {
      import("./src/lib/server/redis-pool").then(({ redisPool }) => {
        redisPool.disconnectAll().finally(() => process.exit(0));
      });
    });
  });
});
