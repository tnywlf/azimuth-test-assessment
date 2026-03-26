import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { propertiesApi, conversationsApi, aiApi } from "../services/api";
import { Property, Conversation, DashboardInsights } from "../types";
import PropertyCard from "../components/PropertyCard";
import {
  Building2,
  MessageSquare,
  Users,
  Sparkles,
  Loader2,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [propRes, convRes] = await Promise.all([
        propertiesApi.list(),
        conversationsApi.list(),
      ]);
      setProperties(propRes.data.data || []);
      setConversations(convRes.data.data || []);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await aiApi.insights();
      setInsights(res.data.data);
    } catch {
      setInsights(null);
    } finally {
      setLoadingInsights(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const roleLabel =
    profile?.role === "landlord"
      ? "Landlord"
      : profile?.role === "agent"
      ? "Agent"
      : "Tenant";

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Welcome back, {profile?.full_name}</h1>
          <p className="subtitle">{roleLabel} Dashboard</p>
        </div>
        {(profile?.role === "landlord" || profile?.role === "agent") && (
          <button
            className="btn btn-primary"
            onClick={() => navigate("/properties/new")}
          >
            + New Property
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "var(--primary-light)" }}>
            <Building2 size={24} color="var(--primary)" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{properties.length}</span>
            <span className="stat-label">Properties</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#dcfce7" }}>
            <MessageSquare size={24} color="var(--secondary)" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{conversations.length}</span>
            <span className="stat-label">Conversations</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#fef3c7" }}>
            <Users size={24} color="var(--warning)" />
          </div>
          <div className="stat-info">
            <span className="stat-value">
              {properties.reduce(
                (acc, p) => acc + (p.property_tenants?.length || 0),
                0
              )}
            </span>
            <span className="stat-label">Total Tenants</span>
          </div>
        </div>
        <div className="stat-card clickable" onClick={loadInsights}>
          <div className="stat-icon" style={{ background: "#ede9fe" }}>
            {loadingInsights ? (
              <Loader2 size={24} color="#7c3aed" className="spin" />
            ) : (
              <Sparkles size={24} color="#7c3aed" />
            )}
          </div>
          <div className="stat-info">
            <span className="stat-value">
              {insights ? insights.total_issues : "—"}
            </span>
            <span className="stat-label">AI Insights</span>
          </div>
        </div>
      </div>

      {/* AI Insights Panel */}
      {insights && (
        <div className="insights-panel">
          <div className="insights-header">
            <Sparkles size={20} />
            <h2>AI Insights</h2>
            <span className={`sentiment-badge sentiment-${insights.overall_sentiment}`}>
              {insights.overall_sentiment}
            </span>
          </div>
          <div className="insights-grid">
            <div className="insight-section">
              <h3>
                <TrendingUp size={16} /> Key Findings
              </h3>
              <ul>
                {insights.key_findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
            <div className="insight-section">
              <h3>
                <AlertTriangle size={16} /> Recommendations
              </h3>
              <ul>
                {insights.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
          {insights.high_priority > 0 && (
            <div className="insight-alert">
              ⚠️ {insights.high_priority} high-priority issue(s) require
              immediate attention.
            </div>
          )}
        </div>
      )}

      {/* Recent Properties */}
      <div className="section">
        <div className="section-header">
          <h2>Recent Properties</h2>
          <button
            className="btn btn-ghost"
            onClick={() => navigate("/properties")}
          >
            View All →
          </button>
        </div>
        {properties.length === 0 ? (
          <div className="empty-state">
            <Building2 size={48} />
            <p>No properties yet</p>
          </div>
        ) : (
          <div className="properties-grid">
            {properties.slice(0, 4).map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Conversations */}
      {/* <div className="section">
        <div className="section-header">
          <h2>Recent Messages</h2>
          <button
            className="btn btn-ghost"
            onClick={() => navigate("/messages")}
          >
            View All →
          </button>
        </div>
        {conversations.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={48} />
            <p>No conversations yet</p>
          </div>
        ) : (
          <div className="conversations-list">
            {conversations.slice(0, 5).map((conv) => {
              const otherParticipants = conv.participants
                ?.filter((p) => p.user_id !== profile?.id)
                .map((p) => p.user?.full_name)
                .join(", ");

              return (
                <div
                  key={conv.id}
                  className="conversation-item"
                  onClick={() => navigate(`/messages/${conv.id}`)}
                >
                  <div className="conversation-info">
                    <span className="conversation-name">
                      {conv.title || otherParticipants || "Conversation"}
                    </span>
                    <span className="conversation-preview">
                      {conv.last_message?.content || "No messages yet"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div> */}
    </div>
  );
}
