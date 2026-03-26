import { Response } from "express";
import { supabase } from "../config/supabase";
import { AuthRequest } from "../types";

/**
 * GET /api/notifications
 * List notifications for the current user (newest first).
 */
export const getNotifications = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
      return;
    }

    // Also return unread count
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    res.json({
      data: {
        notifications: data || [],
        unread_count: count || 0,
      },
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read.
 */
export const markRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
      return;
    }

    res.json({ message: "Notification marked as read" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read for the current user.
 */
export const markAllRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) {
      res.status(500).json({ error: "Failed to mark all notifications as read" });
      return;
    }

    res.json({ message: "All notifications marked as read" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a single notification.
 */
export const deleteNotification = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      res.status(500).json({ error: "Failed to delete notification" });
      return;
    }

    res.json({ message: "Notification deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};
