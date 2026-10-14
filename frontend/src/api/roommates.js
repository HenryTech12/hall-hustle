import { apiClient } from "./client";

export const roommatesApi = {
  getMine: () => apiClient.get("/roommates/me").then((r) => r.data),
  saveMine: (payload) => apiClient.put("/roommates/me", payload).then((r) => r.data),
  getMatches: (limit = 20) => apiClient.get("/roommates/matches", { params: { limit } }).then((r) => r.data),
  score: (userId) => apiClient.get(`/roommates/score/${userId}`).then((r) => r.data),
};
