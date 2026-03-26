import { Request } from "express";
import { User } from "@supabase/supabase-js";

// ---------- User Roles ----------
export type UserRole = "tenant" | "landlord" | "agent";
export type PropertyType = "apartment" | "house" | "condo" | "commercial";
export type PropertyStatus = "available" | "occupied" | "maintenance";
export type LeaseStatus = "active" | "inactive" | "pending";

// ---------- Database Models ----------
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  title: string;
  description?: string;
  address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  property_type: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  rent_amount?: number;
  status: PropertyStatus;
  landlord_id: string;
  agent_id?: string;
  created_at: string;
  updated_at: string;
  landlord?: Profile;
  agent?: Profile;
  property_tenants?: PropertyTenant[];
}

export interface PropertyTenant {
  id: string;
  property_id: string;
  tenant_id: string;
  lease_start?: string;
  lease_end?: string;
  status: LeaseStatus;
  created_at: string;
  tenant?: Profile;
}

export interface Conversation {
  id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  messages?: Message[];
  last_message?: Message;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  user?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Profile;
}

export interface AISummary {
  id: string;
  conversation_id: string;
  summary: string;
  created_at: string;
}

// ---------- Notifications ----------
export type NotificationType =
  | "new_message"
  | "property_assignment"
  | "tenant_assigned"
  | "tenant_removed"
  | "maintenance_alert"
  | "lease_update"
  | "system";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
}

// ---------- Vector Embeddings ----------
export interface ConversationEmbedding {
  id: string;
  conversation_id: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
  created_at: string;
}

// ---------- AI Types ----------
export interface DetectedIssue {
  type: string;
  severity: "low" | "medium" | "high";
  description: string;
}

export interface IssueDetectionResult {
  issues: DetectedIssue[];
  overall_sentiment: "positive" | "neutral" | "negative";
}

export interface DashboardInsights {
  total_issues: number;
  high_priority: number;
  overall_sentiment: string;
  key_findings: string[];
  recommendations: string[];
}

// ---------- Express Extensions ----------
export interface AuthRequest extends Request {
  user?: Profile;
  supabaseUser?: User;
  token?: string;
}
