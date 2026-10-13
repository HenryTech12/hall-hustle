import { apiClient } from "./client";

export const usersApi = {
  getPublicProfile: (userId) => apiClient.get(`/users/${userId}`).then((r) => r.data),
};
