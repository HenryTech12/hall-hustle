import { apiClient } from "./client";

export const authApi = {
  signup: (payload) => apiClient.post("/auth/signup", payload).then((r) => r.data),

  verifyOtp: (payload) => apiClient.post("/auth/verify-otp", payload).then((r) => r.data),

  resendOtp: (payload) => apiClient.post("/auth/resend-otp", payload).then((r) => r.data),

  login: (payload) => apiClient.post("/auth/login", payload).then((r) => r.data),

  me: () => apiClient.get("/auth/me").then((r) => r.data),

  setBankDetails: (payload) => apiClient.post("/auth/bank-details", payload).then((r) => r.data),
};
