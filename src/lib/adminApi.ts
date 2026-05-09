/**
 * Admin API Client Service
 * Centralized API client for all admin CRUD operations
 */

const RAW_API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

const API_BASE_URL = RAW_API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/+$/, "");

// Get token from localStorage
const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem("adminToken") || localStorage.getItem("authToken");
  } catch {
    return null;
  }
};

// Set token in localStorage
export const setAuthToken = (token: string) => {
  try {
    localStorage.setItem("adminToken", token);
    localStorage.setItem("authToken", token);
  } catch (error) {
    console.error("Failed to save auth token:", error);
  }
};

// Clear token from localStorage
export const clearAuthToken = () => {
  try {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("authToken");
  } catch (error) {
    console.error("Failed to clear auth token:", error);
  }
};

// Helper function to make API calls
const apiCall = async (
  endpoint: string,
  method: string = "GET",
  body?: unknown
): Promise<any> => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (!endpoint.includes("/login")) {
    // If no token and not logging in, this will fail with 401
    console.warn("No auth token found for protected endpoint:", endpoint);
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const fullUrl = `${API_BASE_URL}/api${endpoint}`;
    console.debug(`[API] ${method} ${endpoint}${token ? " (with token)" : " (no token)"}`);
    
    const response = await fetch(fullUrl, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      console.error(`[API Error] ${method} ${endpoint} - Status: ${response.status}`, errorData);
      
      // Handle 401 - clear token and redirect to login
      if (response.status === 401) {
        console.error("Unauthorized (401) - clearing token and redirecting to login");
        clearAuthToken();
        // Redirect to login page
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new Error("Session expired. Please log in again.");
      }
      
      throw new Error(errorData.message || `API Error: ${response.statusText}`);
    }

    const data = await response.json();
    console.debug(`[API Success] ${method} ${endpoint}`);
    return data;
  } catch (error: any) {
    // Re-throw with better error messages
    throw error;
  }
};

