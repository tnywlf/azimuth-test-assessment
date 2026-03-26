import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUnreadCount } from "../hooks/useUnread";
import {
  LayoutDashboard,
  Building2,
  MessageSquare,
  LogOut,
  User,
} from "lucide-react";

export default function Sidebar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useUnreadCount();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const roleLabel =
    profile?.role === "landlord"
      ? "Landlord"
      : profile?.role === "agent"
      ? "Agent"
      : "Tenant";

  const roleColor =
    profile?.role === "landlord"
      ? "var(--primary)"
      : profile?.role === "agent"
      ? "var(--secondary)"
      : "var(--warning)";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Building2 size={28} />
        <span>Azimuth</span>
      </div>

      <div className="sidebar-user">
        <div className="sidebar-avatar">
          <User size={20} />
        </div>
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">{profile?.full_name}</span>
          <span className="sidebar-user-role" style={{ color: roleColor }}>
            {roleLabel}
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className="sidebar-link">
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/properties" className="sidebar-link">
          <Building2 size={20} />
          <span>Properties</span>
        </NavLink>
        <NavLink to="/messages" className="sidebar-link">
          <MessageSquare size={20} />
          <span>Messages</span>
          {unreadCount > 0 && (
            <span className="sidebar-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-link logout-btn" onClick={handleSignOut}>
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
