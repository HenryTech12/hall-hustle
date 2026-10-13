import { useNavigate } from "react-router-dom";
import { ChevronLeft, X } from "lucide-react";
import { COLORS, FONTS } from "../styles/tokens";

export default function StoryViewer({ listing, onClose }) {
  const navigate = useNavigate();
  if (!listing) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.ink,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 12px 8px" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
          <ChevronLeft size={22} />
        </button>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: COLORS.danfo,
            color: COLORS.ink,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONTS.display,
            fontSize: 13,
          }}
        >
          {listing.owner?.full_name?.[0] || "?"}
        </div>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13.5 }}>{listing.owner?.full_name}</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
          <X size={20} />
        </button>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: 24,
          textAlign: "center",
        }}
      >
        <span
          style={{
            background: COLORS.urgent,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            padding: "4px 10px",
            borderRadius: 4,
            letterSpacing: "0.4px",
          }}
        >
          URGENT · NEED SPACE
        </span>
        <div style={{ fontFamily: FONTS.display, color: "#fff", fontSize: 22 }}>{listing.hall_name}</div>
        <p style={{ color: "#D8CDB4", fontSize: 13.5, maxWidth: 260 }}>{listing.caption}</p>
        <button
          onClick={() => {
            onClose();
            navigate(`/chat/${listing.id}/${listing.owner?.id}`);
          }}
          style={{
            marginTop: 6,
            background: COLORS.danfo,
            color: COLORS.ink,
            border: "none",
            padding: "10px 20px",
            borderRadius: 6,
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Message {listing.owner?.full_name?.split(" ")[0]}
        </button>
      </div>
    </div>
  );
}
