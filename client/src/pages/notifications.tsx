import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Bell,
  Send,
  CreditCard,
  CalendarDays,
  Package,
  Megaphone,
  Circle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@shared/schema";

const notificationFormSchema = z.object({
  type: z.string().min(1, "Type is required"),
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  channel: z.string().default("in_app"),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

const typeConfig: Record<string, { label: string; icon: typeof Bell; badgeClass: string; iconBg: string }> = {
  membership_expiry: { label: "Membership Expiry", icon: CreditCard, badgeClass: "bg-amber-100 text-amber-700 border-amber-200", iconBg: "bg-amber-100 text-amber-600" },
  session_reminder: { label: "Session Reminder", icon: CalendarDays, badgeClass: "bg-blue-100 text-blue-700 border-blue-200", iconBg: "bg-blue-100 text-blue-600" },
  stock_alert: { label: "Stock Alert", icon: Package, badgeClass: "bg-red-100 text-red-700 border-red-200", iconBg: "bg-red-100 text-red-600" },
  broadcast: { label: "Broadcast", icon: Megaphone, badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200", iconBg: "bg-emerald-100 text-emerald-600" },
};

function getTypeIcon(type: string) {
  const config = typeConfig[type];
  if (config) {
    const Icon = config.icon;
    return <Icon className="h-4 w-4" />;
  }
  return <Bell className="h-4 w-4" />;
}

const tabFilters = [
  { value: "all", label: "All" },
  { value: "membership_expiry", label: "Membership Expiry" },
  { value: "session_reminder", label: "Session Reminders" },
  { value: "stock_alert", label: "Stock Alerts" },
  { value: "broadcast", label: "Broadcasts" },
];

export default function NotificationsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const isMember = user?.role === "member";
  const [activeTab, setActiveTab] = useState("all");

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: {
      type: "",
      title: "",
      message: "",
      channel: "in_app",
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (data: NotificationFormValues) => {
      const res = await apiRequest("POST", "/api/notifications", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Notification sent successfully" });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send notification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  const filteredNotifications = (notifications || []).filter((n) => {
    if (activeTab === "all") return true;
    return n.type === activeTab;
  });

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-notifications">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground mt-1">
              Stay updated with alerts and messages
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" data-testid="badge-unread-count">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        {!isMember && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-send-notification">
              <Send className="h-4 w-4 mr-2" />
              Send Notification
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send Notification</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((d) => sendMutation.mutate(d))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-notification-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="membership_expiry">Membership Expiry</SelectItem>
                          <SelectItem value="session_reminder">Session Reminder</SelectItem>
                          <SelectItem value="stock_alert">Stock Alert</SelectItem>
                          <SelectItem value="broadcast">Broadcast</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Notification title"
                          {...field}
                          data-testid="input-notification-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Notification message..."
                          className="resize-none"
                          {...field}
                          data-testid="input-notification-message"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="channel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-notification-channel">
                            <SelectValue placeholder="Select channel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="in_app">In-App</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={sendMutation.isPending}
                  data-testid="button-submit-notification"
                >
                  {sendMutation.isPending ? "Sending..." : "Send Notification"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-notification-filter">
          {tabFilters.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              data-testid={`tab-${tab.value}`}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <Skeleton className="h-9 w-9 rounded-md shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No notifications</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                {activeTab === "all"
                  ? "You're all caught up"
                  : `No ${tabFilters.find((t) => t.value === activeTab)?.label?.toLowerCase() || ""} notifications`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`cursor-pointer hover-elevate ${!notification.isRead ? "border-primary/30" : ""}`}
                  onClick={() => handleNotificationClick(notification)}
                  data-testid={`card-notification-${notification.id}`}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                        typeConfig[notification.type]?.iconBg || (!notification.isRead ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
                      }`}
                    >
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`text-sm ${!notification.isRead ? "font-semibold" : "font-medium"}`}
                          data-testid={`text-notification-title-${notification.id}`}
                        >
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <Circle
                            className="h-2 w-2 fill-primary text-primary shrink-0"
                            data-testid={`indicator-unread-${notification.id}`}
                          />
                        )}
                      </div>
                      <p
                        className="text-sm text-muted-foreground line-clamp-2"
                        data-testid={`text-notification-message-${notification.id}`}
                      >
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs text-muted-foreground"
                          data-testid={`text-notification-time-${notification.id}`}
                        >
                          {notification.createdAt
                            ? formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                              })
                            : ""}
                        </span>
                        <Badge variant="outline" className={`text-xs ${typeConfig[notification.type]?.badgeClass || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                          {typeConfig[notification.type]?.label || notification.type}
                        </Badge>
                        {notification.channel && notification.channel !== "in_app" && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {notification.channel}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
