import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../contexts/SocketContext";
import { Notification as AppNotification } from "../types";
import {
  Bell,
  MessageSquare,
  Building2,
  UserPlus,
  UserMinus,
  Wrench,
  FileText,
  Info,
  Check,
  CheckCheck,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ICON_MAP: Record<string, React.ReactElement> = {
  new_message: <MessageSquare size={16} />,
  property_assignment: <Building2 size={16} />,
  tenant_assigned: <UserPlus size={16} />,
  tenant_removed: <UserMinus size={16} />,
  maintenance_alert: <Wrench size={16} />,
  lease_update: <FileText size={16} />,
  system: <Info size={16} />,
};

const COLOR_MAP: Record<string, string> = {
  new_message: "var(--primary)",
  property_assignment: "#7c3aed",
  tenant_assigned: "var(--secondary)",
  tenant_removed: "var(--danger)",
  maintenance_alert: "var(--warning)",
  lease_update: "#7c3aed",
  system: "var(--text-secondary)",
};

export default function NotificationBell() {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useSocket();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.read) {
      markNotificationRead(notification.id);
    }

    // Navigate based on notification data payload
    if (notification.data?.conversation_id) {
      navigate(`/messages/${notification.data.conversation_id}`);
    } else if (notification.data?.property_id) {
      navigate(`/properties/${notification.data.property_id}`);
    }

    setOpen(false);
  };

  return (
    <div className="notif-wrapper" ref={panelRef}>
      <button
        className="notif-bell"
        onClick={() => setOpen(!open)}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadNotificationCount > 0 && (
          <span className="notif-bell-badge">
            {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <h3>Notifications</h3>
            <div className="notif-panel-actions">
              {unreadNotificationCount > 0 && (
                <button
                  className="notif-mark-all"
                  onClick={markAllNotificationsRead}
                  title="Mark all as read"
                >
                  <CheckCheck size={16} />
                </button>
              )}
              <button className="notif-close" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <Bell size={24} />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 30).map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${!n.read ? "notif-item--unread" : ""}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div
                    className="notif-item-icon"
                    style={{ color: COLOR_MAP[n.type] || "var(--text-secondary)" }}
                  >
                    {ICON_MAP[n.type] || <Bell size={16} />}
                  </div>
                  <div className="notif-item-content">
                    <span className="notif-item-title">{n.title}</span>
                    <span className="notif-item-body">{n.body}</span>
                    <span className="notif-item-time">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {!n.read && (
                    <button
                      className="notif-item-read"
                      onClick={(e) => {
                        e.stopPropagation();
                        markNotificationRead(n.id);
                      }}
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
