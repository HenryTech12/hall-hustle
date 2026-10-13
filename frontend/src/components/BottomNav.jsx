import { Home, Search, PlusSquare, MessageCircle, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import DanfoStripe from "./DanfoStripe";
import { COLORS } from "../styles/tokens";
import { useUnreadCount } from "../hooks/useUnreadCount";

const TABS = [
  { key: "home", icon: Home, path: "/" },
  { key: "search", icon: Search, path: "/search" },
  { key: "compose", icon: PlusSquare, path: "/compose" },
  { key: "inbox", icon: MessageCircle, path: "/inbox" },
  { key: "profile", icon: User, path: "/profile" },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useUnreadCount();

  return (
    <div style={{ flexShrink: 0 }}>
      <DanfoStripe height={3} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          padding: "10px 0 max(10px, env(safe-area-inset-bottom))",
          background: COLORS.paper,
        }}
      >
        {TABS.map(({ key, icon: Icon, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={key}
              onClick={() => navigate(path)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 8, position: "relative" }}
              aria-label={key}
            >
              <Icon size={24} color={active ? COLORS.urgent : COLORS.ink} strokeWidth={active ? 2.4 : 2} />
              {key === "inbox" && unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    right: 3,
                    background: COLORS.urgent,
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 800,
                    minWidth: 15,
                    height: 15,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    border: `1.5px solid ${COLORS.paper}`,
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
