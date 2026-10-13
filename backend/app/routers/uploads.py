from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status

from app import models, schemas
from app.deps import get_current_verified_user
from app.services.cloudinary_service import (
    upload_listing_media,
    upload_listing_music,
    CloudinaryError,
)

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8MB for photos
MAX_VIDEO_BYTES = 50 * 1024 * 1024  # 50MB for videos
MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10MB for music tracks

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "audio/x-m4a", "audio/aac"}


@router.post("/listing-media/{listing_id}", response_model=schemas.MediaUploadResponse)
async def upload_media(
    listing_id: str,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_verified_user),
):
    """
    Uploads either a photo or a video for a listing and returns the URL to
    attach via PATCH /listings/{listing_id} along with the detected
    media_type ("image" or "video"), so the frontend knows whether to
    render an <img> or a <video>.
    """
    is_video = file.content_type in ALLOWED_VIDEO_TYPES
    is_image = file.content_type in ALLOWED_IMAGE_TYPES

    if not is_video and not is_image:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG/PNG/WebP/HEIC for photos or MP4/MOV/WebM for video.",
        )

    contents = await file.read()
    size_limit = MAX_VIDEO_BYTES if is_video else MAX_UPLOAD_BYTES
    if len(contents) > size_limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File must be under {size_limit // (1024 * 1024)}MB.",
        )

    try:
        url = await upload_listing_media(contents, listing_id=listing_id, is_video=is_video)
    except CloudinaryError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return schemas.MediaUploadResponse(photo_url=url, media_type="video" if is_video else "image")


@router.post("/listing-music/{listing_id}", response_model=schemas.MusicUploadResponse)
async def upload_music(
    listing_id: str,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_verified_user),
):
    """
    Uploads an optional background audio track for a listing (played back
    muted-by-default in the feed, like Reels/TikTok, with a tap-to-unmute
    control — browsers block audible autoplay regardless).

    Only upload audio you have the rights to use — copyrighted music you
    don't own the rights to can get a listing taken down or the account
    flagged, same as on any social platform.
    """
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported audio type: {file.content_type}. Use MP3, M4A, WAV, or AAC.",
        )

    contents = await file.read()
    if len(contents) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio must be under {MAX_AUDIO_BYTES // (1024 * 1024)}MB.",
        )

    try:
        url = await upload_listing_music(contents, listing_id=listing_id)
    except CloudinaryError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return schemas.MusicUploadResponse(music_url=url)
