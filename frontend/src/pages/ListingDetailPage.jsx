import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, BadgeCheck, ShieldCheck } from "lucide-react";
import { listingsApi } from "../api/listings";
import { paymentsApi } from "../api/payments";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { COLORS, FONTS } from "../styles/tokens";

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  useEffect(() => {
    listingsApi
      .getOne(id)
      .then(setListing)
      .catch(() => setError("Listing not found."));
  }, [id]);

  const startEscrowPayment = async () => {
    if (!listing) return;
    setPayError("");
    setPayLoading(true);
    try {
      const amount = listing.price_amount || customAmount;
      if (!amount || Number(amount) <= 0) {
        setPayError("Enter the amount to pay.");
        setPayLoading(false);
        return;
      }
      const res = await paymentsApi.initializeEscrow({
        listing_id: listing.id,
        payee_id: listing.owner.id,
        amount: Number(amount),
      });
      // Redirect to Paystack's hosted checkout — funds land in HallHustle's
      // account and stay `held` until the payer confirms move-in.
      window.location.href = res.authorization_url;
    } catch (err) {
      setPayError(extractErrorMessage(err, "Couldn't start payment. The other party may need to add bank details first."));
    } finally {
      setPayLoading(false);
    }
  };

  if (error) {
    return <div style={{ padding: 30, textAlign: "center", color: COLORS.urgent, fontSize: 13 }}>{error}</div>;
  }

  if (!listing) {
    return <div style={{ padding: 30, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>Loading...</div>;
  }

  const isOwnListing = listing.owner?.id === user?.id;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: COLORS.paper }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.ink }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontFamily: FONTS.display, fontSize: 15, color: COLORS.ink }}>LISTING</span>
      </div>

      <div
        style={{
          height: 240,
          background: !listing.photo_url
            ? "repeating-linear-gradient(135deg, #EFE4C8 0px, #EFE4C8 22px, #E7D8B4 22px, #E7D8B4 44px)"
            : listing.media_type === "video"
            ? "#000"
            : `url(${listing.photo_url}) center/cover no-repeat`,
          position: "relative",
        }}
      >
        {listing.media_type === "video" && listing.photo_url && (
          <video
            src={listing.photo_url}
            controls
            loop
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {listing.music_url && <audio src={listing.music_url} controls style={{ position: "absolute", bottom: 8, left: 8, right: 8, width: "calc(100% - 16px)" }} />}
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: COLORS.ink }}>{listing.owner?.full_name}</span>
            {listing.owner?.is_verified && <BadgeCheck size={16} color={COLORS.verified} />}
          </div>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 4,
              color: listing.listing_type === "need_space" ? "#fff" : COLORS.ink,
              background: listing.listing_type === "need_space" ? COLORS.urgent : COLORS.danfo,
              textTransform: "uppercase",
            }}
          >
            {listing.listing_type === "need_space" ? "Need space" : "Have space"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.muted, fontSize: 13, marginBottom: 12 }}>
          <MapPin size={13} /> {listing.hall_name} {listing.duration && `· ${listing.duration}`}
        </div>

        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 20,
            color: COLORS.ink,
            background: "#fff",
            display: "inline-block",
            padding: "6px 14px",
            borderRadius: 6,
            marginBottom: 14,
          }}
        >
          {listing.price_label || (listing.price_amount ? `₦${Number(listing.price_amount).toLocaleString()}` : "Negotiable")}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {listing.owner?.is_verified && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: COLORS.verified, background: "#E6F2EE", padding: "4px 8px", borderRadius: 12 }}>
              <BadgeCheck size={12} /> {listing.owner?.is_student_email ? "Student email verified" : "Email verified"}
            </span>
          )}
          {listing.listing_type === "have_space" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: COLORS.verified, background: "#E6F2EE", padding: "4px 8px", borderRadius: 12 }}>
              <ShieldCheck size={12} /> Escrow protected
            </span>
          )}
        </div>

        {listing.caption && <p style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.5, marginBottom: 20 }}>{listing.caption}</p>}

        {!isOwnListing && listing.listing_type === "have_space" && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.verified, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
              <ShieldCheck size={16} /> Pay with escrow protection
            </div>
            <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
              Your payment is held safely and only released to {listing.owner?.full_name?.split(" ")[0]} once you confirm move-in. A small platform fee is deducted from the owner's payout, not added to what you pay.
            </p>
            {!listing.price_amount && (
              <input
                type="number"
                inputMode="numeric"
                placeholder="Amount to pay (₦)"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "11px 12px", fontSize: 16, marginBottom: 10 }}
              />
            )}
            <button
              onClick={startEscrowPayment}
              disabled={payLoading}
              style={{
                width: "100%",
                background: COLORS.danfo,
                border: "none",
                borderRadius: 8,
                padding: "12px 0",
                fontWeight: 800,
                fontSize: 13.5,
                color: COLORS.ink,
                cursor: "pointer",
                opacity: payLoading ? 0.7 : 1,
              }}
            >
              {payLoading ? "Starting payment..." : "Pay via escrow (Paystack)"}
            </button>
            {payError && <div style={{ color: COLORS.urgent, fontSize: 12, marginTop: 8 }}>{payError}</div>}
          </div>
        )}

        {!isOwnListing && (
          <button
            onClick={() => navigate(`/chat/${listing.id}/${listing.owner?.id}`)}
            style={{
              width: "100%",
              background: COLORS.ink,
              border: "none",
              borderRadius: 8,
              padding: "12px 0",
              fontWeight: 800,
              fontSize: 13.5,
              color: COLORS.danfo,
              cursor: "pointer",
            }}
          >
            Message {listing.owner?.full_name?.split(" ")[0]}
          </button>
        )}
      </div>
    </div>
  );
}
