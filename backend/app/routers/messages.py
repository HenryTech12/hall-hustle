from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db, SessionLocal
from app.deps import get_current_verified_user
from app.security import decode_access_token

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("", response_model=schemas.MessageOut, status_code=201)
def send_message(
    payload: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == payload.listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    receiver = db.query(models.User).filter(models.User.id == payload.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient not found")

    message = models.Message(
        listing_id=payload.listing_id,
        sender_id=current_user.id,
        receiver_id=payload.receiver_id,
        body=payload.body,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.get("/thread/{listing_id}/{other_user_id}", response_model=list[schemas.MessageOut])
def get_thread(
    listing_id: str,
    other_user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """All messages between the current user and other_user_id, scoped to one listing."""
    messages = (
        db.query(models.Message)
        .filter(
            models.Message.listing_id == listing_id,
            or_(
                and_(
                    models.Message.sender_id == current_user.id,
                    models.Message.receiver_id == other_user_id,
                ),
                and_(
                    models.Message.sender_id == other_user_id,
                    models.Message.receiver_id == current_user.id,
                ),
            ),
        )
        .order_by(models.Message.created_at.asc())
        .all()
    )

    # Mark incoming messages as read
    unread_ids = [
        m.id for m in messages if m.receiver_id == current_user.id and m.read_at is None
    ]
    if unread_ids:
        db.query(models.Message).filter(models.Message.id.in_(unread_ids)).update(
            {"read_at": datetime.utcnow()}, synchronize_session=False
        )
        db.commit()

    return messages


@router.get("/inbox", response_model=list[schemas.MessageOut])
def get_inbox(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """Most recent message per conversation — enough for a simple inbox list on MVP."""
    return (
        db.query(models.Message)
        .filter(
            or_(
                models.Message.sender_id == current_user.id,
                models.Message.receiver_id == current_user.id,
            )
        )
        .order_by(models.Message.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/conversations", response_model=list[schemas.ConversationOut])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """
    WhatsApp-style conversation list: one row per (listing, other person)
    pair, showing who you're actually talking to, their last message, when,
    and how many of their messages you haven't read yet — instead of the
    raw message rows the old /inbox endpoint returns, which forced the
    frontend to guess at names and unread state.
    """
    messages = (
        db.query(models.Message)
        .options(joinedload(models.Message.listing))
        .filter(
            or_(
                models.Message.sender_id == current_user.id,
                models.Message.receiver_id == current_user.id,
            )
        )
        .order_by(models.Message.created_at.desc())
        .limit(500)  # plenty for an MVP inbox; revisit if power users hit this
        .all()
    )

    conversations: dict[tuple[str, str], dict] = {}
    unread_counts: dict[tuple[str, str], int] = {}

    for m in messages:
        other_id = m.receiver_id if m.sender_id == current_user.id else m.sender_id
        key = (m.listing_id, other_id)

        if m.receiver_id == current_user.id and m.read_at is None:
            unread_counts[key] = unread_counts.get(key, 0) + 1

        if key not in conversations:
            conversations[key] = {
                "listing_id": m.listing_id,
                "other_user_id": other_id,
                "last_message": m.body,
                "last_message_at": m.created_at,
                "last_message_is_mine": m.sender_id == current_user.id,
            }

    if not conversations:
        return []

    other_user_ids = {v["other_user_id"] for v in conversations.values()}
    users_by_id = {
        u.id: u for u in db.query(models.User).filter(models.User.id.in_(other_user_ids)).all()
    }
    listing_ids = {v["listing_id"] for v in conversations.values()}
    halls_by_listing = {
        l.id: l.hall_name for l in db.query(models.Listing).filter(models.Listing.id.in_(listing_ids)).all()
    }

    results = []
    for key, convo in conversations.items():
        other_user = users_by_id.get(convo["other_user_id"])
        if not other_user:
            continue  # user account no longer exists; skip rather than error
        results.append(
            schemas.ConversationOut(
                listing_id=convo["listing_id"],
                hall_name=halls_by_listing.get(convo["listing_id"]),
                other_user=schemas.ConversationParticipant.model_validate(other_user),
                last_message=convo["last_message"],
                last_message_at=convo["last_message_at"],
                last_message_is_mine=convo["last_message_is_mine"],
                unread_count=unread_counts.get(key, 0),
            )
        )

    results.sort(key=lambda c: c.last_message_at, reverse=True)
    return results


@router.get("/unread-count", response_model=schemas.UnreadCountOut)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_verified_user),
):
    """Powers a small unread badge on the inbox tab/icon, WhatsApp-style."""
    count = (
        db.query(models.Message)
        .filter(models.Message.receiver_id == current_user.id, models.Message.read_at.is_(None))
        .count()
    )
    return schemas.UnreadCountOut(count=count)


# ---------------------------------------------------------------------------
# Real-time chat over WebSockets.
#
# The polling endpoints above (GET /messages/thread/...) still work fine and
# are what a simple MVP client can rely on. This adds a push-based option
# for when conversation volume makes polling wasteful — connect once per
# open chat thread and receive new messages instantly instead of polling.
#
# Auth note: browsers can't set custom headers on a WebSocket handshake, so
# the JWT is passed as a query param instead of an Authorization header.
# That's the standard workaround for WS auth, but it does mean the token
# can end up in server access logs — use short-lived tokens for this if
# that's a concern for you.
# ---------------------------------------------------------------------------


class ConnectionManager:
    def __init__(self):
        # room_key -> list of active sockets in that listing+pair thread
        self.active: dict[str, list[WebSocket]] = {}

    def _room_key(self, listing_id: str, user_a: str, user_b: str) -> str:
        # Order-independent so both participants land in the same room
        pair = "-".join(sorted([user_a, user_b]))
        return f"{listing_id}:{pair}"

    async def connect(self, websocket: WebSocket, listing_id: str, user_a: str, user_b: str):
        await websocket.accept()
        key = self._room_key(listing_id, user_a, user_b)
        self.active.setdefault(key, []).append(websocket)

    def disconnect(self, websocket: WebSocket, listing_id: str, user_a: str, user_b: str):
        key = self._room_key(listing_id, user_a, user_b)
        if key in self.active and websocket in self.active[key]:
            self.active[key].remove(websocket)
            if not self.active[key]:
                del self.active[key]

    async def broadcast(self, listing_id: str, user_a: str, user_b: str, payload: dict):
        key = self._room_key(listing_id, user_a, user_b)
        for socket in self.active.get(key, []):
            await socket.send_json(payload)


manager = ConnectionManager()


@router.websocket("/ws/{listing_id}/{other_user_id}")
async def chat_websocket(
    websocket: WebSocket,
    listing_id: str,
    other_user_id: str,
    token: str = Query(...),
):
    user_id = decode_access_token(token)
    if not user_id:
        await websocket.close(code=4401)  # custom code: unauthorized
        return

    db = SessionLocal()
    try:
        current_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not current_user or not current_user.is_verified:
            await websocket.close(code=4403)
            return

        listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
        other_user = db.query(models.User).filter(models.User.id == other_user_id).first()
        if not listing or not other_user:
            await websocket.close(code=4404)
            return

        await manager.connect(websocket, listing_id, user_id, other_user_id)

        try:
            while True:
                data = await websocket.receive_json()
                body = (data or {}).get("body", "").strip()
                if not body:
                    continue

                message = models.Message(
                    listing_id=listing_id,
                    sender_id=user_id,
                    receiver_id=other_user_id,
                    body=body,
                )
                db.add(message)
                db.commit()
                db.refresh(message)

                await manager.broadcast(
                    listing_id,
                    user_id,
                    other_user_id,
                    {
                        "id": message.id,
                        "listing_id": listing_id,
                        "sender_id": user_id,
                        "receiver_id": other_user_id,
                        "body": body,
                        "created_at": message.created_at.isoformat(),
                    },
                )
        except WebSocketDisconnect:
            manager.disconnect(websocket, listing_id, user_id, other_user_id)
    finally:
        db.close()