export const adminAPI = {
  // Authentication APIs
  async login(email: string, password: string) {
    return apiCall("/admin/login", "POST", { email, password });
  },

  async verifyToken() {
    return apiCall("/admin/verify", "POST");
  },

  // Students APIs
  async getStudents() {
    const [res, leaderboardRes] = await Promise.all([
      apiCall("/admin/students").catch(() => null),
      apiCall("/leaderboard").catch(() => null)
    ]);

    const leaderboard = leaderboardRes?.leaderboard || (Array.isArray(leaderboardRes) ? leaderboardRes : []);
    const imageMap = new Map();
    leaderboard.forEach((r: any) => {
      if (r.enrollment_no && (r.photo || r.image || r.photo_url || r.photoUrl)) {
        imageMap.set(r.enrollment_no, r.photo || r.image || r.photo_url || r.photoUrl);
      }
    });

    if (res && Array.isArray(res.data)) {
      res.data = res.data.map((s: any) => ({
        ...s,
        photo_url: s.photo_url || s.image || s.photo || s.photoUrl || imageMap.get(s.enrollment_no)
      }));
    } else if (Array.isArray(res)) {
      return res.map((s: any) => ({
        ...s,
        photo_url: s.photo_url || s.image || s.photo || s.photoUrl || imageMap.get(s.enrollment_no)
      }));
    }
    return res;
  },

  async getStudent(enrollmentNo: string) {
    return apiCall(`/admin/students/${enrollmentNo}`);
  },

  async createStudent(data: any) {
    return apiCall("/admin/students", "POST", data);
  },

  async updateStudent(enrollmentNo: string, data: any) {
    return apiCall(`/admin/students/${enrollmentNo}`, "PUT", data);
  },

  async deleteStudent(enrollmentNo: string) {
    return apiCall(`/admin/students/${enrollmentNo}`, "DELETE");
  },

  // Activities APIs
  async getActivities() {
    return apiCall("/admin/activities");
  },

  async createActivity(data: any) {
    return apiCall("/admin/activities", "POST", data);
  },

  async updateActivity(id: string, data: any) {
    return apiCall(`/admin/activities/${id}`, "PUT", data);
  },

  async deleteActivity(id: string) {
    return apiCall(`/admin/activities/${id}`, "DELETE");
  },

  // Scores APIs
  async getScores(month?: string, year?: number) {
    let endpoint = "/admin/scores";
    if (month && year) {
      endpoint += `?month=${month}&year=${year}`;
    }
    return apiCall(endpoint);
  },

  async getScoresByStudent(enrollmentNo: string) {
    return apiCall(`/admin/scores/${enrollmentNo}`);
  },

  async createScore(data: any) {
    return apiCall("/admin/scores", "POST", data);
  },

  async updateScore(id: string, data: any) {
    return apiCall(`/admin/scores/${id}`, "PUT", data);
  },

  async deleteScore(id: string) {
    return apiCall(`/admin/scores/${id}`, "DELETE");
  },

  // Leaderboard APIs (Mirroring public endpoints for accurate dashboard metrics)
  async getLeaderboard() {
    return apiCall("/leaderboard");
  },

  async getMonthlyLeaderboard(month?: string | number, year?: number) {
    let endpoint = "/leaderboard/monthly";
    if (month && year) {
      endpoint += `?month=${month}&year=${year}`;
    }
    return apiCall(endpoint);
  },

  async getTopHoursLeaderboard(month?: string | number, year?: number) {
    let endpoint = "/leaderboard/top-hours";
    if (month && year) {
      endpoint += `?month=${month}&year=${year}`;
    }
    return apiCall(endpoint);
  },

  // Attendance APIs
  async getAttendance() {
    return apiCall("/admin/attendance");
  },

  async getAttendanceByStudent(enrollmentNo: string) {
    return apiCall(`/admin/attendance/student/${enrollmentNo}`);
  },

  async markAttendance(data: any) {
    return apiCall("/admin/attendance", "POST", data);
  },

  async updateAttendance(id: string, data: any) {
    return apiCall(`/admin/attendance/${id}`, "PUT", data);
  },

  async deleteAttendance(id: string) {
    return apiCall(`/admin/attendance/${id}`, "DELETE");
  },

  // Timeline APIs
  async getTimeline() {
    return apiCall("/admin/timeline");
  },

  async createTimelineEntry(data: any) {
    return apiCall("/admin/timeline", "POST", data);
  },

  async updateTimelineEntry(id: string, data: any) {
    return apiCall(`/admin/timeline/${id}`, "PUT", data);
  },

  async deleteTimelineEntry(id: string) {
    return apiCall(`/admin/timeline/${id}`, "DELETE");
  },


  // Publication APIs
  // Publication APIs
  async getPublications(status?: string) {
    let endpoint = "/admin/publication";
    if (status) {
      endpoint += `?status=${status}`;
    }
    return apiCall(endpoint);
  },

  async getPublication(id: string) {
    return apiCall(`/admin/publication/${id}`);
  },

  async createPublication(data: any) {
    return apiCall("/admin/publication", "POST", data);
  },

  async updatePublication(id: string, data: any) {
    return apiCall(`/admin/publication/${id}`, "PUT", data);
  },

  async deletePublication(id: string) {
    return apiCall(`/admin/publication/${id}`, "DELETE");
  },

  async approvePublication(id: string) {
    return apiCall(`/admin/publication/${id}/approve`, "PATCH");
  },

  async rejectPublication(id: string) {
    return apiCall(`/admin/publication/${id}/reject`, "PATCH");
  },



  // Join Requests APIs
  async getJoinRequests() {
    return apiCall("/admin/join-requests");
  },

  async updateJoinRequest(id: string, status: string) {
    return apiCall(`/admin/join-requests/${id}`, "PUT", { status });
  },

  async deleteJoinRequest(id: string) {
    return apiCall(`/admin/join-requests/${id}`, "DELETE");
  },

  // Achievements APIs
  async getAchievements() {
    return apiCall("/admin/achievements");
  },

  async createAchievement(data: any) {
    return apiCall("/admin/achievements", "POST", data);
  },

  async updateAchievement(id: string, data: any) {
    return apiCall(`/admin/achievements/${id}`, "PUT", data);
  },

  async deleteAchievement(id: string) {
    return apiCall(`/admin/achievements/${id}`, "DELETE");
  },

  // Image Upload API
  async uploadImage(formData: FormData) {
    try {
      const token = getAuthToken();
      const headers: HeadersInit = {};

      // In development mode, always send dev-token header
      if (import.meta.env.DEV) {
        headers["x-dev-token"] = "dev-bypass";
        console.log(`[API] POST /admin/upload-image - Using dev bypass`);
      } else if (token) {
        // In production, use actual token
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/admin/upload-image`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle 401 - clear token and redirect to login
        if (response.status === 401) {
          console.error("Unauthorized (401) - clearing token and redirecting to login");
          clearAuthToken();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          throw new Error("Session expired. Please log in again.");
        }
        
        throw new Error(errorData.message || `Upload failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error: any) {
      throw new Error(error.message || "Failed to upload image");
    }
  },

  async deleteImage(publicId: string) {
    return apiCall("/admin/delete-image", "POST", { public_id: publicId });
  },

  // Publisher Symbol / Logo APIs
  async getPublishers() {
    return apiCall("/publication-symbol", "GET");
  },

  async getPublisherLogo(id: number) {
    return apiCall(`/publication-symbol/${id}`, "GET");
  },

  async uploadPublisherLogo(publisherName: string, logoFile: File) {
    const token = getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const formData = new FormData();
    formData.append("publisher_name", publisherName);
    formData.append("logo", logoFile);
    const response = await fetch(`${API_BASE_URL}/api/publication-symbol/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        clearAuthToken();
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error(errorData.message || `Upload failed: ${response.statusText}`);
    }
    return response.json();
  },
};

export default adminAPI;
