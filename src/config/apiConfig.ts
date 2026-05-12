/**
 * Shared API configuration
 * Used across all API service modules.
 */

const RAW_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

// Strip trailing /api and slashes so callers can append /api/... themselves
export const API_BASE_URL = RAW_BASE.replace(/\/api\/?$/, "").replace(/\/+$/, "");

export const API_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

/** Returns headers with Authorization bearer token appended. */
export const authHeaders = (token: string): Record<string, string> => ({
  ...API_HEADERS,
  Authorization: `Bearer ${token}`,
});
