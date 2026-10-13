import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, X, Music, Video } from "lucide-react";
import { listingsApi } from "../api/listings";
import { uploadsApi } from "../api/uploads";
import { extractErrorMessage } from "../api/client";
import { COLORS, FONTS } from "../styles/tokens";

export default function ComposePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const musicInputRef = useRef(null);

  const [listingType, setListingType] = useState("need_space");
  const [hallName, setHallName] = useState("");
  const [priceLabel, setPriceLabel] = useState("");
  const [duration, setDuration] = useState("");
  const [caption, setCaption] = useState("");
  const [isUrgent, setIsUrgent] = useState(true);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaKind, setMediaKind] = useState(null); // "image" | "video"
  const [musicFile, setMusicFile] = useState(null);
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    setMediaFile(file);
    setMediaKind(isVideo ? "video" : "image");
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleMusicSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMusicFile(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!hallName.trim()) {
      setError("Hall name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const listing = await listingsApi.create({
        listing_type: listingType,
        hall_name: hallName,
        price_label: priceLabel || undefined,
        duration: duration || undefined,
        caption: caption || undefined,
        is_urgent: isUrgent,
      });

      if (mediaFile) {
        setUploadStatus("Uploading photo/video...");
        try {
          const { photo_url, media_type } = await uploadsApi.uploadListingMedia(listing.id, mediaFile);
          await listingsApi.update(listing.id, { photo_url, media_type });
        } catch (err) {
          // Listing already exists — surface the failure instead of
          // silently posting without media, so the person knows to retry.
          setError(extractErrorMessage(err, "Photo/video upload failed, but your listing was posted without it. You can add it later."));
        }
      }

      if (musicFile) {
        setUploadStatus("Uploading music...");
        try {
          const { music_url } = await uploadsApi.uploadListingMusic(listing.id, musicFile);
          await listingsApi.update(listing.id, { music_url });
        } catch (err) {
          setError((prev) => prev || extractErrorMessage(err, "Music upload failed, but your listing was posted without it."));
        }
      }

      setUploadStatus("");
      navigate("/");
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't create listing."));
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 16,
    background: "#fff",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontFamily: FONTS.display, fontSize: 16, color: COLORS.ink, marginBottom: 14 }}>NEW LISTING</div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            height: 160,
            borderRadius: 10,
            border: `2px dashed #C9BB98`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: COLORS.muted,
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            background: mediaKind === "image" && mediaPreview ? `url(${mediaPreview}) center/cover no-repeat` : "#000",
          }}
        >
          {!mediaPreview && (
            <>
              <Camera size={26} />
              <span style={{ fontSize: 12.5 }}>Tap to add a photo or video</span>
            </>
          )}
          {mediaKind === "video" && mediaPreview && (
            <video src={mediaPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted loop autoPlay playsInline />
          )}
          {mediaPreview && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMediaFile(null);
                setMediaPreview(null);
                setMediaKind(null);
              }}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "rgba(0,0,0,0.6)",
                border: "none",
                borderRadius: "50%",
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 2,
              }}
            >
              <X size={16} color="#fff" />
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" onChange={handleFileSelect} style={{ display: "none" }} />

        <button
          type="button"
          onClick={() => musicInputRef.current?.click()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: `1px solid ${COLORS.border}`,
            background: musicFile ? COLORS.feedBg : "#fff",
            borderRadius: 8,
            padding: "10px 12px",
            cursor: "pointer",
            fontSize: 13,
            color: COLORS.ink,
          }}
        >
          <Music size={16} color={musicFile ? COLORS.verified : COLORS.muted} />
          {musicFile ? `Music added: ${musicFile.name}` : "Add background music (optional)"}
          {musicFile && (
            <X
              size={14}
              style={{ marginLeft: "auto" }}
              onClick={(e) => {
                e.stopPropagation();
                setMusicFile(null);
              }}
            />
          )}
        </button>
        <input ref={musicInputRef} type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/wav,audio/x-m4a,audio/aac" onChange={handleMusicSelect} style={{ display: "none" }} />
        <p style={{ fontSize: 11, color: COLORS.muted, marginTop: -8 }}>
          Only upload music you have the rights to use — same rule as any social app.
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setListingType("need_space")}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              border: `2px solid ${COLORS.urgent}`,
              background: listingType === "need_space" ? COLORS.urgent : "transparent",
              color: listingType === "need_space" ? "#fff" : COLORS.ink,
              fontWeight: 800,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            Need space
          </button>
          <button
            type="button"
            onClick={() => setListingType("have_space")}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              border: `2px solid ${COLORS.danfo}`,
              background: listingType === "have_space" ? COLORS.danfo : "transparent",
              color: COLORS.ink,
              fontWeight: 800,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            Have space
          </button>
        </div>

        <input style={inputStyle} placeholder="Hall name (e.g. Moremi Hall)" value={hallName} onChange={(e) => setHallName(e.target.value)} required />
        <input style={inputStyle} placeholder="Price (e.g. ₦150,000 / semester)" value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} />
        <input style={inputStyle} placeholder="Duration (e.g. rest of session)" value={duration} onChange={(e) => setDuration(e.target.value)} />
        <textarea
          style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
          placeholder="Caption — tell people what's going on"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: COLORS.ink }}>
          <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} style={{ accentColor: COLORS.verified }} />
          Mark as urgent — appears in the stories bar
        </label>

        {error && <div style={{ color: COLORS.urgent, fontSize: 12.5 }}>{error}</div>}
        {uploadStatus && <div style={{ color: COLORS.verified, fontSize: 12.5 }}>{uploadStatus}</div>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            background: COLORS.danfo,
            border: "none",
            color: COLORS.ink,
            fontWeight: 800,
            fontSize: 13.5,
            padding: "13px 0",
            borderRadius: 8,
            cursor: "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Posting..." : "Post listing"}
        </button>
      </form>
    </div>
  );
}
