import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Send, MapPin, BadgeCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWebSocketChat } from "../hooks/useWebSocketChat";
import { listingsApi } from "../api/listings";
import { usersApi } from "../api/users";
import { roommatesApi } from "../api/roommates";
import { COLORS, FONTS } from "../styles/tokens";

export default function ChatPage() {
  const { listingId, otherUserId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { messages, sendMessage, connected } = useWebSocketChat(listingId, otherUserId, token);
  const [draft, setDraft] = useState("");
  const [listing, setListing] = useState(null);
  // The person on the other end of THIS conversation — not necessarily the
  // listing owner. If you own the listing and someone messaged you about
  // it, the header needs to show them, not yourself.
  const [otherUser, setOtherUser] = useState(null);

  useEffect(() => {
    listingsApi
      .getOne(listingId)
      .then(setListing)
      .catch(() => setListing(null));
  }, [listingId]);

  useEffect(() => {
    usersApi
      .getPublicProfile(otherUserId)
      .then(setOtherUser)
      .catch(() => setOtherUser(null));
  }, [otherUserId]);

  const [compat, setCompat] = useState(null);
  useEffect(() => {
    roommatesApi
      .score(otherUserId)
      .then((c) => setCompat(c?.score != null ? c : null))
      .catch(() => setCompat(null));
  }, [otherUserId]);

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(draft.trim());
    setDraft("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: COLORS.feedBg, display: "flex", flexDirection: "column", zIndex: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 12px", background: COLORS.paper, borderBottom: `1px solid ${COLORS.border}` }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.ink }}>
          <ChevronLeft size={22} />
        </button>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: COLORS.ink,
            color: COLORS.danfo,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONTS.display,
            fontSize: 13,
          }}
        >
          {otherUser?.full_name?.[0] || "?"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.ink }}>{otherUser?.full_name || "Chat"}</span>
            {otherUser?.is_verified && <BadgeCheck size={13} color={COLORS.verified} />}
          </div>
          <div style={{ fontSize: 11, color: connected ? COLORS.verified : COLORS.muted, fontWeight: 600 }}>
            {connected ? "⚡ In-app · live" : "Connecting..."}
            {compat && <span style={{ marginLeft: 8, color: COLORS.verified }}>· {compat.score}% roommate match</span>}
          </div>
        </div>
      </div>

      {listing && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#EFE4C8", fontSize: 11.5, color: COLORS.ink }}>
          <MapPin size={12} />
          {listing.hall_name} · {listing.price_label || "Negotiable"}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: COLORS.muted, fontSize: 12.5, marginTop: 20 }}>
            Say hi — ask if the space is still available.
          </div>
        )}
        {messages.map((m, i) => {
          const isMe = m.sender_id === user?.id;
          return (
            <div key={m.id || i} style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "78%" }}>
              <div
                style={{
                  background: isMe ? COLORS.danfo : "#fff",
                  color: COLORS.ink,
                  padding: "8px 12px",
                  borderRadius: 14,
                  borderBottomRightRadius: isMe ? 4 : 14,
                  borderBottomLeftRadius: isMe ? 14 : 4,
                  fontSize: 13.5,
                  border: isMe ? "none" : `1px solid ${COLORS.border}`,
                }}
              >
                {m.body}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, background: COLORS.paper, borderTop: `1px solid ${COLORS.border}` }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message..."
          style={{
            flex: 1,
            minWidth: 0,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            padding: "9px 14px",
            fontSize: 16,
            outline: "none",
            background: "#fff",
          }}
        />
        <button
          type="submit"
          style={{
            background: COLORS.danfo,
            border: "none",
            borderRadius: "50%",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Send size={16} color={COLORS.ink} />
        </button>
      </form>
    </div>
  );
}
