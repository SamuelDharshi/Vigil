import { WebSocketServer, WebSocket } from "ws";
import * as dotenv from "dotenv";
import * as path from "path";
import {
  startEventListeners,
  setBroadcastFunction,
  getRecentLedgerEntries,
  getAgentStats,
} from "./listeners";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const WS_PORT = parseInt(process.env.WS_PORT || "8080");

/**
 * VIGIL Indexer — WebSocket Server
 * Broadcasts real-time VIGILLedger events to all connected War Room clients.
 *
 * Message types sent to clients:
 * - LEDGER_ENTRY   — New decision logged on-chain (with all details)
 * - AGENT_STATS    — Updated reputation score and decision counts
 * - HEARTBEAT      — Sent every 30s to keep connections alive
 *
 * Clients receive the full history on connect (last 50 entries).
 */

const clients = new Set<WebSocket>();

function broadcast(event: object): void {
  const message = JSON.stringify(event);
  let dead = 0;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    } else {
      clients.delete(client);
      dead++;
    }
  }

  if (dead > 0) {
    console.log(`[WS] Cleaned ${dead} dead connections. Active: ${clients.size}`);
  }
}

async function startWebSocketServer(): Promise<void> {
  const wss = new WebSocketServer({ port: WS_PORT });

  console.log(`[WS] WebSocket server started on ws://localhost:${WS_PORT}`);

  // Register broadcast function with the event listener
  setBroadcastFunction(broadcast);

  wss.on("connection", async (ws: WebSocket, req: any) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] Client connected: ${ip} (total: ${clients.size + 1})`);
    clients.add(ws);

    // Send historical data on connect (last 50 entries)
    try {
      const [recentEntries, agentStats] = await Promise.all([
        getRecentLedgerEntries(50),
        getAgentStats(),
      ]);

      ws.send(JSON.stringify({
        type: "INITIAL_STATE",
        entries: recentEntries,
        agentStats,
        serverTime: Date.now(),
      }));
    } catch (err) {
      console.error("[WS] Failed to send initial state:", err);
    }

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected: ${ip} (remaining: ${clients.size})`);
    });

    ws.on("error", (err) => {
      console.error(`[WS] Client error (${ip}):`, err.message);
      clients.delete(ws);
    });

    // Handle client messages (e.g., requesting specific data)
    ws.on("message", async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "GET_RECENT") {
          const entries = await getRecentLedgerEntries(msg.limit || 20);
          ws.send(JSON.stringify({ type: "RECENT_ENTRIES", entries }));
        }

        if (msg.type === "GET_STATS") {
          const stats = await getAgentStats();
          ws.send(JSON.stringify({ type: "AGENT_STATS", stats }));
        }
      } catch {
        // Ignore malformed messages
      }
    });
  });

  // Send heartbeat every 30 seconds to keep connections alive
  setInterval(() => {
    if (clients.size > 0) {
      broadcast({
        type: "HEARTBEAT",
        timestamp: Date.now(),
        activeClients: clients.size,
      });
    }
  }, 30_000);

  wss.on("error", (err) => {
    console.error("[WS] Server error:", err);
  });
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  VIGIL Indexer — Starting");
  console.log("═══════════════════════════════════════\n");

  // Start blockchain event listeners
  await startEventListeners();

  // Start WebSocket server
  await startWebSocketServer();

  console.log("\n[Indexer] ✅ All services running");
  console.log("[Indexer]   WebSocket:  ws://localhost:" + WS_PORT);
  console.log("[Indexer]   Events:     VIGILLedger on Mantle Sepolia\n");
}

main().catch(console.error);
