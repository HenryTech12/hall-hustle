import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("hh_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("hh_token");
      localStorage.removeItem("hh_user");
      // Let the app redirect naturally via ProtectedRoute rather than
      // forcing a hard reload here.
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  return error?.response?.data?.detail || error?.message || fallback;
}
