import { useEffect, useState } from "react";
import { listingsApi } from "../api/listings";
import { COLORS, FONTS } from "../styles/tokens";

export default function StoriesBar({ onOpenStory }) {
  const [urgent, setUrgent] = useState([]);

  useEffect(() => {
    listingsApi
      .getUrgent()
      .then(setUrgent)
      .catch(() => setUrgent([]));
  }, []);

  if (urgent.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        padding: "14px 16px",
        overflowX: "auto",
        background: COLORS.paper,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      {urgent.map((listing) => (
        <button
          key={listing.id}
          onClick={() => onOpenStory(listing)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            cursor: "pointer",
            minWidth: 58,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              padding: 3,
              background: COLORS.urgent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: COLORS.ink,
                color: COLORS.paper,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONTS.display,
                fontSize: 16,
                border: `2px solid ${COLORS.paper}`,
              }}
            >
              {listing.owner?.full_name?.[0] || "?"}
            </div>
          </div>
          <span style={{ fontSize: 10.5, color: COLORS.urgent, fontWeight: 700 }}>URGENT</span>
        </button>
      ))}
    </div>
  );
}
