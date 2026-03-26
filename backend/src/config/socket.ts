import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { supabase } from "./supabase";

let io: SocketIOServer | null = null;

/**
 * Map of userId → Set of socket IDs (one user may have multiple tabs).
 */
const userSockets = new Map<string, Set<string>>();

/**
 * Initialize Socket.IO with JWT authentication.
 */
export function initSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // ─── Authentication middleware ───
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        return next(new Error("Invalid or expired token"));
      }

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("id", user.id)
        .single();

      if (!profile) {
        return next(new Error("Profile not found"));
      }

      // Attach user info to socket
      (socket as any).userId = profile.id;
      (socket as any).userProfile = profile;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  // ─── Connection handler ───
  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;
    const profile = (socket as any).userProfile;
    console.log(
      `[WS] Connected: ${profile.full_name} (${userId}) socket=${socket.id}`
    );

    // Track user sockets
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Broadcast online status
    io!.emit("user:online", { userId, online: true });

    // ─── Join conversation rooms ───
    socket.on("conversation:join", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[WS] ${profile.full_name} joined room conversation:${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // ─── Typing indicators ───
    socket.on(
      "typing:start",
      (data: { conversationId: string }) => {
        socket
          .to(`conversation:${data.conversationId}`)
          .emit("typing:start", {
            conversationId: data.conversationId,
            userId,
            userName: profile.full_name,
          });
      }
    );

    socket.on(
      "typing:stop",
      (data: { conversationId: string }) => {
        socket
          .to(`conversation:${data.conversationId}`)
          .emit("typing:stop", {
            conversationId: data.conversationId,
            userId,
          });
      }
    );

    // ─── Request online users ───
    socket.on("users:online:request", () => {
      const onlineUserIds = Array.from(userSockets.keys());
      socket.emit("users:online:list", onlineUserIds);
    });

    // ─── Disconnect ───
    socket.on("disconnect", () => {
      console.log(`[WS] Disconnected: ${profile.full_name} socket=${socket.id}`);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          // User fully offline
          io!.emit("user:online", { userId, online: false });
        }
      }
    });
  });

  console.log("[WS] Socket.IO initialized");
  return io;
}

/**
 * Get the Socket.IO server instance.
 */
export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Emit an event to a specific user (across all their connected sockets).
 */
export function emitToUser(userId: string, event: string, data: any): void {
  if (!io) return;
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit(event, data);
    }
  }
}

/**
 * Emit to all participants in a conversation room.
 */
export function emitToConversation(
  conversationId: string,
  event: string,
  data: any
): void {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, data);
}

/**
 * Check if a user is currently online.
 */
export function isUserOnline(userId: string): boolean {
  return userSockets.has(userId) && userSockets.get(userId)!.size > 0;
}

export { userSockets };
