import { supabase } from "../config/supabase";
import { emitToUser } from "../config/socket";
import { NotificationType } from "../types";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Create a notification and push it via WebSocket.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  const { userId, type, title, body, data } = params;

  try {
    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        type,
        title,
        body,
        data: data || {},
        read: false,
      })
      .select()
      .single();

    if (error) {
      console.error("[NOTIFICATION] Insert error:", error.message);
      return;
    }

    // Push via WebSocket in real-time
    emitToUser(userId, "notification:new", notification);
    console.log(
      `[NOTIFICATION] Sent to ${userId}: ${type} — ${title}`
    );
  } catch (err: any) {
    console.error("[NOTIFICATION] Error:", err.message);
  }
}

/**
 * Create notifications for multiple users (e.g., all conversation participants).
 */
export async function notifyUsers(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  for (const userId of userIds) {
    await createNotification({ userId, type, title, body, data });
  }
}

/**
 * Notify all participants in a conversation (except the sender).
 */
export async function notifyConversationParticipants(
  conversationId: string,
  senderId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", senderId);

    if (!participants || participants.length === 0) return;

    const userIds = participants.map((p) => p.user_id);
    await notifyUsers(userIds, type, title, body, {
      ...data,
      conversation_id: conversationId,
    });
  } catch (err: any) {
    console.error("[NOTIFICATION] Conversation notify error:", err.message);
  }
}
