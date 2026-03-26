import { Response } from "express";
import { supabase } from "../config/supabase";
import { AuthRequest } from "../types";
import {
  summarizeConversation,
  generateSmartReplies,
  detectIssues,
  generateDashboardInsights,
} from "../services/ai.service";
import { searchSimilarConversations } from "../services/embedding.service";

/**
 * Fetch messages for a conversation (with authorization check).
 */
async function getConversationMessages(conversationId: string, userId: string) {
  // Verify user is participant
  const { data: participant } = await supabase
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .single();

  if (!participant) return null;

  const { data: messages } = await supabase
    .from("messages")
    .select("*, sender:sender_id(id, full_name, email, role)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return messages || [];
}

/**
 * POST /api/ai/summarize/:conversationId
 * Generate an AI summary of a conversation (enhanced with vector context).
 */
export const summarize = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    const messages = await getConversationMessages(conversationId, userId);
    if (messages === null) {
      res.status(403).json({ error: "Not a participant in this conversation" });
      return;
    }

    const summary = await summarizeConversation(messages, userId);

    // Store the summary
    await supabase.from("ai_summaries").insert({
      conversation_id: conversationId,
      summary,
    });

    res.json({ data: { summary } });
  } catch (err) {
    console.error("AI summarize error:", err);
    res.status(500).json({ error: "Failed to generate summary" });
  }
};

/**
 * POST /api/ai/smart-replies/:conversationId
 * Generate smart reply suggestions (enhanced with vector context).
 */
export const smartReplies = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;
    const { conversationId } = req.params;

    const messages = await getConversationMessages(conversationId, user.id);
    if (messages === null) {
      res.status(403).json({ error: "Not a participant in this conversation" });
      return;
    }

    const replies = await generateSmartReplies(
      messages,
      user.full_name,
      user.role,
      user.id
    );

    res.json({ data: { replies } });
  } catch (err) {
    console.error("AI smart-replies error:", err);
    res.status(500).json({ error: "Failed to generate replies" });
  }
};

/**
 * POST /api/ai/detect-issues/:conversationId
 * Detect potential issues in a conversation.
 */
export const issueDetection = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    const messages = await getConversationMessages(conversationId, userId);
    if (messages === null) {
      res.status(403).json({ error: "Not a participant in this conversation" });
      return;
    }

    const result = await detectIssues(messages);

    res.json({ data: result });
  } catch (err) {
    console.error("AI detect-issues error:", err);
    res.status(500).json({ error: "Failed to detect issues" });
  }
};

/**
 * GET /api/ai/insights
 * Generate dashboard insights across the user's conversations.
 */
export const dashboardInsights = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get user's conversations
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    const conversationIds =
      participations?.map((p) => p.conversation_id) || [];

    if (conversationIds.length === 0) {
      res.json({
        data: {
          total_issues: 0,
          high_priority: 0,
          overall_sentiment: "neutral",
          key_findings: ["No conversations to analyze."],
          recommendations: ["Start communicating to generate AI insights."],
        },
      });
      return;
    }

    // Fetch messages for each conversation (limit to recent 5 conversations)
    const recentConvIds = conversationIds.slice(0, 5);
    const allMessages = [];

    for (const convId of recentConvIds) {
      const { data: messages } = await supabase
        .from("messages")
        .select("*, sender:sender_id(id, full_name, email, role)")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      allMessages.push(messages || []);
    }

    const insights = await generateDashboardInsights(allMessages);

    res.json({ data: insights });
  } catch (err) {
    console.error("AI insights error:", err);
    res.status(500).json({ error: "Failed to generate insights" });
  }
};

/**
 * POST /api/ai/search
 * Semantic search across conversations using vector embeddings.
 */
export const semanticSearch = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { query, limit } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "query string is required" });
      return;
    }

    const results = await searchSimilarConversations(
      query,
      userId,
      limit || 5,
      0.5
    );

    res.json({ data: { results } });
  } catch (err) {
    console.error("AI semantic-search error:", err);
    res.status(500).json({ error: "Failed to search conversations" });
  }
};
