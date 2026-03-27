import axios from "axios";
import { supabase } from "../config/supabase";

const API_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000/api`;

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach the Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Log response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const url = error.config?.url;
    console.error(
      `[API] ${error.config?.method?.toUpperCase()} ${url} → ${status}`,
      data
    );
    return Promise.reject(error);
  }
);

// ====== AUTH ======
export const authApi = {
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    role: string;
    phone?: string;
  }) => api.post("/auth/register", data),

  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),

  getMe: () => api.get("/auth/me"),
};

// ====== USERS ======
export const usersApi = {
  list: (role?: string) => api.get("/users", { params: role ? { role } : {} }),
  getById: (id: string) => api.get(`/users/${id}`),
};

// ====== PROPERTIES ======
export const propertiesApi = {
  list: () => api.get("/properties"),
  listAll: () => api.get("/properties/all"),
  getById: (id: string) => api.get(`/properties/${id}`),
  create: (data: Record<string, unknown>) => api.post("/properties", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/properties/${id}`, data),
  assignTenant: (
    propertyId: string,
    data: { tenant_id: string; lease_start?: string; lease_end?: string }
  ) => api.post(`/properties/${propertyId}/tenants`, data),
  removeTenant: (propertyId: string, tenantId: string) =>
    api.delete(`/properties/${propertyId}/tenants/${tenantId}`),
};

// ====== CONVERSATIONS ======
export const conversationsApi = {
  list: () => api.get("/conversations"),
  create: (data: { participantIds: string[]; title?: string }) =>
    api.post("/conversations", data),
  getById: (id: string) => api.get(`/conversations/${id}`),
  sendMessage: (conversationId: string, content: string) =>
    api.post(`/conversations/${conversationId}/messages`, { content }),
};

// ====== AI ======
export const aiApi = {
  summarize: (conversationId: string) =>
    api.post(`/ai/summarize/${conversationId}`),
  smartReplies: (conversationId: string) =>
    api.post(`/ai/smart-replies/${conversationId}`),
  detectIssues: (conversationId: string) =>
    api.post(`/ai/detect-issues/${conversationId}`),
  insights: () => api.get("/ai/insights"),
  semanticSearch: (query: string, limit?: number) =>
    api.post("/ai/search", { query, limit }),
};

// ====== NOTIFICATIONS ======
export const notificationsApi = {
  list: (limit?: number, offset?: number) =>
    api.get("/notifications", { params: { limit, offset } }),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put("/notifications/read-all"),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

export default api;
