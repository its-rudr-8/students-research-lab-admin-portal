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
    const authenticated = Boolean(adminToken || authToken);
    
    if (authenticated) {
      const type = adminToken ? "👑 ADMIN" : "👤 USER";
      console.log(`[Auth] ✅ ${type} is authenticated`);
    }
    
    return authenticated;
  } catch (error) {
    console.error("[Auth] ❌ Error checking authentication:", error);
    return false;
  }
};

export const getAuthToken = (): string | null => {
  try {
    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const token = adminToken || authToken;
    
    if (!token) {
      console.warn("[Auth] ⚠️ No token found");
      return null;
    }
    
    return token;
  } catch (error) {
    console.error("[Auth] ❌ Error retrieving token:", error);
    return null;
  }
};

export const getStoredUser = (): UserSession | null => {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY) || "";
    const tokenPayload = token ? decodeJwtPayload(token) : null;
    
    if (!raw) {
      console.log("[Auth] ❌ No user data in storage");
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<UserSession>;
    
    if (!parsed.email) {
      console.warn("[Auth] ❌ No email found in parsed data");
      return null;
    }

    const user: UserSession = {
      email: parsed.email,
      name: parsed.name || parsed.email,
      enrollmentNo: parsed.enrollmentNo || parsed.enrollment_no || tokenPayload?.enrollmentNo || tokenPayload?.enrollment_no,
      role: parsed.role === "admin" ? "admin" : "member",
    };
    
    const roleEmoji = user.role === "admin" ? "👑 ADMIN" : "👤 USER";
    console.log(`[Auth] ✅ ${roleEmoji} | Email: ${user.email}`);
    return user;
  } catch (error) {
    console.error("[Auth] ❌ Error parsing stored user:", error);
    return null;
  }
};

export const hasWriteAccess = (): boolean => {
  const user = getStoredUser();
  const hasAccess = user?.role === "admin";
  
  if (hasAccess) {
    console.log(`[Auth] 👑 ADMIN ACCESS GRANTED - ${user?.email}`);
  } else {
    console.log(`[Auth] 👤 USER - Read-only access - ${user?.email}`);
  }
  
  return hasAccess;
};

export const saveSession = (user: UserSession, token?: string) => {
  const roleEmoji = user.role === "admin" ? "👑 ADMIN LOGIN" : "👤 USER LOGIN";
  console.log(`[Auth] ✅ ${roleEmoji} - ${user.email}`);
  
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    console.log("[Auth] 🔐 Token stored");
  }
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  localStorage.setItem("userEmail", user.email);
  // Note: Admin token is saved separately by setAuthToken() in adminApi.ts
};

export const clearSession = () => {
  const user = getStoredUser();
  const roleEmoji = user?.role === "admin" ? "👑 ADMIN" : "👤 USER";
  console.log(`[Auth] 🚪 ${roleEmoji} logged out - ${user?.email}`);
  
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(USER_DATA_KEY);
  localStorage.removeItem("userEmail");
  console.log("[Auth] ✅ All session data cleared");
};
