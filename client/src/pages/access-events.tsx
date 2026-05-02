import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, ScanFace, RefreshCcw } from "lucide-react";

type AccessEvent = {
  id: string;
  deviceId?: string;
  memberId?: string;
  externalRef?: string;
  eventType: string;
  decision: string;
  reason?: string;
  capturedAt: string;
  photoUrl?: string;
};

type Device = { id: string; name: string; brand: string };
type Member = { id: string; firstName: string; lastName: string };

export default function AccessEventsPage() {
  const [decision, setDecision] = useState<string>("all");
  const [deviceId, setDeviceId] = useState<string>("all");

  const params = new URLSearchParams();
  if (decision !== "all") params.set("decision", decision);
  if (deviceId !== "all") params.set("deviceId", deviceId);
  const qs = params.toString();

  const { data: events = [], refetch, isFetching } = useQuery<AccessEvent[]>({
    queryKey: ["/api/access-events", qs],
    queryFn: async () => {
      const res = await fetch(`/api/access-events${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: devices = [] } = useQuery<Device[]>({ queryKey: ["/api/devices"] });
  const { data: members = [] } = useQuery<Member[]>({ queryKey: ["/api/members"] });

  const memberMap = new Map(members.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));
  const deviceMap = new Map(devices.map((d) => [d.id, d.name]));

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-access-events-heading">Access Log</h1>
          <p className="text-sm text-muted-foreground">Live feed of every entry attempt across your devices (auto-refreshes every 5s)</p>
        </div>
        <div className="flex gap-2">
          <Select value={decision} onValueChange={setDecision}>
            <SelectTrigger className="w-36" data-testid="select-filter-decision"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All decisions</SelectItem>
              <SelectItem value="allow">Allowed</SelectItem>
              <SelectItem value="deny">Denied</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deviceId} onValueChange={setDeviceId}>
            <SelectTrigger className="w-44" data-testid="select-filter-device"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All devices</SelectItem>
              {devices.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-events">
            <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{events.length} event(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScanFace className="mx-auto h-12 w-12 opacity-30 mb-3" />
              <p>No access events yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((e) => {
                const isAllow = e.decision === "allow";
                const memberName = e.memberId ? memberMap.get(e.memberId) : null;
                return (
                  <div key={e.id} className="flex items-center gap-3 border rounded-md p-3 hover-elevate"
                    data-testid={`row-event-${e.id}`}
                  >
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center ${isAllow ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                      {isAllow ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
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
