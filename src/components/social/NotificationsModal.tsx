import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  Sparkles,
  UserPlus,
  Users,
  Repeat,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/profile/UserAvatar";
import {
  getStoredNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type SocialNotification,
} from "@/services/social";

export function NotificationsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [filter, setFilter] = useState<"all" | "unread" | "reactions" | "friends">("all");
  const [notifications, setNotifications] = useState<SocialNotification[]>(() =>
    getStoredNotifications(),
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifs = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "reactions") return n.type === "reaction" || n.type === "comment";
    if (filter === "friends")
      return n.type === "friend_request" || n.type === "friend_accept" || n.type === "follow";
    return true;
  });

  function handleMarkAll() {
    markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  function handleRead(id: string) {
    markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass border-border/80 p-5 max-h-[85vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border/60">
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <span className="rounded-full bg-gradient-rose px-2 py-0.5 text-xs text-primary-foreground font-sans font-semibold">
                {unreadCount} new
              </span>
            )}
          </DialogTitle>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              className="text-xs text-rose-soft hover:bg-secondary"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
            </Button>
          )}
        </DialogHeader>

        {/* Filter Pills */}
        <div className="flex gap-1.5 py-2 overflow-x-auto">
          {(
            [
              { id: "all", label: "All" },
              { id: "unread", label: `Unread (${unreadCount})` },
              { id: "reactions", label: "Activity" },
              { id: "friends", label: "Connections" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all shrink-0 ${
                filter === tab.id
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
          {filteredNotifs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <span className="text-4xl">🌹</span>
              <p className="font-semibold text-foreground">All caught up in the garden</p>
              <p className="text-xs text-muted-foreground">
                When fellow gardeners interact with your posts or profile, you'll see them here.
              </p>
            </div>
          ) : (
            filteredNotifs.map((n) => {
              const Icon = getNotificationIcon(n.type);
              return (
                <div
                  key={n.id}
                  onClick={() => handleRead(n.id)}
                  className={`flex items-start gap-3 rounded-2xl p-3 transition-colors cursor-pointer ${
                    !n.isRead ? "bg-secondary/70 ring-1 ring-primary/30" : "hover:bg-secondary/40"
                  }`}
                >
                  <div className="relative shrink-0">
                    <UserAvatar
                      profile={{
                        avatar_url: n.actorAvatarUrl,
                        username: n.actorUsername,
                        display_name: n.actorName,
                      }}
                      className="h-10 w-10 text-xs"
                    />
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-1 ring-border text-primary">
                      <Icon className="h-3 w-3" />
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">
                      <strong className="font-semibold text-rose-soft">{n.actorName}</strong>{" "}
                      {n.summary}
                    </p>
                    <span className="mt-1 block text-[0.65rem] text-muted-foreground">
                      {formatTime(n.createdAt)}
                    </span>
                  </div>

                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-primary shadow-glow mt-1.5 shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getNotificationIcon(type: SocialNotification["type"]) {
  switch (type) {
    case "reaction":
      return Heart;
    case "comment":
    case "reply":
      return MessageCircle;
    case "friend_request":
    case "friend_accept":
      return Users;
    case "follow":
      return UserPlus;
    case "points":
      return Sparkles;
    default:
      return Bell;
  }
}

function formatTime(iso: string) {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
