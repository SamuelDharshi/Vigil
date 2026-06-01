/**
 * VIGIL WebSocket Client
 * Singleton WebSocket connection that auto-reconnects.
 * Dispatches events to registered handlers.
 */

type WsEventType = "LEDGER_ENTRY" | "AGENT_STATS" | "INITIAL_STATE" | "HEARTBEAT" | "RECENT_ENTRIES";

interface WsMessage {
  type: WsEventType;
  [key: string]: any;
}

type MessageHandler = (msg: WsMessage) => void;

class VIGILWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<WsEventType, MessageHandler[]> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private url: string;
  private isConnecting = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;

    this.isConnecting = true;
    console.log(`[WS] Connecting to ${this.url}...`);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("[WS] Connected ✅");
        this.isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          const handlers = this.handlers.get(msg.type) || [];
          handlers.forEach(h => h(msg));
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        console.log("[WS] Disconnected — reconnecting in 3s...");
        this.isConnecting = false;
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
      };
    } catch {
      this.isConnecting = false;
    }
  }

  on(type: WsEventType, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    };
  }

  send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

// Singleton instance
let wsInstance: VIGILWebSocket | null = null;

export function getWebSocket(): VIGILWebSocket {
  if (!wsInstance) {
    const url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";
    wsInstance = new VIGILWebSocket(url);
  }
  return wsInstance;
}

export type { WsMessage, WsEventType };
