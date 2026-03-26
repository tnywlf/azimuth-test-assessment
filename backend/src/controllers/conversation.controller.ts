import { Response } from "express";
import { supabase } from "../config/supabase";
import { AuthRequest } from "../types";
import { emitToConversation } from "../config/socket";
import { notifyConversationParticipants } from "../services/notification.service";
import { upsertConversationEmbedding } from "../services/embedding.service";

/**
 * GET /api/conversations
 * List the current user's conversations with last message and participants.
 */
export const getConversations = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get conversation IDs the user participates in
    const { data: participations, error: pError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    if (pError) {
      res.status(500).json({ error: "Failed to fetch conversations" });
      return;
    }

    const conversationIds = participations?.map((p) => p.conversation_id) || [];
    if (conversationIds.length === 0) {
      res.json({ data: [] });
      return;
    }

    // Fetch conversations with participants
    const { data: conversations, error } = await supabase
      .from("conversations")
      .select(
        `*,
        conversation_participants(
          user_id,
          user:user_id(id, full_name, email, role)
        )`
      )
      .in("id", conversationIds)
      .order("updated_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
      return;
    }

    // Fetch last message for each conversation
    const result = [];
    for (const conv of conversations || []) {
      const { data: messages } = await supabase
        .from("messages")
        .select("*, sender:sender_id(id, full_name, role)")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

      result.push({
        ...conv,
        participants: (conv as any).conversation_participants,
        last_message: messages?.[0] || null,
      });
    }

    res.json({ data: result });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /api/conversations
 * Create a new conversation with specified participants.
 * Body: { participantIds: string[], title?: string }
 */
export const createConversation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { participantIds, title } = req.body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      res.status(400).json({ error: "participantIds array is required" });
      return;
    }

    // Ensure current user is included
    const allParticipants = [...new Set([userId, ...participantIds])];

    // Create conversation
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .insert({ title: title || null })
      .select()
      .single();

    if (convError || !conversation) {
      res.status(500).json({ error: "Failed to create conversation" });
      return;
    }

    // Add participants
    const participantInserts = allParticipants.map((uid) => ({
      conversation_id: conversation.id,
      user_id: uid,
    }));

    const { error: partError } = await supabase
      .from("conversation_participants")
      .insert(participantInserts);

    if (partError) {
      // Cleanup
      await supabase.from("conversations").delete().eq("id", conversation.id);
      res.status(500).json({ error: "Failed to add participants" });
      return;
    }

    // Return conversation with participants
    const { data: result } = await supabase
      .from("conversations")
      .select(
        `*,
        conversation_participants(
          user_id,
          user:user_id(id, full_name, email, role)
        )`
      )
      .eq("id", conversation.id)
      .single();

    // Notify other participants about the new conversation
    const otherParticipants = allParticipants.filter((uid) => uid !== userId);
    for (const uid of otherParticipants) {
      await notifyConversationParticipants(
        conversation.id,
        userId,
        "new_message",
        "New Conversation",
        `${req.user!.full_name} started a conversation with you`,
        { conversation_id: conversation.id }
      );
    }

    res.status(201).json({
      data: {
        ...result,
        participants: (result as any)?.conversation_participants,
      },
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * GET /api/conversations/:id
 * Get a conversation with all messages and participants.
 */
export const getConversationById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Verify user is participant
    const { data: participant } = await supabase
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", id)
      .eq("user_id", userId)
      .single();

    if (!participant) {
      res.status(403).json({ error: "Not a participant in this conversation" });
      return;
    }

    // Fetch conversation with participants
    const { data: conversation, error } = await supabase
      .from("conversations")
      .select(
        `*,
        conversation_participants(
          user_id,
          user:user_id(id, full_name, email, role)
        )`
      )
      .eq("id", id)
      .single();

    if (error || !conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Fetch all messages
    const { data: messages } = await supabase
      .from("messages")
      .select("*, sender:sender_id(id, full_name, email, role)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    res.json({
      data: {
        ...conversation,
        participants: (conversation as any).conversation_participants,
        messages: messages || [],
      },
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /api/conversations/:id/messages
 * Send a message in a conversation.
 * Body: { content: string }
 */
export const sendMessage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const user = req.user!;
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }

    // Verify user is participant
    const { data: participant } = await supabase
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", id)
      .eq("user_id", userId)
      .single();

    if (!participant) {
      res.status(403).json({ error: "Not a participant in this conversation" });
      return;
    }

    // Insert message
    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: userId,
        content: content.trim(),
      })
      .select("*, sender:sender_id(id, full_name, email, role)")
      .single();

    if (error) {
      res.status(500).json({ error: "Failed to send message" });
      return;
    }

    // Update conversation's updated_at timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    // ─── Socket.IO: Broadcast the new message to the conversation room ───
    emitToConversation(id, "message:new", message);

    // ─── Push Notification: Notify other participants ───
    notifyConversationParticipants(
      id,
      userId,
      "new_message",
      `Message from ${user.full_name}`,
      content.trim().slice(0, 100),
      { conversation_id: id, message_id: message.id }
    ).catch((err) =>
      console.error("[NOTIFY] Error sending message notifications:", err)
    );

    // ─── Vector Embedding: Update conversation embedding (async, non-blocking) ───
    (async () => {
      try {
        const { data: allMessages } = await supabase
          .from("messages")
          .select("*, sender:sender_id(id, full_name, email, role)")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });

        if (allMessages && allMessages.length > 0) {
          await upsertConversationEmbedding(id, allMessages);
        }
      } catch (err: any) {
        console.error("[EMBEDDING] Background embedding update error:", err.message);
      }
    })();

    res.status(201).json({ data: message });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};
