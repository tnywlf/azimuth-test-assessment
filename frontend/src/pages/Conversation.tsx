import { useEffect, useState, useRef, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { conversationsApi } from "../services/api";
import { supabase } from "../config/supabase";
import { Conversation as ConvType, Message } from "../types";
import MessageBubble from "../components/MessageBubble";
import AISummary from "../components/AISummary";
import SmartReplies from "../components/SmartReplies";
import { markConversationRead } from "../hooks/useUnread";
import { ArrowLeft, Send, Sparkles } from "lucide-react";

export default function Conversation() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<ConvType | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mark conversation as read when opened
  useEffect(() => {
    if (id) markConversationRead(id);
  }, [id]);

  useEffect(() => {
    loadConversation();
  }, [id]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`messages-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if not already in state (to avoid duplicates from our own sends)
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Auto-scroll to bottom when new messages arrive & mark read
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (id) markConversationRead(id);
  }, [messages, id]);

  const loadConversation = async () => {
    try {
      const res = await conversationsApi.getById(id!);
      const data = res.data.data;
      setConversation(data);
      setMessages(data.messages || []);
    } catch {
      navigate("/messages");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const content = newMessage;
    setNewMessage("");

    try {
      const res = await conversationsApi.sendMessage(id!, content);
      const msg = res.data.data;
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch {
      setNewMessage(content); // Restore on failure
    } finally {
      setSending(false);
    }
  };

  const handleSmartReplySelect = (reply: string) => {
    setNewMessage(reply);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const otherParticipants = conversation?.participants
    ?.filter((p) => p.user_id !== profile?.id)
    .map((p) => p.user?.full_name)
    .join(", ");

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* Chat Header */}
        <div className="chat-header">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate("/messages")}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="chat-header-info">
            <h2>{conversation?.title || otherParticipants || "Conversation"}</h2>
            <span className="chat-participants">
              {conversation?.participants?.map((p) => p.user?.full_name).join(", ")}
            </span>
          </div>
          <button
            className={`btn btn-sm ${showAI ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setShowAI(!showAI)}
            title="AI Analysis"
          >
            <Sparkles size={18} />
          </button>
        </div>

        <div className="chat-body">
          {/* Messages Area */}
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_id === profile?.id}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* AI Panel (side) */}
          {showAI && (
            <div className="chat-ai-panel">
              <AISummary conversationId={id!} />
            </div>
          )}
        </div>

        {/* Smart Replies */}
        <div className="chat-smart-replies">
          <SmartReplies
            conversationId={id!}
            onSelect={handleSmartReplySelect}
          />
        </div>

        {/* Message Input */}
        <form className="chat-input" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            className="btn btn-primary btn-icon"
            disabled={!newMessage.trim() || sending}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
