export type UserRole = "admin" | "member";

export interface UserSession {
  email: string;
  name: string;
  enrollmentNo?: string;
  role: UserRole;
}

const AUTH_TOKEN_KEY = "authToken";
const ADMIN_TOKEN_KEY = "adminToken";
const USER_DATA_KEY = "userData";

const decodeJwtPayload = (token: string): Record<string, any> | null => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  try {
    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    return Boolean(adminToken || authToken);
  } catch {
    return false;
  }
};

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const getStoredUser = (): UserSession | null => {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY) || "";
    const tokenPayload = token ? decodeJwtPayload(token) : null;

    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<UserSession>;
    if (!parsed.email) return null;

    return {
      email: parsed.email,
      name: parsed.name || parsed.email,
      enrollmentNo: (parsed as any).enrollmentNo || (parsed as any).enrollment_no || tokenPayload?.enrollmentNo || tokenPayload?.enrollment_no,
      role: parsed.role === "admin" ? "admin" : "member",
    };
  } catch {
    return null;
  }
};

export const hasWriteAccess = (): boolean => {
  const user = getStoredUser();
  return user?.role === "admin";
};

export const saveSession = (user: UserSession, token?: string) => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  localStorage.setItem("userEmail", user.email);
};

export const clearSession = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(USER_DATA_KEY);
  localStorage.removeItem("userEmail");
};
