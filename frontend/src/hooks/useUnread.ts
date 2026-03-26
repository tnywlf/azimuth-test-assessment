import { useCallback, useEffect, useState } from "react";
import { conversationsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Conversation } from "../types";

const STORAGE_KEY = "azimuth_last_read";

/**
 * Read the last-read timestamps from localStorage.
 * Map of conversationId → ISO timestamp string.
 */
function getLastReadMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * Mark a conversation as read (set its last-read to now).
 */
export function markConversationRead(conversationId: string) {
  const map = getLastReadMap();
  map[conversationId] = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * Check if a conversation has unread messages.
 */
export function isConversationUnread(conv: Conversation, myId?: string): boolean {
  if (!conv.last_message) return false;
  // Messages you sent yourself are not "unread"
  if (conv.last_message.sender_id === myId) return false;

  const map = getLastReadMap();
  const lastRead = map[conv.id];
  if (!lastRead) return true; // never opened → unread
  return new Date(conv.last_message.created_at) > new Date(lastRead);
}

/**
 * Hook that provides unread conversation count + refresh.
 * Polls every 30 seconds.
 */
export function useUnreadCount() {
  const { profile, session } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const res = await conversationsApi.list();
      const conversations: Conversation[] = res.data.data || [];
      const count = conversations.filter((c) =>
        isConversationUnread(c, profile?.id)
      ).length;
      setUnreadCount(count);
    } catch {
      // Silently fail
    }
  }, [profile?.id, session]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { unreadCount, refresh };
}
