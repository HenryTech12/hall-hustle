import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, MapPin } from "lucide-react";
import { messagesApi } from "../api/messages";
import { COLORS, FONTS } from "../styles/tokens";

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function InboxPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    messagesApi
      .getConversations()
      .then(setConversations)
      .catch(() => setError("Couldn't load conversations."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: COLORS.muted, fontSize: 13 }}>Loading conversations...</div>;
  }

  if (error) {
    return <div style={{ textAlign: "center", padding: 40, color: COLORS.urgent, fontSize: 13 }}>{error}</div>;
  }

  if (conversations.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: COLORS.muted, fontSize: 13 }}>
        No conversations yet. Message someone from a listing to start one.
      </div>
    );
  }

  return (
    <div>
      {conversations.map((c) => {
        const hasUnread = c.unread_count > 0;
        return (
          <button
            key={`${c.listing_id}-${c.other_user.id}`}
            onClick={() => navigate(`/chat/${c.listing_id}/${c.other_user.id}`)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: "12px 16px",
              background: COLORS.card,
              border: "none",
              borderBottom: `1px solid ${COLORS.border}`,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: COLORS.ink,
                color: COLORS.danfo,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONTS.display,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {c.other_user.full_name?.[0] || "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                  <span
                    style={{
                      fontWeight: hasUnread ? 800 : 700,
                      fontSize: 14,
                      color: COLORS.ink,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.other_user.full_name}
                  </span>
                  {c.other_user.is_verified && <BadgeCheck size={13} color={COLORS.verified} style={{ flexShrink: 0 }} />}
                </div>
                <span style={{ fontSize: 11, color: hasUnread ? COLORS.verified : COLORS.muted, fontWeight: hasUnread ? 700 : 500, flexShrink: 0 }}>
                  {timeAgo(c.last_message_at)}
                </span>
              </div>

              {c.hall_name && (
                <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: COLORS.muted, marginTop: 1 }}>
                  <MapPin size={10} /> {c.hall_name}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    color: hasUnread ? COLORS.ink : COLORS.muted,
                    fontWeight: hasUnread ? 600 : 400,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {c.last_message_is_mine && <span style={{ color: COLORS.muted }}>You: </span>}
                  {c.last_message}
                </span>
                {hasUnread && (
                  <span
                    style={{
                      background: COLORS.urgent,
                      color: "#fff",
                      fontSize: 10.5,
                      fontWeight: 800,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 5px",
                      flexShrink: 0,
                    }}
                  >
                    {c.unread_count}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
