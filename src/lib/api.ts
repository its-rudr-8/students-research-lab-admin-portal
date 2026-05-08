/**
 * API Client Service - Centralized API calls
 * All requests automatically include the auth token from localStorage
 */

const RAW_API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

const API_BASE_URL = RAW_API_BASE_URL.replace(/\/api\/?$/, "");

console.log("[API Client] Initialized with BASE_URL:", API_BASE_URL);

function getAuthToken(): string | null {
  try {
    const token = localStorage.getItem("adminToken") || localStorage.getItem("authToken");
    if (!token) {
      console.warn("[API] No token found in localStorage!");
    }
    return token;
  } catch (e) {
    console.error("[API] Error reading token from localStorage:", e);
    return null;
  }
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function apiCall<T>(
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<T> {
  const url = `${API_BASE_URL}/api${endpoint}`;
  const token = getAuthToken();
  const headers = getHeaders();
  
  console.log(`[API] ${method} ${endpoint}`, {
    url,
    tokenExists: !!token,
    tokenLength: token?.length,
    authHeader: headers["Authorization"]?.substring(0, 50),
  });

  const options: RequestInit = {
    method,
    headers: {
      ...headers,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    
    // Check if response is JSON
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`[API] Non-JSON response from ${endpoint}:`, {
        status: response.status,
        contentType,
        textSnippet: text.substring(0, 200),
      });
      throw new Error(`API returned non-JSON response (${response.status}): ${text.substring(0, 100)}`);
    }

    const data = await response.json();

    if (!response.ok) {
      console.error(`[API] Error from ${endpoint}:`, data);
      throw new Error(data.message || `API error: ${response.statusText}`);
    }

    console.log(`[API] Success from ${endpoint}:`, { statusCode: response.status, dataKeys: Object.keys(data) });
    return data;
  } catch (error: any) {
    console.error(`[API] Exception calling ${endpoint}:`, {
      message: error.message,
      url,
      token: token ? `${token.substring(0, 20)}...` : 'NO_TOKEN',
    });
    throw error;
  }
}

export async function getStudents() {
  const [res, leaderboardRes] = await Promise.all([
    apiCall<any>("/admin/students", "GET").catch(() => ({ data: [] })),
    apiCall<any>("/leaderboard", "GET").catch(() => ({ leaderboard: [] }))
  ]);

  const data = res?.data || (Array.isArray(res) ? res : []);
  const leaderboard = leaderboardRes?.leaderboard || (Array.isArray(leaderboardRes) ? leaderboardRes : []);
  
  const imageMap = new Map();
  leaderboard.forEach((r: any) => {
    if (r.enrollment_no && (r.photo || r.image || r.photo_url || r.photoUrl)) {
      imageMap.set(r.enrollment_no, r.photo || r.image || r.photo_url || r.photoUrl);
    }
  });

  return data.map((s: any) => ({
    ...s,
    photo_url: s.photo_url || s.image || s.photo || s.photoUrl || imageMap.get(s.enrollment_no)
  }));
}

export async function getStudent(enrollmentNo: string) {
  const res = await apiCall<any>(`/admin/students/${enrollmentNo}`, "GET");
  return res.data;
}

export async function createStudent(data: any) {
  const res = await apiCall<any>("/admin/students", "POST", data);
  return res.data;
}

export async function updateStudent(enrollmentNo: string, data: any) {
  const res = await apiCall<any>(`/admin/students/${enrollmentNo}`, "PUT", data);
  return res.data;
}

export async function deleteStudent(enrollmentNo: string) {
  const res = await apiCall<any>(`/admin/students/${enrollmentNo}`, "DELETE");
  return res.data;
}

// ============ ADMIN ACTIVITIES ============
export async function getActivities() {
  const res = await apiCall<any>("/admin/activities", "GET");
  return res.data || [];
}

export async function createActivity(data: any) {
  const res = await apiCall<any>("/admin/activities", "POST", data);
  return res.data;
}

export async function updateActivity(id: number, data: any) {
  const res = await apiCall<any>(`/admin/activities/${id}`, "PUT", data);
  return res.data;
}

export async function deleteActivity(id: number) {
  const res = await apiCall<any>(`/admin/activities/${id}`, "DELETE");
  return res.data;
}

// ============ ADMIN SCORES ============
export async function getScores() {
  const res = await apiCall<any>("/admin/scores", "GET");
  return res.data || [];
}

export async function createScores(data: any) {
  const res = await apiCall<any>("/admin/scores", "POST", data);
  return res.data;
}

// ============ ADMIN ATTENDANCE ============
export async function getAttendance() {
  const res = await apiCall<any>("/admin/attendance", "GET");
  return res.data || [];
}

export async function createAttendance(data: any) {
  const res = await apiCall<any>("/admin/attendance", "POST", data);
  return res.data;
}

// ============ ADMIN TIMELINE ============
export async function getTimeline() {
  const res = await apiCall<any>("/admin/timeline", "GET");
  return res.data || [];
}

export async function createTimeline(data: any) {
  const res = await apiCall<any>("/admin/timeline", "POST", data);
  return res.data;
}

export async function updateTimeline(id: number, data: any) {
  const res = await apiCall<any>(`/admin/timeline/${id}`, "PUT", data);
  return res.data;
}

export async function deleteTimeline(id: number) {
  const res = await apiCall<any>(`/admin/timeline/${id}`, "DELETE");
  return res.data;
}

// ============ ADMIN RESEARCH ============
export async function getResearch() {
  const res = await apiCall<any>("/admin/research", "GET");
  return res.data || [];
}

// ============ JOIN REQUESTS ============
export async function getJoinRequests() {
  const res = await apiCall<any>("/admin/join-requests", "GET");
  return res.data || [];
}

export async function updateJoinRequest(id: number, status: string) {
  const res = await apiCall<any>(`/admin/join-requests/${id}`, "PUT", { status });
  return res.data;
}

// ============ MEMBER CV ============
export async function getMemberCVByEnrollment(enrollmentNo: string) {
  const url = `/admin/member-cv?enrollment_no=${encodeURIComponent(enrollmentNo)}`;
  const res = await apiCall<any>(url, "GET");
  return res.data || null;
}

export async function updateMemberCV(data: any) {
  const res = await apiCall<any>("/admin/member-cv", "PUT", data);
  return res.data;
}

// ============ PUBLIC ENDPOINTS ============
export async function getPublicActivities() {
  const res = await apiCall<any>("/activities", "GET");
  return res.data || [];
}

export async function getPublicTimeline() {
  const res = await apiCall<any>("/timeline", "GET");
  return res.data || [];
}

export async function getPublicSessions() {
  const res = await apiCall<any>("/sessions", "GET");
  return res.data || [];
}

export async function getPublicAchievements() {
  const res = await apiCall<any>("/achievements", "GET");
  return res.data || [];
}

export async function getPublicPublications() {
  const res = await apiCall<any>("/publications", "GET");
  return res.data || [];
}

export async function getPublicResearchers() {
  const res = await apiCall<any>("/researchers", "GET");
  const data = res.data || (Array.isArray(res) ? res : (res.researchers ? res.researchers : []));
  return data.map((s: any) => ({
    ...s,
    photo_url: s.photo_url || s.image || s.photo || s.photoUrl
  }));
}
