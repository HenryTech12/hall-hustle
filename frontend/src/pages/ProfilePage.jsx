import { useNavigate } from "react-router-dom";
import { BadgeCheck, Landmark, LogOut, ChevronRight, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { COLORS, FONTS } from "../styles/tokens";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: COLORS.ink,
            color: COLORS.danfo,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONTS.display,
            fontSize: 22,
          }}
        >
          {user?.full_name?.[0]}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 17, color: COLORS.ink }}>{user?.full_name}</span>
            {user?.is_verified && <BadgeCheck size={17} color={COLORS.verified} />}
          </div>
          {user?.matric_number && <div style={{ fontSize: 12.5, color: COLORS.muted }}>{user.matric_number}</div>}
          {(user?.department || user?.level) && <div style={{ fontSize: 12.5, color: COLORS.muted }}>{[user?.department, user?.level].filter(Boolean).join(" · ")}</div>}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${COLORS.border}`, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ padding: 14, display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}` }}>
          <span style={{ fontSize: 13, color: COLORS.muted }}>Trust score</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.verified }}>{user?.trust_score ?? 0} completed deals</span>
        </div>
        <div style={{ padding: 14, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: COLORS.muted }}>Email</span>
          <span style={{ fontSize: 13, color: COLORS.ink }}>
            {user?.school_email}
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: COLORS.verified }}>
              {user?.is_student_email ? "· Student email" : "· Verified"}
            </span>
          </span>
        </div>
      </div>

      <button
        onClick={() => navigate("/escrows")}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, marginBottom: 10, cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={18} color={COLORS.ink} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>My escrow payments</span>
        </div>
        <ChevronRight size={18} color={COLORS.muted} />
      </button>

      <button
        onClick={() => navigate("/roommates")}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, marginBottom: 10, cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={18} color={COLORS.ink} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>Roommate profile & matches</span>
        </div>
        <ChevronRight size={18} color={COLORS.muted} />
      </button>

      <button
        onClick={() => navigate("/bank-details")}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "#fff",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 10,
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Landmark size={18} color={COLORS.ink} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>Bank details for payouts</span>
        </div>
        <ChevronRight size={18} color={COLORS.muted} />
      </button>

      <button
        onClick={handleLogout}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          background: "#fff",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          padding: 14,
          cursor: "pointer",
          color: COLORS.urgent,
        }}
      >
        <LogOut size={18} />
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>Log out</span>
      </button>
    </div>
  );
}
