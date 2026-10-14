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
  // Remember what already succeeded so "Retry upload" doesn't create a duplicate listing.
  const [createdId, setCreatedId] = useState(null);
  const [mediaDone, setMediaDone] = useState(false);
  const [musicDone, setMusicDone] = useState(false);

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
      let id = createdId;
      if (!id) {
        // "300,000" or "₦300000" -> 300000, so escrow can pre-fill the amount
        const digits = priceLabel.replace(/[^\d]/g, "");
        const listing = await listingsApi.create({
          listing_type: listingType,
          hall_name: hallName,
          price_amount: digits ? Number(digits) : undefined,
          price_label: priceLabel || undefined,
          duration: duration || undefined,
          caption: caption || undefined,
          is_urgent: isUrgent,
        });
        id = listing.id;
        setCreatedId(id);
      }

      let failed = false;

      if (mediaFile && !mediaDone) {
        setUploadStatus("Uploading photo/video...");
        try {
          const { photo_url, media_type } = await uploadsApi.uploadListingMedia(id, mediaFile);
          await listingsApi.update(id, { photo_url, media_type });
          setMediaDone(true);
        } catch (err) {
          failed = true;
          setError(extractErrorMessage(err, "Photo/video upload failed."));
        }
      }

      if (musicFile && !musicDone) {
        setUploadStatus("Uploading music...");
        try {
          const { music_url } = await uploadsApi.uploadListingMusic(id, musicFile);
          await listingsApi.update(id, { music_url });
          setMusicDone(true);
        } catch (err) {
          failed = true;
          setError((prev) => prev || extractErrorMessage(err, "Music upload failed."));
        }
      }

      if (failed) {
        // Stay on this page so the error is actually seen, and offer a retry.
        setUploadStatus("");
        return;
      }

      setUploadStatus(mediaFile || musicFile ? "Posted with your upload ✓" : "Posted ✓");
      await new Promise((r) => setTimeout(r, 900));
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

        {error && <div style={{ color: COLORS.urgent, fontSize: 13, fontWeight: 700, background: "#FBE9E4", padding: 10, borderRadius: 8 }}>{error}{createdId ? " Your listing was posted without it." : ""}</div>}
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
          {submitting ? "Posting..." : createdId ? "Retry upload" : "Post listing"}
        </button>
        {createdId && !submitting && (
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{ background: "none", border: "none", fontWeight: 700, fontSize: 13, color: COLORS.muted, cursor: "pointer" }}
          >
            Skip upload and go to feed
          </button>
        )}
      </form>
    </div>
  );
}
