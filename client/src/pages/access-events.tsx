import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  ScanFace,
  RefreshCcw,
  Wifi,
  WifiOff,
} from "lucide-react";

type AccessEvent = {
  id: string;
  deviceId?: string | null;
  memberId?: string | null;
  externalRef?: string | null;
  eventType: string;
  decision: string;
  reason?: string | null;
  capturedAt: string;
  photoUrl?: string | null;
};

type Device = { id: string; name: string; brand: string };
type Member = { id: string; firstName: string; lastName: string };

const MAX_LIVE_EVENTS = 200;

export default function AccessEventsPage() {
  const [decision, setDecision] = useState<string>("all");
  const [deviceId, setDeviceId] = useState<string>("all");
  const [memberId, setMemberId] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">(
    "connecting",
  );
  const [liveEvents, setLiveEvents] = useState<AccessEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Build the REST query string. The same filters are applied client-side
  // to incoming WS events so the live list stays consistent with the
  // filter chips above it.
  const params = new URLSearchParams();
  if (decision !== "all") params.set("decision", decision);
  if (deviceId !== "all") params.set("deviceId", deviceId);
  if (memberId !== "all") params.set("memberId", memberId);
  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(to).toISOString());
  const qs = params.toString();

  const { data: initialEvents = [], refetch, isFetching } = useQuery<AccessEvent[]>({
    queryKey: ["/api/access-events", qs],
    queryFn: async () => {
      const res = await fetch(`/api/access-events${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load access events");
      return res.json();
    },
  });

  // Reset the live cache whenever the user changes filters: anything that
  // arrives over WS now has to pass the same filter check on the client.
  useEffect(() => {
    setLiveEvents([]);
  }, [decision, deviceId, memberId, from, to]);

  const { data: devices = [] } = useQuery<Device[]>({ queryKey: ["/api/devices"] });
  const { data: members = [] } = useQuery<Member[]>({ queryKey: ["/api/members"] });

  // Connect to the live feed once. We use the page-relative URL so it works
  // behind the Replit dev proxy and in production without env config.
  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/access-events`;
    let cancelled = false;
    let ws: WebSocket;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (cancelled) return;
      setWsStatus("connecting");
      ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setWsStatus("open");
      ws.onclose = () => {
        setWsStatus("closed");
        if (!cancelled) {
          // Backoff reconnect — keeps console clean if the server restarts.
          reconnectTimer = window.setTimeout(connect, 5000);
        }
      };
      ws.onerror = () => {
        try { ws.close(); } catch { /* noop */ }
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === "access_event" && msg.event) {
            setLiveEvents((prev) =>
              [msg.event as AccessEvent, ...prev].slice(0, MAX_LIVE_EVENTS),
            );
          }
        } catch {
          // ignore malformed frames
        }
      };
    };
    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      try { wsRef.current?.close(); } catch { /* noop */ }
    };
  }, []);

  // Merge live + initial. WS events take precedence; dedupe by id.
  const matchesFilters = (e: AccessEvent): boolean => {
    if (decision !== "all" && e.decision !== decision) return false;
    if (deviceId !== "all" && e.deviceId !== deviceId) return false;
    if (memberId !== "all" && e.memberId !== memberId) return false;
    if (from) {
      const fromMs = new Date(from).getTime();
      if (new Date(e.capturedAt).getTime() < fromMs) return false;
    }
    if (to) {
      const toMs = new Date(to).getTime();
      if (new Date(e.capturedAt).getTime() > toMs) return false;
    }
    return true;
  };

  const seen = new Set<string>();
  const events: AccessEvent[] = [];
  for (const e of [...liveEvents, ...initialEvents]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    if (!matchesFilters(e)) continue;
    events.push(e);
  }

  const memberMap = new Map(members.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));
  const deviceMap = new Map(devices.map((d) => [d.id, d.name]));

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-access-events-heading">
            Access Log
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Live feed of every entry attempt across your devices
            <span
              className={`inline-flex items-center gap-1 text-xs ${
                wsStatus === "open"
                  ? "text-green-600 dark:text-green-400"
                  : wsStatus === "connecting"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}
              data-testid="status-ws"
            >
              {wsStatus === "open" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {wsStatus === "open" ? "Live" : wsStatus === "connecting" ? "Connecting…" : "Offline"}
            </span>
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-events"
        >
          <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-6">
          <div className="space-y-1">
            <Label className="text-xs">Decision</Label>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger data-testid="select-filter-decision"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="allow">Allowed</SelectItem>
                <SelectItem value="deny">Denied</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Device</Label>
            <Select value={deviceId} onValueChange={setDeviceId}>
              <SelectTrigger data-testid="select-filter-device"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All devices</SelectItem>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger data-testid="select-filter-member"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All members</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              data-testid="input-filter-from"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              data-testid="input-filter-to"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm" data-testid="text-event-count">
            {events.length} event(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-events">
              <ScanFace className="mx-auto h-12 w-12 opacity-30 mb-3" />
              <p>No access events match these filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((e) => {
                const isAllow = e.decision === "allow";
                const memberName = e.memberId ? memberMap.get(e.memberId) : null;
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 border rounded-md p-3 hover-elevate"
                    data-testid={`row-event-${e.id}`}
                  >
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        isAllow
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {isAllow ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" data-testid={`text-event-subject-${e.id}`}>
                        {memberName ?? (e.externalRef ? `Ref ${e.externalRef}` : "Unknown face")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.deviceId ? deviceMap.get(e.deviceId) ?? "Unknown device" : "—"} • {e.reason ?? e.eventType}
                      </div>
                    </div>
                    <Badge variant={isAllow ? "default" : "destructive"}>{e.eventType}</Badge>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {new Date(e.capturedAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
