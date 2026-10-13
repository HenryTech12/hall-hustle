import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Bookmark, MapPin, BadgeCheck, Camera, Zap, Phone, Volume2, VolumeX } from "lucide-react";
import { COLORS, FONTS } from "../styles/tokens";
import { listingsApi } from "../api/listings";
import { useInView } from "../hooks/useInView";
import { useSoundPreference } from "../context/SoundPreferenceContext";
import { useAuth } from "../context/AuthContext";

function VerifiedBadge({ small }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", color: COLORS.verified }} title="Verified">
      <BadgeCheck size={small ? 13 : 15} strokeWidth={2.5} />
    </span>
  );
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function ListingCard({ listing, onInterestedChange }) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(Boolean(listing.is_interested_by_me));
  const [saved, setSaved] = useState(false);
  const [burst, setBurst] = useState(false);
  const [interestedCount, setInterestedCount] = useState(listing.interested_count || 0);

  const { soundEnabled, setSoundEnabled } = useSoundPreference();
  const { user: currentUser } = useAuth();
  const isOwnListing = listing.owner?.id === currentUser?.id;
  const [mediaRef, inView] = useInView(0.6);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const isVideo = listing.media_type === "video";

  // Play/pause exactly when this specific post scrolls into/out of focus —
  // this is the actual "only the focused post plays" behavior, matching
  // Instagram/TikTok rather than every post's media running at once.
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;

    if (inView) {
      if (video) video.play().catch(() => {});
      if (audio) audio.play().catch(() => {});
    } else {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }, [inView]);

  // Keep mute state in sync with the shared preference on every post,
  // rather than each post remembering its own — once you unmute one post,
  // the next one you scroll to also plays with sound immediately.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !soundEnabled;
    if (audioRef.current) audioRef.current.muted = !soundEnabled;
  }, [soundEnabled, inView]);

  const toggleInterested = async () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setInterestedCount((c) => (wasLiked ? Math.max(c - 1, 0) : c + 1));
    if (!wasLiked) {
      setBurst(true);
      setTimeout(() => setBurst(false), 650);
    }
    try {
      const res = wasLiked
        ? await listingsApi.unmarkInterested(listing.id)
        : await listingsApi.markInterested(listing.id);
      setInterestedCount(res.interested_count);
      setLiked(res.is_interested_by_me);
      onInterestedChange?.(listing.id, res.interested_count);
    } catch {
      setLiked(wasLiked);
      setInterestedCount((c) => (wasLiked ? c + 1 : Math.max(c - 1, 0)));
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    // This click is the "real user gesture" browsers require before they'll
    // allow audible playback at all — flipping the shared preference here
    // is what unlocks sound for every subsequent post this session, not
    // just this one.
    setSoundEnabled((s) => !s);
  };

  const priceLabel = listing.price_label || (listing.price_amount ? `₦${Number(listing.price_amount).toLocaleString()}` : "Negotiable");

  return (
    <div
      style={{
        background: COLORS.card,
        margin: "0 0 10px",
        borderTop: `1px solid ${COLORS.border}`,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
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
            {listing.owner?.full_name?.[0] || "?"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.ink }}>
                {listing.owner?.full_name?.split(" ").slice(0, 2).join(" ")}
              </span>
              {listing.owner?.is_verified && <VerifiedBadge small />}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, color: COLORS.muted }}>
              <MapPin size={11} /> {listing.hall_name} · {timeAgo(listing.created_at)}
            </div>
          </div>
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
            letterSpacing: "0.3px",
          }}
        >
          {listing.listing_type === "need_space" ? "Need space" : "Have space"}
        </span>
      </div>

      {/* Media area — photo, video, or placeholder. mediaRef is what the
          IntersectionObserver watches to decide if this post is "focused". */}
      <div
        ref={mediaRef}
        onDoubleClick={toggleInterested}
        onClick={() => navigate(`/listing/${listing.id}`)}
        style={{
          position: "relative",
          height: 210,
          background: !listing.photo_url
            ? "repeating-linear-gradient(135deg, #EFE4C8 0px, #EFE4C8 22px, #E7D8B4 22px, #E7D8B4 44px)"
            : isVideo
            ? "#000"
            : `url(${listing.photo_url}) center/cover no-repeat`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        {isVideo && listing.photo_url && (
          <video
            ref={videoRef}
            src={listing.photo_url}
            loop
            muted
            playsInline
            preload="auto"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {!listing.photo_url && (
          <div style={{ textAlign: "center", color: COLORS.muted }}>
            <Camera size={26} style={{ marginBottom: 4 }} />
            <div style={{ fontSize: 12 }}>Double-tap to mark interested</div>
          </div>
        )}

        {listing.music_url && (
          <>
            {/* preload="auto" starts buffering as soon as the card mounts
                (even before it's in view), so by the time someone scrolls
                to it, playback can start immediately instead of waiting
                to fetch the file from Cloudinary on demand. */}
            <audio ref={audioRef} src={listing.music_url} loop muted preload="auto" />
            <button
              onClick={toggleMute}
              style={{
                position: "absolute",
                bottom: 8,
                right: 8,
                background: "rgba(0,0,0,0.55)",
                border: "none",
                borderRadius: "50%",
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              aria-label={soundEnabled ? "Mute" : "Unmute"}
            >
              {soundEnabled ? <Volume2 size={15} color="#fff" /> : <VolumeX size={15} color="#fff" />}
            </button>
          </>
        )}

        {burst && (
          <Heart
            size={90}
            fill={COLORS.urgent}
            color={COLORS.urgent}
            style={{ position: "absolute", animation: "hh-pop 0.6s ease-out" }}
          />
        )}
        {listing.is_urgent && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: COLORS.urgent,
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              padding: "3px 7px",
              borderRadius: 3,
              letterSpacing: "0.4px",
            }}
          >
            URGENT
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 0" }}>
        <button onClick={toggleInterested} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <Heart size={23} color={liked ? COLORS.urgent : COLORS.ink} fill={liked ? COLORS.urgent : "none"} />
        </button>
        <button onClick={() => setSaved((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <Bookmark size={22} color={COLORS.ink} fill={saved ? COLORS.ink : "none"} />
        </button>
      </div>

      {/* Dual CTA — hidden on your own listing, since messaging yourself
          isn't meaningful. */}
      {!isOwnListing ? (
        <>
          <div style={{ display: "flex", gap: 8, padding: "10px 12px 0" }}>
            <button
              onClick={() => navigate(`/chat/${listing.id}/${listing.owner?.id}`)}
              style={{
                flex: 1.4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: COLORS.danfo,
                border: "none",
                borderRadius: 7,
                padding: "9px 0",
                cursor: "pointer",
              }}
            >
              <Zap size={14} color={COLORS.ink} fill={COLORS.ink} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.ink }}>Message in app</span>
            </button>
            <a
              href={`https://wa.me/${(listing.owner?.phone_number || "").replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: "transparent",
                border: `1.5px solid #CBBE9C`,
                borderRadius: 7,
                padding: "9px 0",
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              <Phone size={13} color={COLORS.muted} />
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted }}>WhatsApp</span>
            </a>
          </div>
          <div style={{ padding: "4px 12px 0", fontSize: 10.5, color: COLORS.verified, fontWeight: 700 }}>
            ⚡ In-app messages get replies fastest
          </div>
        </>
      ) : (
        <div style={{ padding: "10px 12px 0", fontSize: 11, color: COLORS.muted, fontStyle: "italic" }}>
          This is your listing — check your inbox for replies.
        </div>
      )}

      <div style={{ padding: "8px 12px 12px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.verified, marginBottom: 3 }}>
          {interestedCount} interested
        </div>
        {listing.caption && (
          <div style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.4 }}>{listing.caption}</div>
        )}
        <div
          style={{
            marginTop: 6,
            fontFamily: FONTS.display,
            fontSize: 14,
            color: COLORS.ink,
            background: COLORS.feedBg,
            display: "inline-block",
            padding: "3px 9px",
            borderRadius: 4,
          }}
        >
          {priceLabel}
        </div>
      </div>
    </div>
  );
}
