import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { Notification as AppNotification } from "../types";
import { notificationsApi } from "../services/api";

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  onlineUsers: Set<string>;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  addNotificationListener: (cb: (n: AppNotification) => void) => void;
  removeNotificationListener: (cb: (n: AppNotification) => void) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  refreshNotifications: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Derive WS URL from API URL: strip "/api" suffix to get the base server URL.
const API_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000/api`;
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");

export function SocketProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const listenersRef = useRef<Set<(n: AppNotification) => void>>(new Set());

  // ─── Load notifications from REST API ───
  const refreshNotifications = useCallback(async () => {
    if (!session) return;
    try {
      const res = await notificationsApi.list(50, 0);
      const payload = res.data.data; // { notifications: [], unread_count: number }
      setNotifications(payload.notifications || []);
      setUnreadNotificationCount(payload.unread_count || 0);
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, [session]);

  // ─── Connect Socket.IO when session + profile are available ───
  useEffect(() => {
    if (!session?.access_token || !profile) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token: session.access_token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("[Socket] Connected:", newSocket.id);
      setConnected(true);
      // Ask server for online user list
      newSocket.emit("users:online:request");
    });

    newSocket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
    });

    // ─── Online user tracking (matches backend events) ───
    newSocket.on("user:online", ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    newSocket.on("users:online:list", (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
    });

    // ─── Push notification from server ───
    newSocket.on("notification:new", (notification: AppNotification) => {
      console.log("[Socket] Push notification:", notification.type, notification.title);
      setNotifications((prev) => [notification, ...prev]);
      setUnreadNotificationCount((prev) => prev + 1);

      // Notify all registered listeners (e.g. toast, sound)
      for (const cb of listenersRef.current) {
        cb(notification);
      }
    });

    setSocket(newSocket);

    // Load stored notifications on connect
    refreshNotifications();

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, profile?.id]);

  // ─── Notification listener management ───
  const addNotificationListener = useCallback(
    (cb: (n: AppNotification) => void) => {
      listenersRef.current.add(cb);
    },
    []
  );

  const removeNotificationListener = useCallback(
    (cb: (n: AppNotification) => void) => {
      listenersRef.current.delete(cb);
    },
    []
  );

  // ─── Mark single notification read ───
  const markNotificationRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }, []);

  // ─── Mark all notifications read ───
  const markAllNotificationsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadNotificationCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        onlineUsers,
        notifications,
        unreadNotificationCount,
        addNotificationListener,
        removeNotificationListener,
        markNotificationRead,
        markAllNotificationsRead,
        refreshNotifications,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
