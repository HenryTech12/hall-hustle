import { Search, MessageCircle, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DanfoStripe from "./DanfoStripe";
import { COLORS, FONTS } from "../styles/tokens";
import { useUnreadCount } from "../hooks/useUnreadCount";

export default function TopHeader() {
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();

  return (
    <div style={{ flexShrink: 0 }}>
      <div
        style={{
          background: COLORS.paper,
          padding: "14px 16px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, cursor: "pointer" }} onClick={() => navigate("/")}>
          <span style={{ fontFamily: FONTS.display, fontSize: 22, color: COLORS.ink, letterSpacing: "-0.5px" }}>
            HALL
          </span>
          <span style={{ fontFamily: FONTS.display, fontSize: 22, color: COLORS.urgent, letterSpacing: "-0.5px" }}>
            HUSTLE
          </span>
        </div>
        <div style={{ display: "flex", gap: 14, color: COLORS.ink }}>
          <button onClick={() => navigate("/roommates")} aria-label="Roommate match" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <Users size={22} strokeWidth={2} color={COLORS.ink} />
          </button>
          <button onClick={() => navigate("/search")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <Search size={22} strokeWidth={2} color={COLORS.ink} />
          </button>
          <button onClick={() => navigate("/inbox")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, position: "relative" }}>
            <MessageCircle size={22} strokeWidth={2} color={COLORS.ink} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
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
        </div>
      </div>
      <DanfoStripe height={4} />
    </div>
  );
}
