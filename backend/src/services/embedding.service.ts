import { openai } from "../config/openai";
import { supabase } from "../config/supabase";
import { Message } from "../types";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate an embedding vector using OpenAI's embedding API.
 * Returns null if OpenAI is not configured.
 */
export async function generateEmbedding(
  text: string
): Promise<number[] | null> {
  if (!openai) {
    console.log("[EMBEDDING] OpenAI not configured — skipping embedding generation");
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data[0].embedding;
  } catch (err: any) {
    console.error("[EMBEDDING] Generation error:", err.message);
    return null;
  }
}

/**
 * Format messages into a single text block for embedding.
 */
function formatMessagesForEmbedding(messages: Message[]): string {
  return messages
    .map((m) => {
      const name = (m as any).sender?.full_name || "Unknown";
      const role = (m as any).sender?.role || "user";
      return `[${name} (${role})]: ${m.content}`;
    })
    .join("\n");
}

/**
 * Store or update the embedding for a conversation.
 * Called after new messages are sent.
 */
export async function upsertConversationEmbedding(
  conversationId: string,
  messages: Message[]
): Promise<void> {
  if (!openai) return; // Skip if OpenAI not configured
  if (messages.length === 0) return;

  const content = formatMessagesForEmbedding(messages);
  const embedding = await generateEmbedding(content);
  if (!embedding) return;

  try {
    // Check if embedding already exists for this conversation
    const { data: existing } = await supabase
      .from("conversation_embeddings")
      .select("id")
      .eq("conversation_id", conversationId)
      .single();

    const metadata = {
      message_count: messages.length,
      participants: [
        ...new Set(
          messages.map((m) => (m as any).sender?.full_name || "Unknown")
        ),
      ],
      last_updated: new Date().toISOString(),
    };

    if (existing) {
      // Update existing embedding
      await supabase
        .from("conversation_embeddings")
        .update({
          content,
          embedding: JSON.stringify(embedding),
          metadata,
        })
        .eq("id", existing.id);
    } else {
      // Insert new embedding
      await supabase.from("conversation_embeddings").insert({
        conversation_id: conversationId,
        content,
        embedding: JSON.stringify(embedding),
        metadata,
      });
    }

    console.log(
      `[EMBEDDING] Upserted embedding for conversation ${conversationId} (${messages.length} messages)`
    );
  } catch (err: any) {
    console.error("[EMBEDDING] Upsert error:", err.message);
  }
}

/**
 * Search for similar conversations using vector similarity.
 * Uses cosine similarity via Supabase's pgvector extension.
 */
export async function searchSimilarConversations(
  queryText: string,
  userId: string,
  limit: number = 5,
  similarityThreshold: number = 0.5
): Promise<
  Array<{
    conversation_id: string;
    content: string;
    similarity: number;
    metadata: Record<string, any>;
  }>
> {
  if (!openai) {
    console.log("[EMBEDDING] OpenAI not configured — skipping vector search");
    return [];
  }

  const queryEmbedding = await generateEmbedding(queryText);
  if (!queryEmbedding) return [];

  try {
    // Use Supabase RPC to call the vector similarity search function
    const { data, error } = await supabase.rpc("match_conversations", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: similarityThreshold,
      match_count: limit,
      p_user_id: userId,
    });

    if (error) {
      console.error("[EMBEDDING] Search error:", error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      conversation_id: row.conversation_id,
      content: row.content,
      similarity: row.similarity,
      metadata: row.metadata,
    }));
  } catch (err: any) {
    console.error("[EMBEDDING] Search exception:", err.message);
    return [];
  }
}

/**
 * Get contextual information from similar conversations to enhance AI responses.
 */
export async function getConversationContext(
  messages: Message[],
  userId: string
): Promise<string> {
  if (!openai || messages.length === 0) return "";

  const recentContent = formatMessagesForEmbedding(messages.slice(-10));
  const similar = await searchSimilarConversations(recentContent, userId, 3, 0.6);

  if (similar.length === 0) return "";

  const contextParts = similar.map(
    (s, i) =>
      `--- Related Conversation ${i + 1} (similarity: ${(s.similarity * 100).toFixed(0)}%) ---\n${s.content.slice(0, 500)}`
  );

  return (
    "\n\n[Context from similar conversations]:\n" + contextParts.join("\n\n")
  );
}
