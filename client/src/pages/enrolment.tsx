import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Trash2, ScanFace, RefreshCcw } from "lucide-react";

type Member = { id: string; firstName: string; lastName: string; email?: string; status: string };
type Device = { id: string; name: string; brand: string; status: string };
type Template = {
  id: string; memberId: string; deviceId?: string; templateType: string;
  externalRef?: string; status: string; syncStatus: string; syncError?: string;
  imagePreviewUrl?: string; enrolledAt: string;
};

export default function EnrolmentPage() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const [memberId, setMemberId] = useState<string>("");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);

  const { data: members = [] } = useQuery<Member[]>({ queryKey: ["/api/members"] });
  const { data: devices = [] } = useQuery<Device[]>({ queryKey: ["/api/devices"] });
  const { data: existingTemplates = [], refetch: refetchTemplates } = useQuery<Template[]>({
    queryKey: ["/api/biometric/templates/by-member", memberId],
    enabled: !!memberId,
  });

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamActive(true);
      }
    } catch (e: any) {
      toast({ title: "Camera unavailable", description: e.message, variant: "destructive" });
    }
  }

  function stopCamera() {
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    setStreamActive(false);
  }

  function captureSnapshot() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setSnapshot(c.toDataURL("image/jpeg", 0.85));
  }

  const enrolMutation = useMutation({
    mutationFn: async () => {
      if (!memberId || !snapshot || selectedDevices.length === 0) {
        throw new Error("Pick a member, capture a photo, and choose at least one device");
      }
      // The captured image acts as the enrolment payload. The on-prem relay
      // (or device-side SDK) is responsible for converting it into a native
      // template; we transport the base64 JPEG as templateData.
      const base64 = snapshot.split(",")[1] ?? snapshot;
      const res = await apiRequest("POST", "/api/biometric/templates", {
        memberId,
        deviceIds: selectedDevices,
        templateType: "face",
        templateData: base64,
        imagePreviewUrl: snapshot,
        consentGiven: consent,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Enrolment queued",
        description: `Pushed to ${data.created.length} device(s). Sync status visible below.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/biometric/templates"] });
      refetchTemplates();
      setSnapshot(null);
    },
    onError: (e: any) => {
      toast({ title: "Enrolment failed", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/biometric/templates/${id}`);
    },
    onSuccess: () => {
      refetchTemplates();
      queryClient.invalidateQueries({ queryKey: ["/api/biometric/templates"] });
      toast({ title: "Template removed" });
    },
  });

  const member = members.find((m) => m.id === memberId);
  const activeDevices = devices.filter((d) => d.status !== "error");

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-enrolment-heading">Biometric Enrolment</h1>
        <p className="text-sm text-muted-foreground">Capture a member's face and push the template to one or more devices</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Pick member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger data-testid="select-enrol-member"><SelectValue placeholder="Search by name..." /></SelectTrigger>
              <SelectContent>
                {members.filter((m) => m.status === "active").map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName} {m.email ? `(${m.email})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {member && (
              <>
                <Label className="pt-2 block">Push to devices</Label>
                <div className="space-y-2 border rounded-md p-2 max-h-48 overflow-auto">
                  {activeDevices.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">No devices configured yet.</p>
                  ) : (
                    activeDevices.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedDevices.includes(d.id)}
                          onCheckedChange={(v) => setSelectedDevices((prev) =>
                            v ? [...prev, d.id] : prev.filter((x) => x !== d.id),
                          )}
                          data-testid={`checkbox-device-${d.id}`}
                        />
                        <span>{d.name}</span>
                        <span className="text-xs text-muted-foreground">({d.brand})</span>
                        <Badge variant={d.status === "online" ? "default" : "secondary"} className="ml-auto text-[10px]">{d.status}</Badge>
                      </label>
                    ))
                  )}
                </div>

                <label className="flex items-start gap-2 text-xs text-muted-foreground pt-2">
                  <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} data-testid="checkbox-consent" />
                  <span>Member has given written consent for biometric data processing (GDPR / data-protection requirement).</span>
                </label>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Capture photo</CardTitle>
            <CardDescription>Look directly at the camera, neutral lighting, no glasses if possible.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center relative">
              {!snapshot ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" data-testid="video-enrol" />
              ) : (
                <img src={snapshot} alt="Captured" className="w-full h-full object-cover" data-testid="img-snapshot" />
              )}
              {!streamActive && !snapshot && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <ScanFace className="h-16 w-16 opacity-30" />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex flex-wrap gap-2">
              {!streamActive && !snapshot && (
                <Button onClick={startCamera} data-testid="button-start-camera"><Camera className="h-4 w-4 mr-2" /> Start camera</Button>
              )}
              {streamActive && !snapshot && (
                <>
                  <Button onClick={captureSnapshot} data-testid="button-capture">Capture</Button>
                  <Button variant="ghost" onClick={stopCamera}>Stop</Button>
                </>
              )}
              {snapshot && (
                <>
                  <Button onClick={() => { setSnapshot(null); startCamera(); }} variant="outline" data-testid="button-retake">
                    <RefreshCcw className="h-4 w-4 mr-2" /> Retake
                  </Button>
                  <Button
                    onClick={() => enrolMutation.mutate()}
                    disabled={!memberId || selectedDevices.length === 0 || !consent || enrolMutation.isPending}
                    data-testid="button-enrol"
                  >
                    {enrolMutation.isPending ? "Enrolling..." : "Enrol member"}
                  </Button>
                </>
              )}
            </div>
            {!consent && snapshot && (
              <p className="text-xs text-amber-600">Consent checkbox required before enrolment.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {member && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Existing enrolments for {member.firstName} {member.lastName}</CardTitle>
          </CardHeader>
          <CardContent>
            {existingTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No biometric templates yet.</p>
            ) : (
              <div className="space-y-2">
                {existingTemplates.map((t) => {
                  const dev = devices.find((d) => d.id === t.deviceId);
                  return (
                    <div key={t.id} className="flex items-center gap-3 border rounded-md p-3" data-testid={`row-template-${t.id}`}>
                      {t.imagePreviewUrl ? (
                        <img src={t.imagePreviewUrl} alt="" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center"><ScanFace className="h-6 w-6 opacity-50" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{dev?.name ?? "Unknown device"}</div>
                        <div className="text-xs text-muted-foreground">
                          Ref {t.externalRef ?? "—"} • {t.templateType} • enrolled {new Date(t.enrolledAt).toLocaleDateString()}
                        </div>
                        {t.syncError && <div className="text-xs text-destructive">{t.syncError}</div>}
                      </div>
                      <Badge variant={
                        t.syncStatus === "pushed" ? "default" :
                        t.syncStatus === "failed" ? "destructive" : "secondary"
                      }>{t.syncStatus}</Badge>
                      <Button size="sm" variant="ghost" className="text-destructive"
                        onClick={() => { if (confirm("Delete this enrolment?")) deleteMutation.mutate(t.id); }}
                        data-testid={`button-delete-template-${t.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
