import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldOff, Plus, Trash2, Pencil } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type BlockRule = {
  id: string;
  name: string;
  ruleType: string;
  ruleValue: string;
  reason: string;
  isActive: boolean;
  priority: number;
};

const RULE_TYPES = [
  { value: "plan", label: "Membership plan", hint: "Comma-separated plan IDs" },
  { value: "membership_type", label: "Plan cadence", hint: "monthly, quarterly, annual, trial …" },
  { value: "status", label: "Member status", hint: "active, suspended, frozen, cancelled …" },
  { value: "nationality", label: "Nationality", hint: "Comma-separated ISO codes (AE, IN, …)" },
  { value: "day_of_week", label: "Day of week", hint: "0=Sun, 6=Sat. Comma-separated." },
  { value: "time_window", label: "Time window", hint: "HH:MM-HH:MM (server local time)" },
];

type Form = {
  id?: string;
  name: string;
  ruleType: string;
  ruleValue: string;
  reason: string;
  isActive: boolean;
  priority: number;
};

const EMPTY_FORM: Form = {
  name: "",
  ruleType: "membership_type",
  ruleValue: "",
  reason: "Access blocked by gym policy",
  isActive: true,
  priority: 100,
};

export default function AccessBlockRulesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);

  const { data: rules = [], isLoading } = useQuery<BlockRule[]>({
    queryKey: ["/api/biometric/block-rules"],
  });

  const upsert = useMutation({
    mutationFn: async (payload: Form) => {
      if (payload.id) {
        return apiRequest("PATCH", `/api/biometric/block-rules/${payload.id}`, payload);
      }
      return apiRequest("POST", "/api/biometric/block-rules", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biometric/block-rules"] });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Rule saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async (rule: BlockRule) =>
      apiRequest("PATCH", `/api/biometric/block-rules/${rule.id}`, { isActive: !rule.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/biometric/block-rules"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/biometric/block-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biometric/block-rules"] });
      toast({ title: "Rule deleted" });
    },
  });

  const startEdit = (rule: BlockRule) => {
    setForm({
      id: rule.id,
      name: rule.name,
      ruleType: rule.ruleType,
      ruleValue: rule.ruleValue,
      reason: rule.reason,
      isActive: rule.isActive,
      priority: rule.priority,
    });
    setDialogOpen(true);
  };

  const startCreate = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.ruleValue.trim()) {
      toast({ title: "Fill name + value", variant: "destructive" });
      return;
    }
    upsert.mutate(form);
  };

  const activeType = RULE_TYPES.find((t) => t.value === form.ruleType);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-block-rules-heading">
            Custom Access Rules
          </h1>
          <p className="text-sm text-muted-foreground">
            Block entries that match your own policies (in addition to built-in rules
            for unpaid invoices, expired memberships, and suspensions).
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={startCreate} data-testid="button-create-rule">
              <Plus className="h-4 w-4 mr-1" /> New rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit rule" : "New block rule"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Block trial members on weekends"
                  data-testid="input-rule-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Rule type</Label>
                  <Select
                    value={form.ruleType}
                    onValueChange={(v) => setForm({ ...form, ruleType: v })}
                  >
                    <SelectTrigger data-testid="select-rule-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RULE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 100 })}
                    data-testid="input-rule-priority"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Match value</Label>
                <Input
                  value={form.ruleValue}
                  onChange={(e) => setForm({ ...form, ruleValue: e.target.value })}
                  placeholder={activeType?.hint}
                  data-testid="input-rule-value"
                />
                <p className="text-xs text-muted-foreground">{activeType?.hint}</p>
              </div>
              <div className="space-y-1">
                <Label>Reason shown to staff</Label>
                <Textarea
                  rows={2}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  data-testid="input-rule-reason"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                    data-testid="switch-rule-active"
                  />
                  Active
                </Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={upsert.isPending} data-testid="button-save-rule">
                  {upsert.isPending ? "Saving…" : "Save rule"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{rules.length} rule(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : rules.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground" data-testid="text-no-rules">
              <ShieldOff className="mx-auto h-12 w-12 opacity-30 mb-3" />
              <p>No custom block rules yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => {
                const t = RULE_TYPES.find((x) => x.value === rule.ruleType);
                return (
                  <div
                    key={rule.id}
                    className="flex items-center gap-3 border rounded-md p-3 hover-elevate"
                    data-testid={`row-rule-${rule.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {rule.name}
                        <Badge variant="outline">{t?.label ?? rule.ruleType}</Badge>
                        {!rule.isActive && <Badge variant="secondary">paused</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        Match: {rule.ruleValue} · Reason: {rule.reason}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      Priority {rule.priority}
                    </div>
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={() => toggleActive.mutate(rule)}
                      data-testid={`switch-active-${rule.id}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => startEdit(rule)} data-testid={`button-edit-${rule.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete rule "${rule.name}"?`)) remove.mutate(rule.id);
                      }}
                      data-testid={`button-delete-${rule.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
