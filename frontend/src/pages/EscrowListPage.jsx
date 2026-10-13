import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { paymentsApi } from "../api/payments";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { COLORS, FONTS } from "../styles/tokens";

const LABEL = {
  pending: ["Awaiting payment", COLORS.muted],
  held: ["In escrow", COLORS.danfoDeep],
  released: ["Released", COLORS.verified],
  disputed: ["Disputed", COLORS.urgent],
  refunded: ["Refunded", COLORS.muted],
  failed: ["Failed", COLORS.urgent],
};

export default function EscrowListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    paymentsApi.listMine().then(setItems).catch((e) => setError(extractErrorMessage(e, "Couldn't load payments.")));
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: COLORS.paper }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.ink }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontFamily: FONTS.display, fontSize: 15, color: COLORS.ink }}>MY PAYMENTS</span>
      </div>
      <div style={{ padding: 16 }}>
        {error && <div style={{ color: COLORS.urgent, fontSize: 13 }}>{error}</div>}
        {!items && !error && <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center" }}>Loading...</div>}
        {items && items.length === 0 && <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>No escrow payments yet.</div>}
        {items?.map((e) => {
          const [label, color] = LABEL[e.status] || LABEL.pending;
          const paying = String(e.payer_id) === String(user?.id);
          return (
            <button
              key={e.id}
              onClick={() => navigate(`/escrow/${e.id}`)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, marginBottom: 10, cursor: "pointer", textAlign: "left" }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.ink }}>₦{Number(e.amount).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>{paying ? "You paid" : "You receive"}{e.hall_name ? ` · ${e.hall_name}` : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color }}>{label}</span>
                <ChevronRight size={16} color={COLORS.muted} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
