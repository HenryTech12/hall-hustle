import { apiClient } from "./client";

export const listingsApi = {
  browse: (params = {}) => apiClient.get("/listings", { params }).then((r) => r.data),

  getUrgent: () => apiClient.get("/listings/urgent").then((r) => r.data),

  getOne: (id) => apiClient.get(`/listings/${id}`).then((r) => r.data),

  create: (payload) => apiClient.post("/listings", payload).then((r) => r.data),

  update: (id, payload) => apiClient.patch(`/listings/${id}`, payload).then((r) => r.data),

  markInterested: (id) => apiClient.post(`/listings/${id}/interested`).then((r) => r.data),

  unmarkInterested: (id) => apiClient.delete(`/listings/${id}/interested`).then((r) => r.data),

  remove: (id) => apiClient.delete(`/listings/${id}`),
};
