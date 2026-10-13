import { apiClient } from "./client";

export const messagesApi = {
  send: (payload) => apiClient.post("/messages", payload).then((r) => r.data),

  getThread: (listingId, otherUserId) =>
    apiClient.get(`/messages/thread/${listingId}/${otherUserId}`).then((r) => r.data),

  getInbox: () => apiClient.get("/messages/inbox").then((r) => r.data),

  getConversations: () => apiClient.get("/messages/conversations").then((r) => r.data),

  getUnreadCount: () => apiClient.get("/messages/unread-count").then((r) => r.data),
};
