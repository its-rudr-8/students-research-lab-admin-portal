/**
 * Admin API Client Service
 * Centralized API client for all admin CRUD operations
 */

import { API_BASE_URL } from "@/config/apiConfig";

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
  } catch {
    // localStorage unavailable — silently ignore
  }
};

// Clear token from localStorage
export const clearAuthToken = () => {
  try {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("authToken");
  } catch {
    // localStorage unavailable — silently ignore
  }
};

export const parseList = (res: any): any[] => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.results)) return res.results;
  return [];
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
    "ngrok-skip-browser-warning": "true",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
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
    const response = await fetch(fullUrl, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);

      // Handle 401 - only redirect when the request is NOT the login endpoint itself.
      // Redirecting on a login 401 would reload the page and wipe the form.
      if (response.status === 401 && !endpoint.includes("/login")) {
        clearAuthToken();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new Error("Session expired. Please log in again.");
      }

      // Extract error message — handle FastAPI {detail}, Django {detail/error}, or generic {message}
      let errorMessage =
        errorData.message || errorData.error || errorData.detail;
      if (!errorMessage && errorData.detail) {
        if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail
            .map((d: any) => `${Array.isArray(d.loc) ? d.loc.slice(-1)[0] : "field"}: ${d.msg}`)
            .join("; ");
        }
      }
      throw new Error(errorMessage || `Request failed with status ${response.status}`);
    }

    const data = await response.json();
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

    // Two maps: by normalized enrollment_no and by name-slug, for robust fallback
    const imageByEnrollment = new Map<string, string>();
    const imageByNameSlug = new Map<string, string>();
    const toSlug = (s: string) =>
      s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    leaderboard.forEach((r: any) => {
      const url = r.profile_image || r.photo_url || r.photo || r.image || r.photoUrl || r.avatar || r.picture;
      if (!url) return;
      if (r.enrollment_no) imageByEnrollment.set(String(r.enrollment_no).toUpperCase(), url);
      const name = r.student_name || r.name;
      if (name) imageByNameSlug.set(toSlug(name), url);
    });

    const resolvePhoto = (s: any): string => {
      const direct = s.profile_image || s.photo_url || s.image || s.photo || s.photoUrl || s.avatar;
      if (direct) return direct;
      const byEnrollment = imageByEnrollment.get(String(s.enrollment_no || "").toUpperCase());
      if (byEnrollment) return byEnrollment;
      const name = s.student_name || s.name || "";
      if (name) {
        const byName = imageByNameSlug.get(toSlug(name));
        if (byName) return byName;
      }
      return "";
    };

    if (res && Array.isArray(res.data)) {
      res.data = res.data.map((s: any) => ({ ...s, profile_image: resolvePhoto(s) }));
    } else if (Array.isArray(res)) {
      return res.map((s: any) => ({ ...s, profile_image: resolvePhoto(s) }));
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

  async getSessionScores() {
    return apiCall("/admin/session-scores");
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

  async getImpactMetrics() {
    return apiCall("/impact-metrics");
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

  // Member CV APIs
  /** Fetch a single member's CV profile by enrollment number.
   * Returns the profile data object (or null if no profile exists yet). */
  async getMemberCVByEnrollment(enrollmentNo: string) {
    const url = `/admin/member-cv?enrollment_no=${encodeURIComponent(enrollmentNo)}`;
    const res = await apiCall(url, "GET");
    // Backend returns { success, data } — unwrap to data (may be null)
    return res?.data ?? null;
  },

  /** Save / update a member's CV profile (PUT /api/admin/member-cv). */
  async updateMemberCV(data: any) {
    return apiCall("/admin/member-cv", "PUT", data);
  },

  /** Admin-only: Fetch all member CV profiles (GET /api/admin/member-cv/all). */
  async getAllMemberCVs() {
    const res = await apiCall("/admin/member-cv/all", "GET");
    // Backend returns { success, count, data: [...] } — unwrap to the array
    return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
  },

  // Leadership APIs (Mock for now until backend is ready)
  async getLeadership() {
    // Return mock data for now
    return [
      { id: 1, name: "Dr. Amira Hassan", position: "Lab Director", bio: "Leading research in computational linguistics and AI ethics with 15+ years of academic experience.", initials: "AH" },
      { id: 2, name: "Prof. David Liu", position: "Principal Investigator", bio: "Specializing in computer vision and autonomous systems. Published 80+ peer-reviewed papers.", initials: "DL" },
      { id: 3, name: "Dr. Nadia Petrova", position: "Research Coordinator", bio: "Expert in bioinformatics and genomic data analysis. Coordinating cross-department research initiatives.", initials: "NP" },
      { id: 4, name: "Dr. Rajan Gupta", position: "Senior Mentor", bio: "Focused on machine learning applications in healthcare and privacy-preserving systems.", initials: "RG" },
    ];
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

  // SRL Sessions
  async getSessions() {
    return apiCall("/admin/sessions");
  },
  async createSession(data: any) {
    return apiCall("/admin/sessions", "POST", data);
  },
  async updateSession(id: string, data: any) {
    return apiCall(`/admin/sessions/${id}`, "PUT", data);
  },
  async deleteSession(id: string) {
    return apiCall(`/admin/sessions/${id}`, "DELETE");
  },

  async uploadMedia(formData: FormData) {
    const token = getAuthToken();
    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true",
    };

    // Always send the real token when available; also send dev bypass header in dev mode
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (import.meta.env.DEV) {
      headers["x-dev-token"] = "dev-bypass";
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/admin/upload`, {
        method: "POST",
        headers,
        body: formData,
      });
    } catch (networkError: any) {
      throw new Error("Network error: unable to reach the server. Please check your connection.");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.message || errorData.detail || `Upload failed (${response.status}: ${response.statusText})`;

      // Only force logout for 401 on non-upload endpoints to avoid disrupting the session
      // For upload failures, just surface the error message to the user
      if (response.status === 401 && !token) {
        // Only redirect if there was no token at all (genuinely unauthenticated)
        clearAuthToken();
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new Error("You are not logged in. Please log in again.");
      }

      throw new Error(msg);
    }

    return response.json();
  },

  /**
   * Upload a single certificate image to Cloudinary.
   * PDF → image conversion must be done before calling this (see certificateUpload.ts).
   * POST /api/admin/upload-certificate — accessible by any authenticated user.
   * Returns { data: { url, publicId } }
   */
  async uploadCertificate(formData: FormData) {
    const token = getAuthToken();
    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (import.meta.env.DEV) {
      headers["x-dev-token"] = "dev-bypass";
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/admin/upload-certificate`, {
        method: "POST",
        headers,
        body: formData,
      });
    } catch (networkError: any) {
      throw new Error("Network error: unable to reach the server. Please check your connection.");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg =
        errorData.message ||
        errorData.detail ||
        `Certificate upload failed (${response.status}: ${response.statusText})`;
      if (response.status === 401 && !token) {
        clearAuthToken();
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new Error("You are not logged in. Please log in again.");
      }
      throw new Error(msg);
    }

    return response.json();
  },

  // Upload an XLSX for session parsing (POST /api/sessions/upload)
  async uploadSessionXlsx(formData: FormData) {
    const token = getAuthToken();
    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true",
    };

    if (token) headers.Authorization = `Bearer ${token}`;
    if (import.meta.env.DEV) headers["x-dev-token"] = "dev-bypass";

    const response = await fetch(`${API_BASE_URL}/api/sessions/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) {
        clearAuthToken();
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new Error("You are not logged in. Please log in again.");
      }
      throw new Error(err.message || `Upload failed (${response.status})`);
    }

    return response.json();
  },

  async deleteSessionScore(id: string) {
    const token = getAuthToken();
    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true",
    };

    if (token) headers.Authorization = `Bearer ${token}`;
    if (import.meta.env.DEV) headers["x-dev-token"] = "dev-bypass";

    const response = await fetch(`${API_BASE_URL}/api/admin/session-scores/${id}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) {
        clearAuthToken();
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new Error("You are not logged in. Please log in again.");
      }
      throw new Error(err.message || `Delete failed (${response.status})`);
    }

    return response.json();
  },

  async deleteSessionScoresByDateEvent(date: string, type: string) {
    const token = getAuthToken();
    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true",
    };

    if (token) headers.Authorization = `Bearer ${token}`;
    if (import.meta.env.DEV) headers["x-dev-token"] = "dev-bypass";

    const response = await fetch(`${API_BASE_URL}/api/admin/session-scores/event?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) {
        clearAuthToken();
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new Error("You are not logged in. Please log in again.");
      }
      throw new Error(err.message || `Delete failed (${response.status})`);
    }

    return response.json();
  },

  async updateSessionScore(id: string, data: any) {
    return apiCall(`/admin/session-scores/${id}`, "PUT", data);
  },

  async uploadImage(formData: FormData) {
    try {
      const token = getAuthToken();
      const headers: HeadersInit = {};

      // In development mode, always send dev-token header
      if (import.meta.env.DEV) {
        headers["x-dev-token"] = "dev-bypass";
      } else if (token) {
        // In production, use actual token
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/upload-image`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle 401 - clear token and redirect to login
        if (response.status === 401) {
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
