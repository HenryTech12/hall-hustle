import { useEffect, useState } from "react";
import { messagesApi } from "../api/messages";
import { useAuth } from "../context/AuthContext";

/**
 * Polls the unread message count periodically so the inbox tab/icon can
 * show a WhatsApp-style badge without the person needing to open the
 * inbox first to find out they have new messages.
 */
export function useUnreadCount(pollMs = 15000) {
  const { token } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const fetchCount = () => {
      messagesApi
        .getUnreadCount()
        .then((res) => {
          if (!cancelled) setCount(res.count);
        })
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, pollMs]);

  return count;
}
