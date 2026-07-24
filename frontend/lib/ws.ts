import type { ClientMessage, ServerMessage } from "@/lib/types";

export type ConnectionState = "connecting" | "connected" | "disconnected";

type SocketOptions = {
  url: string;
  roomId: string;
  onStatus: (state: ConnectionState, retryMs?: number) => void;
  onLatency: (latencyMs: number) => void;
  onMessage?: (message: ServerMessage) => void;
};

const HEARTBEAT_MS = 10_000;
const PING_TIMEOUT_MS = 25_000;
const MAX_RECONNECT_MS = 10_000;

function requestId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function backendWebSocketUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8000/ws";
}

export class GlanceSocket {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private stopped = false;
  private latestRequestId: string | null = null;
  private readonly controlRequests = new Set<string>();
  private readonly pendingPings = new Map<string, number>();

  constructor(private readonly options: SocketOptions) {}

  connect(): void {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.stopped = false;
    this.options.onStatus("connecting");
    const socket = new WebSocket(this.options.url);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.clearReconnect();
      const joinId = requestId("join");
      this.controlRequests.add(joinId);
      this.sendNow({
        type: "join",
        request_id: joinId,
        room_id: this.options.roomId,
        client_id: requestId("client"),
      });
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      this.handleMessage(event.data);
    };

    socket.onerror = () => socket.close();

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.stopHeartbeat();
      this.pendingPings.clear();
      this.controlRequests.clear();
      if (this.stopped) return;

      const retryMs = Math.min(
        1_000 * 2 ** this.reconnectAttempts,
        MAX_RECONNECT_MS,
      );
      this.reconnectAttempts += 1;
      this.options.onStatus("disconnected", retryMs);
      this.clearReconnect();
      this.reconnectTimer = setTimeout(() => this.connect(), retryMs);
    };
  }

  disconnect(): void {
    this.stopped = true;
    this.clearReconnect();
    this.stopHeartbeat();
    this.socket?.close(1000, "Client closed");
    this.socket = null;
  }

  send(message: ClientMessage): boolean {
    if (message.type === "explain_request" || message.type === "follow_up") {
      this.latestRequestId = message.request_id;
    }
    return this.sendNow(message);
  }

  private sendNow(message: ClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private ping(): void {
    const now = performance.now();
    const stalled = [...this.pendingPings.values()].some(
      (startedAt) => now - startedAt > PING_TIMEOUT_MS,
    );
    if (stalled) {
      this.socket?.close(4000, "Heartbeat timeout");
      return;
    }
    const pingId = requestId("ping");
    this.controlRequests.add(pingId);
    this.pendingPings.set(pingId, now);
    this.sendNow({
      type: "ping",
      request_id: pingId,
      room_id: this.options.roomId,
    });
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== "string") return;

    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    if (!message?.request_id || !message.type) return;

    if (message.type === "ack" && message.kind === "joined") {
      this.controlRequests.delete(message.request_id);
      this.reconnectAttempts = 0;
      this.options.onStatus("connected");
      this.startHeartbeat();
    }

    if (message.type === "ack" && message.kind === "pong") {
      const startedAt = this.pendingPings.get(message.request_id);
      if (startedAt !== undefined) {
        this.options.onLatency(performance.now() - startedAt);
        this.pendingPings.delete(message.request_id);
      }
      this.controlRequests.delete(message.request_id);
    }

    const isControlMessage = this.controlRequests.has(message.request_id);
    if (
      !isControlMessage &&
      this.latestRequestId &&
      message.request_id !== this.latestRequestId
    ) {
      return;
    }
    this.options.onMessage?.(message);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.ping();
    this.heartbeatTimer = setInterval(() => this.ping(), HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}
