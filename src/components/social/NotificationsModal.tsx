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
      <DialogContent className="sm:max-w-lg border border-border bg-card p-5 max-h-[85vh] flex flex-col rounded-2xl shadow-xl">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border">
          <DialogTitle className="font-display text-xl flex items-center gap-2 text-foreground">
            <Bell className="h-5 w-5 text-[#E91E63]" />
            Notifications
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#E91E63] px-2 py-0.5 text-[11px] text-white font-sans font-semibold">
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
              className="text-xs text-[#E91E63] hover:bg-secondary"
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
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all shrink-0 ${
                filter === tab.id
                  ? "bg-[#E91E63] text-white shadow-sm"
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
              <Bell className="h-10 w-10 text-muted-foreground/60 mx-auto" />
              <p className="font-semibold text-foreground text-sm">All caught up</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                When members interact with your posts or profile, notifications will show here.
              </p>
            </div>
          ) : (
            filteredNotifs.map((n) => {
              const Icon = getNotificationIcon(n.type);
              return (
                <div
                  key={n.id}
                  onClick={() => handleRead(n.id)}
                  className={`flex items-start gap-3 rounded-xl p-3 transition-colors cursor-pointer border ${
                    !n.isRead
                      ? "bg-secondary/60 border-border ring-1 ring-[#E91E63]/30"
                      : "bg-card border-transparent hover:bg-secondary/40"
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
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-1 ring-border text-[#E91E63]">
                      <Icon className="h-3 w-3" />
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">
                      <strong className="font-semibold text-foreground">{n.actorName}</strong>{" "}
                      {n.summary}
                    </p>
                    <span className="mt-1 block text-[0.65rem] text-muted-foreground">
                      {formatTime(n.createdAt)}
                    </span>
                  </div>

                  {!n.isRead && (
                    <span className="h-2 w-2 rounded-full bg-[#E91E63] mt-1.5 shrink-0" />
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
