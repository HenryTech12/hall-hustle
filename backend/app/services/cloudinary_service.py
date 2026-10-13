"""
Thin wrapper around Cloudinary's upload API for listing photos.
Docs: https://cloudinary.com/documentation/upload_images

Using the official SDK's uploader — it handles auth signing internally
once configured. We wrap it in a small async-friendly function since
FastAPI route handlers here are async.
"""

import asyncio

import cloudinary
import cloudinary.uploader

from app.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)


class CloudinaryError(Exception):
    pass


async def upload_listing_photo(file_bytes: bytes, listing_id: str) -> str:
    """
    Uploads raw image bytes to Cloudinary under a HallHustle-specific
    folder and returns the resulting secure HTTPS URL to store on the
    Listing.photo_url field.
    """
    loop = asyncio.get_event_loop()

    def _do_upload():
        return cloudinary.uploader.upload(
            file_bytes,
            folder="hallhustle/listings",
            public_id=listing_id,
            overwrite=True,
            resource_type="image",
            transformation=[
                {"width": 1080, "height": 1080, "crop": "limit"},
                {"quality": "auto:good"},
            ],
        )

    try:
        result = await loop.run_in_executor(None, _do_upload)
    except Exception as e:
        raise CloudinaryError(f"Cloudinary upload failed: {e}") from e

    return result["secure_url"]


async def upload_listing_media(file_bytes: bytes, listing_id: str, is_video: bool) -> str:
    """
    Uploads either an image or a video for a listing. Cloudinary needs
    resource_type="video" set explicitly for video files (it does not
    reliably auto-detect from raw bytes alone the way it can from a
    file path), while images use resource_type="image" as before.
    """
    loop = asyncio.get_event_loop()

    def _do_upload():
        if is_video:
            return cloudinary.uploader.upload(
                file_bytes,
                folder="hallhustle/listings",
                public_id=listing_id,
                overwrite=True,
                resource_type="video",
                transformation=[
                    {"width": 1080, "height": 1920, "crop": "limit"},
                    {"quality": "auto:good"},
                ],
                eager=[{"format": "mp4"}],
            )
        return cloudinary.uploader.upload(
            file_bytes,
            folder="hallhustle/listings",
            public_id=listing_id,
            overwrite=True,
            resource_type="image",
            transformation=[
                {"width": 1080, "height": 1080, "crop": "limit"},
                {"quality": "auto:good"},
            ],
        )

    try:
        result = await loop.run_in_executor(None, _do_upload)
    except Exception as e:
        raise CloudinaryError(f"Cloudinary upload failed: {e}") from e

    return result["secure_url"]


async def upload_listing_music(file_bytes: bytes, listing_id: str) -> str:
    """
    Uploads a background audio track for a listing. Cloudinary treats
    audio as resource_type="video" internally (it's the bucket that
    handles all non-image media), which is expected, not a bug.
    """
    loop = asyncio.get_event_loop()

    def _do_upload():
        return cloudinary.uploader.upload(
            file_bytes,
            folder="hallhustle/music",
            public_id=f"{listing_id}-music",
            overwrite=True,
            resource_type="video",  # audio lives under Cloudinary's "video" resource type
        )

    try:
        result = await loop.run_in_executor(None, _do_upload)
    except Exception as e:
        raise CloudinaryError(f"Cloudinary music upload failed: {e}") from e

    return result["secure_url"]
