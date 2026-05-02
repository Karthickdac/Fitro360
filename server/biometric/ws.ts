import type { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { AccessEvent } from "@shared/schema";

// Per-connection state. We hold the connection open until the client
// disconnects; broadcasts are filtered by tenantId so a tenant can never
// see another tenant's events.
type Conn = {
  ws: WebSocket;
  tenantId: string;
  userId: string;
  role: string;
  isAlive: boolean;
};

const conns = new Set<Conn>();
let wss: WebSocketServer | null = null;

// Heartbeat interval — clients that don't respond to ping in 60s get killed.
// Keeps the connection set free of zombie sockets behind broken NATs/proxies.
const HEARTBEAT_MS = 30_000;

export type AuthLookup = (req: IncomingMessage) => Promise<{
  userId: string;
  tenantId: string;
  role: string;
} | null>;

export function setupAccessEventsWs(httpServer: HttpServer, authLookup: AuthLookup) {
  wss = new WebSocketServer({ noServer: true });

  // We mount manually on `upgrade` so we can authenticate the cookie BEFORE
  // accepting the websocket. Express middleware doesn't run on upgrade
  // requests, so we re-resolve the session here using the same Connect
  // session store the rest of the app uses.
  httpServer.on("upgrade", async (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/ws/access-events")) return;
    try {
      const auth = await authLookup(req);
      if (!auth || !auth.tenantId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      // Only owner+manager may receive the live tenant-wide feed. Members
      // get their own entries via the REST endpoint.
      if (!["gym_owner", "manager"].includes(auth.role)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      wss!.handleUpgrade(req, socket, head, (ws) => {
        const conn: Conn = {
          ws,
          tenantId: auth.tenantId,
          userId: auth.userId,
          role: auth.role,
          isAlive: true,
        };
        conns.add(conn);
        ws.on("pong", () => { conn.isAlive = true; });
        ws.on("close", () => { conns.delete(conn); });
        ws.on("error", () => { try { ws.close(); } catch {} });
        try {
          ws.send(JSON.stringify({ type: "hello", tenantId: auth.tenantId }));
        } catch {
          // socket may have died between handshake and send
        }
      });
    } catch {
      try { socket.destroy(); } catch {}
    }
  });

  // Periodic heartbeat. Devices on flaky 3G/4G links love to half-close.
  setInterval(() => {
    for (const c of Array.from(conns)) {
      if (!c.isAlive) {
        try { c.ws.terminate(); } catch {}
        conns.delete(c);
        continue;
      }
      c.isAlive = false;
      try { c.ws.ping(); } catch {}
    }
  }, HEARTBEAT_MS);
}

// Strip biometric-sensitive fields before broadcasting so the live feed
// matches the REST list-view shape exactly. We never want raw payloads or
// face crops on the wire to a browser.
function publicEvent(e: AccessEvent) {
  const { rawPayload, photoUrl, ...safe } = e;
  return safe;
}

export function broadcastAccessEvent(event: AccessEvent) {
  if (!wss) return;
  const payload = JSON.stringify({ type: "access_event", event: publicEvent(event) });
  for (const c of Array.from(conns)) {
    if (c.tenantId !== event.tenantId) continue;
    if (c.ws.readyState !== WebSocket.OPEN) continue;
    try { c.ws.send(payload); } catch {}
  }
}

export function broadcastDeviceStatus(tenantId: string, deviceId: string, status: string) {
  if (!wss) return;
  const payload = JSON.stringify({ type: "device_status", deviceId, status });
  for (const c of Array.from(conns)) {
    if (c.tenantId !== tenantId) continue;
    if (c.ws.readyState !== WebSocket.OPEN) continue;
    try { c.ws.send(payload); } catch {}
  }
}
