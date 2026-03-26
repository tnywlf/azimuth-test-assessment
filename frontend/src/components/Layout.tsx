import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { useSocket } from "../contexts/SocketContext";

export default function Layout() {
  const { connected } = useSocket();

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        {/* Top bar with notification bell */}
        <header className="top-bar">
          <div className="top-bar-left">
            {connected && (
              <span className="connection-status connection-status--online" title="Connected to real-time server">
                <span className="connection-dot" />
                Live
              </span>
            )}
          </div>
          <div className="top-bar-right">
            <NotificationBell />
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
