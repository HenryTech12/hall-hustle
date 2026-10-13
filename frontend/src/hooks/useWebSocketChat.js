import { useEffect, useRef, useState, useCallback } from "react";
import { API_BASE_URL } from "../api/client";
import { messagesApi } from "../api/messages";

export function useWebSocketChat(listingId, otherUserId, token) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const pollRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      const history = await messagesApi.getThread(listingId, otherUserId);
      setMessages(history);
    } catch {
      // Leave existing messages as-is if history fails to load
    }
  }, [listingId, otherUserId]);

  useEffect(() => {
    if (!listingId || !otherUserId || !token) return;

    loadHistory();

    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + `/messages/ws/${listingId}/${otherUserId}?token=${token}`;
    let socket;
    try {
      socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        // Fall back to polling every 4s if the socket drops, so chat still
        // works even if WebSockets are blocked by a network/proxy.
        pollRef.current = setInterval(loadHistory, 4000);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setMessages((prev) => [...prev, payload]);
        } catch {
          // ignore malformed frames
        }
      };
    } catch {
      pollRef.current = setInterval(loadHistory, 4000);
    }

    return () => {
      socket?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, otherUserId, token]);

  const sendMessage = useCallback(
    async (body) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ body }));
      } else {
        // Polling fallback: send over REST, then refresh history
        try {
          const sent = await messagesApi.send({ listing_id: listingId, receiver_id: otherUserId, body });
          setMessages((prev) => [...prev, sent]);
        } catch {
          // swallow — UI can show a retry affordance later if needed
        }
      }
    },
    [listingId, otherUserId]
  );

  return { messages, sendMessage, connected };
}
