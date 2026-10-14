import { apiClient } from "./client";

export const paymentsApi = {
  initializeEscrow: (payload) =>
    apiClient.post("/payments/escrow/initialize", payload).then((r) => r.data),

  getEscrow: (id) => apiClient.get(`/payments/escrow/${id}`).then((r) => r.data),

  listMine: () => apiClient.get("/payments/escrow").then((r) => r.data),

  // Asks the backend to check the charge directly with Paystack (works even if the webhook is late).
  verifyReference: (reference) =>
    apiClient.post(`/payments/verify/${encodeURIComponent(reference)}`).then((r) => r.data),

  release: (id) => apiClient.post(`/payments/escrow/${id}/release`).then((r) => r.data),

  dispute: (id, reason) =>
    apiClient.post(`/payments/escrow/${id}/dispute`, { reason }).then((r) => r.data),

  getBanks: () => apiClient.get("/payments/banks").then((r) => r.data),
};
