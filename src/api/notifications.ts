import { api } from "./client";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body?: string | null;
  url?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  createdAt: string;
  readAt?: string | null;
};

export type NotificationInbox = {
  items: NotificationItem[];
  unread: number;
};

export async function fetchNotificationInbox() {
  return api<NotificationInbox>("/notifications/me");
}

export async function fetchUnreadCount() {
  const raw = await api<{ unread: number }>("/notifications/unread-count");
  return raw.unread ?? 0;
}

export async function markNotificationRead(id: string) {
  await api(`/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead() {
  await api("/notifications/read-all", { method: "POST" });
}
