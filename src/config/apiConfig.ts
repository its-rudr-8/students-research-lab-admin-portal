/**
 * Shared API configuration
 * Used across all API service modules.
 */

const envBase =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "";

// Dev: same-origin via Vite proxy (/api → backend) so EventSource works without CORS issues.
// Set VITE_USE_DIRECT_API=true in .env to hit the backend URL directly instead.
const useDevProxy =
  import.meta.env.DEV && import.meta.env.VITE_USE_DIRECT_API !== "true";

const RAW_BASE = useDevProxy
  ? ""
  : envBase || "http://127.0.0.1:8000/api";

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
