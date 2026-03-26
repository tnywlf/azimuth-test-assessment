import { useEffect, useState, useRef, FormEvent, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { conversationsApi, usersApi } from "../services/api";
import {
  Conversation,
  Profile,
  Message,
} from "../types";
import { isConversationUnread, markConversationRead } from "../hooks/useUnread";
import MessageBubble from "../components/MessageBubble";
import AISummary from "../components/AISummary";
import SmartReplies from "../components/SmartReplies";
import {
  MessageSquare,
  Plus,
  X,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Messages() {
  const { id: activeId } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  // ─── Sidebar (conversation list) state ───
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // ─── Chat panel state ───
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Load conversation list ───
  const loadConversations = useCallback(async () => {
    try {
      const res = await conversationsApi.list();
      setConversations(res.data.data || []);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ─── Load active conversation ───
  const loadChat = useCallback(async (convId: string) => {
    setChatLoading(true);
    try {
      const res = await conversationsApi.getById(convId);
      const data = res.data.data;
      setConversation(data);
      setMessages(data.messages || []);
      markConversationRead(convId);
    } catch {
      navigate("/messages", { replace: true });
    } finally {
      setChatLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (activeId) {
      loadChat(activeId);
    } else {
      setConversation(null);
      setMessages([]);
    }
  }, [activeId, loadChat]);

  // ─── Socket.IO: Join/leave conversation rooms + real-time messages ───
  useEffect(() => {
    if (!activeId || !socket) return;

    // Join the conversation room
    socket.emit("conversation:join", activeId);

    // Listen for new messages broadcast by the server
    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Refresh conversation list sidebar to update last message preview
      loadConversations();
    };

    // Listen for typing indicators
    const handleTypingStart = ({ conversationId, userName }: { conversationId: string; userId: string; userName: string }) => {
      if (conversationId !== activeId) return;
      setTypingUsers((prev) => (prev.includes(userName) ? prev : [...prev, userName]));
    };

    const handleTypingStop = ({ conversationId }: { conversationId: string; userId: string }) => {
      if (conversationId !== activeId) return;
      // Remove the first typing user (simplest approach without mapping userId → userName)
      setTypingUsers((prev) => prev.slice(1));
    };

    socket.on("message:new", handleNewMessage);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.emit("conversation:leave", activeId);
      socket.off("message:new", handleNewMessage);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      setTypingUsers([]);
    };
  }, [activeId, socket, loadConversations]);

  // ─── Auto-scroll & mark read ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (activeId) markConversationRead(activeId);
  }, [messages, activeId]);

  // ─── Send message ───
  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || sending || !activeId) return;

    setSending(true);
    const content = newMessage;
    setNewMessage("");

    // Stop typing indicator on send
    if (socket && activeId) {
      socket.emit("typing:stop", { conversationId: activeId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    try {
      const res = await conversationsApi.sendMessage(activeId, content);
      const msg = res.data.data;
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Refresh sidebar to update last message preview
      loadConversations();
    } catch {
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleSmartReplySelect = (reply: string) => {
    setNewMessage(reply);
  };

  // ─── Emit typing indicator on input change ───
  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (!socket || !activeId) return;

    socket.emit("typing:start", { conversationId: activeId });

    // Clear previous timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId: activeId });
    }, 2000);
  };

  // ─── New conversation ───
  const handleNewConversation = async () => {
    setShowNew(true);
    try {
      const res = await usersApi.list();
      setUsers(
        (res.data.data || []).filter((u: Profile) => u.id !== profile?.id)
      );
    } catch {
      /* ignore */
    }
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;
    setCreating(true);
    try {
      const res = await conversationsApi.create({
        participantIds: selectedUsers,
        title: title || undefined,
      });
      setShowNew(false);
      setSelectedUsers([]);
      setTitle("");
      await loadConversations();
      navigate(`/messages/${res.data.data.id}`);
    } catch (err) {
      console.error("Failed to create conversation:", err);
    } finally {
      setCreating(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((uid) => uid !== userId)
        : [...prev, userId]
    );
  };

  // ─── Filter & sort conversations ───
  const filtered = conversations.filter((conv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = conv.participants?.some((p) =>
      p.user?.full_name?.toLowerCase().includes(q)
    );
    const titleMatch = conv.title?.toLowerCase().includes(q);
    return nameMatch || titleMatch;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aUnread = isConversationUnread(a, profile?.id) ? 1 : 0;
    const bUnread = isConversationUnread(b, profile?.id) ? 1 : 0;
    if (aUnread !== bUnread) return bUnread - aUnread;
    const aTime = a.last_message?.created_at || a.updated_at;
    const bTime = b.last_message?.created_at || b.updated_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  // ─── Active chat helpers ───
  const otherParticipants = conversation?.participants
    ?.filter((p) => p.user_id !== profile?.id)
    .map((p) => p.user?.full_name)
    .join(", ");

  return (
    <div className="msg-page">
      {/* ══════════ LEFT PANEL — Conversation List ══════════ */}
      <div className={`msg-sidebar ${activeId ? "msg-sidebar--hidden-mobile" : ""}`}>
        {/* Sidebar Header */}
        <div className="msg-sidebar-header">
          <h2>Messages</h2>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleNewConversation}
            title="New Conversation"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="msg-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Conversation List */}
        <div className="msg-list">
          {listLoading ? (
            <div className="msg-list-loading">
              <div className="spinner" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="msg-list-empty">
              <MessageSquare size={32} />
              <p>
                {conversations.length === 0
                  ? "No conversations yet"
                  : "No results"}
              </p>
            </div>
          ) : (
            sorted.map((conv) => {
              const unread = isConversationUnread(conv, profile?.id);
              const isActive = conv.id === activeId;
              const others = conv.participants
                ?.filter((p) => p.user_id !== profile?.id)
                .map((p) => p.user?.full_name)
                .join(", ");
              const initials =
                conv.participants
                  ?.filter((p) => p.user_id !== profile?.id)
                  .map((p) => p.user?.full_name?.charAt(0)?.toUpperCase())
                  .slice(0, 2)
                  .join("") || "?";

              return (
                <div
                  key={conv.id}
                  className={`msg-item ${isActive ? "msg-item--active" : ""} ${
                    unread && !isActive ? "msg-item--unread" : ""
                  }`}
                  onClick={() => navigate(`/messages/${conv.id}`)}
                >
                  <div
                    className={`msg-item-avatar ${
                      unread && !isActive ? "msg-item-avatar--unread" : ""
                    }`}
                  >
                    {initials}
                  </div>
                  <div className="msg-item-content">
                    <div className="msg-item-top">
                      <span className="msg-item-name">
                        {conv.title || others || "Conversation"}
                      </span>
                      <span className="msg-item-time">
                        {conv.last_message
                          ? formatDistanceToNow(
                              new Date(conv.last_message.created_at),
                              { addSuffix: true }
                            )
                          : ""}
                      </span>
                    </div>
                    <div className="msg-item-bottom">
                      <span className="msg-item-preview">
                        {conv.last_message
                          ? `${conv.last_message.sender?.full_name}: ${conv.last_message.content}`
                          : "No messages yet"}
                      </span>
                      {unread && !isActive && <span className="msg-item-dot" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ══════════ RIGHT PANEL — Active Chat ══════════ */}
      <div className={`msg-chat ${!activeId ? "msg-chat--empty-state" : ""} ${activeId ? "msg-chat--visible-mobile" : ""}`}>
        {!activeId ? (
          /* No conversation selected */
          <div className="msg-chat-placeholder">
            <MessageSquare size={56} />
            <h3>Select a conversation</h3>
            <p>Choose from your conversations or start a new one.</p>
            <button className="btn btn-primary" onClick={handleNewConversation}>
              <Plus size={16} /> New Conversation
            </button>
          </div>
        ) : chatLoading ? (
          <div className="loading-screen">
            <div className="spinner" />
          </div>
        ) : (
          /* Active Chat */
          <>
            {/* Chat Header */}
            <div className="msg-chat-header">
              <button
                className="btn btn-ghost btn-sm msg-chat-back"
                onClick={() => navigate("/messages")}
              >
                ←
              </button>
              <div className="msg-chat-header-avatar">
                {conversation?.participants
                  ?.filter((p) => p.user_id !== profile?.id)
                  .map((p) => p.user?.full_name?.charAt(0)?.toUpperCase())
                  .slice(0, 2)
                  .join("") || "?"}
              </div>
              <div className="msg-chat-header-info">
                <h3>
                  {conversation?.title || otherParticipants || "Conversation"}
                </h3>
                <span className="msg-chat-header-participants">
                  {conversation?.participants
                    ?.map((p) => p.user?.full_name)
                    .join(", ")}
                </span>
              </div>
              <button
                className={`btn btn-sm ${showAI ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setShowAI(!showAI)}
                title="AI Analysis"
              >
                <Sparkles size={16} />
              </button>
            </div>

            {/* Chat Body */}
            <div className="msg-chat-body">
              <div className="msg-chat-messages">
                {messages.length === 0 ? (
                  <div className="msg-chat-empty">
                    <p>No messages yet. Say hello!</p>
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

              {/* AI Side Panel */}
              {showAI && (
                <div className="msg-chat-ai">
                  <AISummary conversationId={activeId!} />
                </div>
              )}
            </div>

            {/* Smart Replies */}
            <div className="msg-chat-smart">
              <SmartReplies
                conversationId={activeId!}
                onSelect={handleSmartReplySelect}
              />
            </div>

            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="msg-typing-indicator">
                <span className="typing-dots">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="typing-text">
                  {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                </span>
              </div>
            )}

            {/* Message Input */}
            <form className="msg-chat-input" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => handleInputChange(e.target.value)}
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
          </>
        )}
      </div>

      {/* ══════════ New Conversation Modal ══════════ */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Conversation</h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowNew(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label>Title (optional)</label>
              <input
                type="text"
                placeholder="Conversation title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Select participants</label>
              <div className="user-select-list">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`user-select-item ${
                      selectedUsers.includes(user.id) ? "selected" : ""
                    }`}
                    onClick={() => toggleUser(user.id)}
                  >
                    <div className="user-select-info">
                      <span className="user-select-name">
                        {user.full_name}
                      </span>
                      <span className="user-select-role">{user.role}</span>
                    </div>
                    <span className="user-select-email">{user.email}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowNew(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={selectedUsers.length === 0 || creating}
              >
                {creating ? "Creating..." : "Start Conversation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
