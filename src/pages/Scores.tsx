import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Plus, Clock, Star, ChevronLeft, ChevronRight, Pencil, Trash2, X, Search, Loader2, Medal, CalendarIcon } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import StudentAvatar from "@/components/StudentAvatar";
import * as XLSX from "xlsx";
import { hasWriteAccess } from "@/lib/auth";
import { adminAPI, parseList } from "@/lib/adminApi";
import { API_BASE_URL } from "@/config/apiConfig";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ConfirmProvider";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScoreRow {
  id: string;
  enrollment_no: string;
  points: number;
  name: string;
  initials: string;
  profile_image?: string;
  hours?: number;
  batch?: string;
  department?: string;
}

interface SessionScoreRow {
  id: string;
  date: string | null;
  type: string;
  round: number;
  attendees: string[];
  scoreEntries: Array<{ enrollment_no: string; score: number }>;
}

interface SessionEventGroup {
  type: string;
  sessions: SessionScoreRow[];
}

interface SessionDateGroup {
  date: string;
  events: SessionEventGroup[];
}

const GRN = "linear-gradient(135deg,#1e4a34,#122a1e)";
const PG = 7; 

export default function Scores() {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionScores, setSessionScores] = useState<SessionScoreRow[]>([]);
  const [selectedPanelStudent, setSelectedPanelStudent] = useState<string>("");
  const [cachedLeaderboardStats, setCachedLeaderboardStats] = useState<any[]>([]);
  const [cachedStudentsData, setCachedStudentsData] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"cumulative" | "weekly" | "monthly" | "contributors">("cumulative");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const confirm = useConfirm();

  // CRUD States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingScore, setEditingScore] = useState<ScoreRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Upload / Manual session states
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState<string>("");
  const [manualType, setManualType] = useState<string>("Test");
  const [manualRounds, setManualRounds] = useState<number>(1);
  const [manualScores, setManualScores] = useState<{ [enrollment: string]: number[] }>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadConfirmOpen, setIsUploadConfirmOpen] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingWorkbookSheets, setPendingWorkbookSheets] = useState<string[]>([]);
  const [selectedScoresSheetName, setSelectedScoresSheetName] = useState<string>("");
  const [selectedRoundsSheetName, setSelectedRoundsSheetName] = useState<string>("__none__");
  const workbookRef = useRef<XLSX.WorkBook | null>(null);
  const [pendingDateOptions, setPendingDateOptions] = useState<string[]>([]);
  const [selectedUploadDate, setSelectedUploadDate] = useState<string>("");
  const selectedUploadDateCalendar = useMemo(() => {
    if (!selectedUploadDate) return undefined;
    const parsed = new Date(`${selectedUploadDate}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [selectedUploadDate]);
  const todayUploadDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionSort, setSessionSort] = useState<"score-desc" | "score-asc" | "name-asc" | "name-desc">("score-desc");
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>("");
  const [selectedSessionEvent, setSelectedSessionEvent] = useState<string>("all");
  const [selectedSessionRound, setSelectedSessionRound] = useState<string>("all");
  const [focusLatestSession, setFocusLatestSession] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [sessionScoreDrafts, setSessionScoreDrafts] = useState<Record<string, Record<string, string>>>({});
  const [savingSessionKey, setSavingSessionKey] = useState<string | null>(null);
  const [isAddingScores, setIsAddingScores] = useState(false);
  
  // Form States
  const [formData, setFormData] = useState({
    points: 0,
    hours: 0,
    enrollment_no: "",
    period: ""
  });
  
  // Bulk Add States
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPeriod, setAddPeriod] = useState("");
  const [addScores, setAddScores] = useState<{ [enrollment_no: string]: { points: string } }>({});
  const [searchName, setSearchName] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const normalizeText = (value: unknown) => String(value || "").trim();

  const isWithinLast7Days = (dateText: string) => {
    if (!dateText) return false;
    const parsed = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return false;
    const since = new Date();
    since.setDate(since.getDate() - 7);
    since.setHours(0, 0, 0, 0);
    return parsed >= since;
  };

  const toDateKey = (year: number, month: number, day: number) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${year}-${pad(month)}-${pad(day)}`;
  };

  const parseUploadDateKey = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return toDateKey(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }

    if (typeof value === "number" && value > 20000) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        return toDateKey(parsed.y, parsed.m, parsed.d);
      }
    }

    const text = String(value).trim();
    const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      return toDateKey(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    }

    const slashMatch = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (slashMatch) {
      let year = Number(slashMatch[3]);
      if (year < 100) year += 2000;
      return toDateKey(year, Number(slashMatch[2]), Number(slashMatch[1]));
    }

    if (/[a-zA-Z]/.test(text) || /[\/.-]/.test(text)) {
      const parsed = Date.parse(text);
      if (!Number.isNaN(parsed)) {
        const date = new Date(parsed);
        return toDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
      }
    }

    return "";
  };

  const collectUploadDateOptions = (workbook: XLSX.WorkBook | null, sheetName: string) => {
    if (!workbook || !sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) return [];

    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const options = new Set<string>();
    const maxRow = Math.min(range.e.r, range.s.r + 2);

    for (let r = range.s.r; r <= maxRow; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        const dateKey = parseUploadDateKey(cell?.v);
        if (dateKey) options.add(dateKey);
      }
    }

    return Array.from(options);
  };

  const parseList = (value: any) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.leaderboard)) return value.leaderboard;
    if (Array.isArray(value?.data?.leaderboard)) return value.data.leaderboard;
    return [];
  };

  const monthRank = (value: string) => {
    const raw = normalizeText(value);
    const match = raw.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
    if (!match) return 0;
    const m: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    return (Number(match[2]) || 0) * 100 + (m[match[1].toLowerCase().substring(0, 3)] || 0);
  };

  const normalizePeriod = (period: string) => {
    const raw = normalizeText(period);
    if (/^all\s*time$/i.test(raw)) return "All Time";
    // Check for academic year format (YYYY-YYYY)
    if (/^\d{4}-\d{4}$/.test(raw)) return raw;
    const match = raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (!match) return raw;
    const monthMap: Record<string, string> = {
      january: "Jan", february: "Feb", march: "Mar", april: "Apr", may: "May", june: "Jun",
      july: "Jul", august: "Aug", september: "Sep", october: "Oct", november: "Nov", december: "Dec",
      jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", jun: "Jun", jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec"
    };
    const monthName = monthMap[match[1].toLowerCase()] || match[1];
    return `${monthName} ${match[2]}`;
  };

  const parsePeriod = (period: string): { month: number; year: number } | null => {
    const raw = normalizeText(period);
    if (/^all\s*time$/i.test(raw)) return null;
    const match = raw.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
    if (!match) return null;
    const monthMap: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const month = monthMap[match[1].toLowerCase().substring(0, 3)] || 0;
    const year = Number(match[2]);
    return month > 0 ? { month, year } : null;
  };

  const isInAcademicYear = (period: string, acadYearStart: number): boolean => {
    const parsed = parsePeriod(period);
    if (!parsed) return false;
    // Academic year: May of acadYearStart to April of (acadYearStart + 1)
    const startMonth = 5; // May
    const endMonth = 4; // April
    if (parsed.year === acadYearStart && parsed.month >= startMonth) return true;
    if (parsed.year === acadYearStart + 1 && parsed.month <= endMonth) return true;
    return false;
  };

  const getAcademicYearFormat = (acadYearStart: number): string => {
    return `${acadYearStart}-${acadYearStart + 1}`;
  };

  const getCurrentAcademicYear = (): number => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    // Academic year starts in May (month 5)
    return currentMonth >= 5 ? currentYear : currentYear - 1;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [scoresRes, studentsRes, sessionScoresRes] = await Promise.all([
        adminAPI.getScores(),
        adminAPI.getStudents(),
        adminAPI.getSessionScores().catch(() => null),
      ]);

      const rawStats: any[] = scoresRes?.data?.leaderboardStats ?? scoresRes?.leaderboardStats ?? parseList(scoresRes?.data ?? scoresRes);
      const stats = rawStats.map((s: any) => ({ ...s, period: normalizePeriod(s.period) }));

      setCachedStudentsData(parseList(studentsRes));
      setSessionScores(Array.isArray(sessionScoresRes?.data) ? sessionScoresRes.data : []);
      // Get months but exclude "All Time" and academic year format (YYYY-YYYY)
      const months = Array.from(new Set<string>(stats.map((r: any) => r.period).filter((p: string) => p && !/^all\s*time$/i.test(p) && !/^\d{4}-\d{4}$/.test(p)))).sort((a, b) => monthRank(b) - monthRank(a));
      
      setMonthOptions(months);
      setCachedLeaderboardStats(stats);
      if (months.length > 0 && !selectedMonth) setSelectedMonth(months[0]);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const es = new EventSource(`${API_BASE_URL}/api/events`);
    es.addEventListener("student_changed", () => loadData());
    es.addEventListener("session_changed", () => loadData());
    es.onerror = () => {};
    return () => es.close();
  }, []);

  useEffect(() => {
    if (cachedLeaderboardStats.length === 0) return;
    try {
      const nameMap = new Map<string, any>();
      cachedStudentsData.forEach((s: any) => { const e = normalizeText(s.enrollment_no); if (e) nameMap.set(e, s); });
      const agg = new Map<string, ScoreRow>();
      
      let stats: any[] = [];
      if (viewMode === "weekly") {
        const weeklyAgg = new Map<string, ScoreRow>();

        sessionScores
          .filter((session) => isWithinLast7Days(session.date || ""))
          .forEach((session) => {
            (session.scoreEntries || []).forEach((entry) => {
              const enr = normalizeText(entry.enrollment_no);
              if (!enr) return;

              const stu = nameMap.get(enr) || {};
              const name = normalizeText(stu.student_name) || enr;
              const scoreValue = Number(entry.score || 0);

              if (!weeklyAgg.has(enr)) {
                weeklyAgg.set(enr, {
                  id: enr,
                  enrollment_no: enr,
                  points: scoreValue,
                  name,
                  initials: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2),
                  profile_image: stu.profile_image || stu.photo_url,
                  hours: 0,
                  batch: stu.batch,
                  department: stu.department,
                });
              } else {
                const existing = weeklyAgg.get(enr)!;
                existing.points += scoreValue;
              }
            });
          });

        const rows = Array.from(weeklyAgg.values());
        rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
        setScores(rows);
        return;
      }

      if (viewMode === "cumulative") {
        const currentAcadYear = getCurrentAcademicYear();
        const previousAcadYear = currentAcadYear - 1;
        const currentAcadYearStr = getAcademicYearFormat(currentAcadYear);
        const previousAcadYearStr = getAcademicYearFormat(previousAcadYear);
        
        // First check for YYYY-YYYY format (e.g., "2026-2027", fallback to "2025-2026")
        let hasCurrentYearFormat = cachedLeaderboardStats.some(s => normalizeText(s.period) === currentAcadYearStr);
        let hasPreviousYearFormat = cachedLeaderboardStats.some(s => normalizeText(s.period) === previousAcadYearStr);
        
        if (hasCurrentYearFormat) {
          stats = cachedLeaderboardStats.filter(s => normalizeText(s.period) === currentAcadYearStr);
        } else if (hasPreviousYearFormat) {
          stats = cachedLeaderboardStats.filter(s => normalizeText(s.period) === previousAcadYearStr);
        } else {
          // Fallback to month-based filtering
          stats = cachedLeaderboardStats.filter(s => {
            const period = normalizeText(s.period);
            if (/^all\s*time$/i.test(period)) return false;
            if (isInAcademicYear(period, currentAcadYear)) return true;
            if (isInAcademicYear(period, previousAcadYear)) return true;
            return false;
          });
        }
      } else {
        // Monthly or contributors view
        stats = cachedLeaderboardStats.filter(s => normalizeText(s.period) === selectedMonth);
      }
      stats.forEach((score: any) => {
        const enr = normalizeText(score.enrollment_no);
        const stu = nameMap.get(enr) || {};
        const name = normalizeText(stu.student_name) || enr;
        if (!agg.has(enr)) {
          agg.set(enr, { 
            id: normalizeText(score.id), 
            enrollment_no: enr, 
            points: Number(score.debate_score || score.points || score.total_score || score.monthly_score || 0), 
            name, 
            initials: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2), 
            profile_image: stu.profile_image || stu.photo_url || score.profile_image || score.image || score.photo, 
            hours: Number(score.hours || score.total_hours || score.monthly_hours || 0),
            batch: stu.batch,
            department: stu.department
          });
        } else {
          const ex = agg.get(enr)!;
          ex.points += Number(score.debate_score || score.points || score.total_score || score.monthly_score || 0);
          ex.hours = Number(((ex.hours || 0) + Number(score.hours || score.total_hours || score.monthly_hours || 0)).toFixed(1));
        }
      });
      let rows = Array.from(agg.values());
      rows.sort((a, b) => viewMode === "contributors" ? (b.hours || 0) - (a.hours || 0) : b.points - a.points);
      setScores(rows);
    } catch { }
  }, [viewMode, selectedMonth, cachedLeaderboardStats, cachedStudentsData, sessionScores]);

  const studentNameByEnrollment = useMemo(() => {
    const map = new Map<string, string>();
    cachedStudentsData.forEach((student: any) => {
      const enrollmentNo = normalizeText(student.enrollment_no);
      if (enrollmentNo) map.set(enrollmentNo, student.student_name || student.name || enrollmentNo);
    });
    return map;
  }, [cachedStudentsData]);

  const groupedSessionScores = useMemo<SessionDateGroup[]>(() => {
    const grouped = new Map<string, Map<string, SessionScoreRow[]>>();
    const ordered = [...sessionScores].sort((a, b) => {
      const dateDiff = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateDiff !== 0) return dateDiff;
      const typeDiff = String(a.type || "").localeCompare(String(b.type || ""));
      if (typeDiff !== 0) return typeDiff;
      return a.round - b.round;
    });

    ordered.forEach((session) => {
      const dateKey = session.date || "No date";
      const eventKey = session.type || "Event";
      const eventMap = grouped.get(dateKey) || new Map<string, SessionScoreRow[]>();
      const bucket = eventMap.get(eventKey) || [];
      bucket.push(session);
      eventMap.set(eventKey, bucket);
      grouped.set(dateKey, eventMap);
    });

    return Array.from(grouped.entries()).map(([date, events]) => ({
      date,
      events: Array.from(events.entries()).map(([type, sessions]) => ({ type, sessions })),
    }));
  }, [sessionScores]);

  const sessionDateOptions = useMemo(() => groupedSessionScores.map((group) => group.date), [groupedSessionScores]);

  useEffect(() => {
    if (sessionDateOptions.length === 0) {
      if (selectedSessionDate) setSelectedSessionDate("");
      setSelectedSessionEvent("all");
      setSelectedSessionRound("all");
      return;
    }

    if (focusLatestSession) {
      setSelectedSessionDate(sessionDateOptions[0]);
      setFocusLatestSession(false);
      return;
    }

    if (selectedSessionDate && !sessionDateOptions.includes(selectedSessionDate)) {
      setSelectedSessionDate("");
    }
  }, [sessionDateOptions, selectedSessionDate, focusLatestSession]);

  const selectedSessionGroup = useMemo(() => {
    return groupedSessionScores.find((group) => group.date === selectedSessionDate) || null;
  }, [groupedSessionScores, selectedSessionDate]);

  const sessionEventOptions = useMemo(() => {
    return selectedSessionGroup ? selectedSessionGroup.events.map((event) => event.type) : [];
  }, [selectedSessionGroup]);

  useEffect(() => {
    if (selectedSessionEvent !== "all" && !sessionEventOptions.includes(selectedSessionEvent)) {
      setSelectedSessionEvent("all");
    }
  }, [selectedSessionEvent, sessionEventOptions]);

  const selectedEventGroups = useMemo(() => {
    if (!selectedSessionGroup) return [];
    return selectedSessionEvent === "all"
      ? selectedSessionGroup.events
      : selectedSessionGroup.events.filter((event) => event.type === selectedSessionEvent);
  }, [selectedSessionGroup, selectedSessionEvent]);

  const sessionRoundOptions = useMemo(() => {
    const rounds = new Set<number>();
    selectedEventGroups.forEach((eventGroup) => {
      eventGroup.sessions.forEach((session) => {
        const normalizedRound = session.round && session.round > 0 ? session.round : 1;
        rounds.add(normalizedRound);
      });
    });
    return Array.from(rounds).sort((a, b) => a - b);
  }, [selectedEventGroups]);

  const currentManualSession = useMemo(() => {
    if (!manualDate || !manualType) return null;
    return sessionScores.find((session) => {
      const normalizedRound = session.round && session.round > 0 ? session.round : 1;
      return session.date === manualDate && session.type === manualType && normalizedRound === 1;
    }) || null;
  }, [sessionScores, manualDate, manualType]);

  useEffect(() => {
    if (!isManualOpen || !manualDate || !manualType || !currentManualSession) return;

    const nextScores: { [enrollment: string]: number[] } = {};
    currentManualSession.scoreEntries.forEach((entry) => {
      nextScores[entry.enrollment_no] = [entry.score];
    });

    setManualRounds(1);
    setManualScores(nextScores);
  }, [isManualOpen, manualDate, manualType, currentManualSession]);

  useEffect(() => {
    if (selectedSessionRound !== "all" && !sessionRoundOptions.includes(Number(selectedSessionRound))) {
      setSelectedSessionRound("all");
    }
  }, [selectedSessionRound, sessionRoundOptions]);

  useEffect(() => {
    if (!isUploadConfirmOpen) {
      setPendingDateOptions([]);
      setSelectedUploadDate("");
      return;
    }

    const options = collectUploadDateOptions(workbookRef.current, selectedScoresSheetName);
    setPendingDateOptions(options);

    if (options.length === 0) {
      setSelectedUploadDate("");
      return;
    }

    if (!selectedUploadDate || !options.includes(selectedUploadDate)) {
      setSelectedUploadDate(options.includes(todayUploadDate) ? todayUploadDate : options[0]);
    }
  }, [isUploadConfirmOpen, selectedScoresSheetName, selectedUploadDate, todayUploadDate]);

  const visibleEventGroups = useMemo(() => {
    const query = normalizeText(sessionSearch).toLowerCase();

    const sortEntries = (entries: SessionScoreRow["scoreEntries"]) => {
      const sorted = [...entries].sort((a, b) => {
        const nameA = (studentNameByEnrollment.get(a.enrollment_no) || a.enrollment_no).toLowerCase();
        const nameB = (studentNameByEnrollment.get(b.enrollment_no) || b.enrollment_no).toLowerCase();

        if (sessionSort === "name-asc") return nameA.localeCompare(nameB);
        if (sessionSort === "name-desc") return nameB.localeCompare(nameA);
        if (sessionSort === "score-asc") return a.score - b.score;
        return b.score - a.score;
      });
      return sorted;
    };

    return selectedEventGroups
      .map(({ type, sessions }) => {
        const filteredSessions = sessions
          .filter((session) => {
            const normalizedRound = session.round && session.round > 0 ? session.round : 1;
            return selectedSessionRound === "all" || String(normalizedRound) === selectedSessionRound;
          })
          .map((session) => {
            const sortedEntries = sortEntries(session.scoreEntries);
            const filteredEntries = query
              ? sortedEntries.filter((entry) => {
                  const studentName = (studentNameByEnrollment.get(entry.enrollment_no) || entry.enrollment_no).toLowerCase();
                  return studentName.includes(query) || entry.enrollment_no.toLowerCase().includes(query);
                })
              : sortedEntries;

            return {
              ...session,
              scoreEntries: filteredEntries,
            };
          })
          .filter((session) => session.scoreEntries.length > 0 || !query);

        return {
          type,
          sessions: filteredSessions,
        };
      })
      .filter((group) => group.sessions.length > 0);
  }, [selectedEventGroups, sessionSearch, sessionSort, studentNameByEnrollment, selectedSessionRound]);

  const sessionFiltersApplied = Boolean(
    normalizeText(selectedSessionDate) ||
    selectedSessionEvent !== "all" ||
    selectedSessionRound !== "all" ||
    normalizeText(sessionSearch)
  );

  const paged = scores.slice((currentPage - 1) * PG, currentPage * PG);

  // Last 7 distinct session dates present in sessionScores (oldest -> newest)
  const weeklyDateSeries = useMemo(() => {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const datesSet = new Set<string>();
    sessionScores.forEach((s) => { if (s.date) datesSet.add(s.date); });
    const dates = Array.from(datesSet).filter(d => d).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const last7 = dates.slice(-7);
    return last7.map(d => ({ date: d, label: labels[new Date(d + 'T00:00:00').getDay()] }));
  }, [sessionScores]);

  const weeklyLeaderboard = useMemo(() => {
    const nameMap = new Map<string, any>();
    cachedStudentsData.forEach((s: any) => { const e = normalizeText(s.enrollment_no); if (e) nameMap.set(e, s); });
    const agg = new Map<string, { enrollment_no: string; name: string; image?: string; batch?: string; score: number; dayScores: Map<string, number> }>();

    sessionScores
      .filter((session) => weeklyDateSeries.some(d => d.date === (session.date || "")))
      .forEach((session) => {
        const dateKey = session.date || "";
        const scoresObj = session.scores && typeof session.scores === "object" ? session.scores : {};
        Object.entries(scoresObj).forEach(([enr, val]) => {
          const key = normalizeText(enr);
          if (!key) return;
          const score = Number(val) || 0;
          if (!agg.has(key)) {
            const stu = nameMap.get(key) || {};
            agg.set(key, { enrollment_no: key, name: normalizeText(stu.student_name) || key, image: stu.profile_image || stu.photo_url || "", batch: stu.batch, score: 0, dayScores: new Map() });
          }
          const entry = agg.get(key)!;
          entry.score += score;
          entry.dayScores.set(dateKey, (entry.dayScores.get(dateKey) || 0) + score);
        });
      });

    return Array.from(agg.values()).sort((a, b) => b.score - a.score).map((e, idx) => ({ ...e, rank: idx + 1, progress: weeklyDateSeries.map(d => ({ ...d, score: e.dayScores.get(d.date) || 0 })) }));
  }, [sessionScores, cachedStudentsData, weeklyDateSeries]);

  const overallWeeklyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    weeklyDateSeries.forEach(d => totals.set(d.date, 0));
    sessionScores.forEach(session => {
      const dateKey = session.date || "";
      if (!totals.has(dateKey)) return;
      const scoresObj = session.scores && typeof session.scores === 'object' ? session.scores : {};
      Object.values(scoresObj).forEach(v => { totals.set(dateKey, (totals.get(dateKey) || 0) + (Number(v) || 0)); });
    });
    return weeklyDateSeries.map(d => ({ ...d, total: totals.get(d.date) || 0 }));
  }, [sessionScores, weeklyDateSeries]);

  const selectedPanelProgress = useMemo(() => {
    if (!selectedPanelStudent) return [];
    const dayMap = new Map<string, number>();
    sessionScores.forEach((session) => {
      const dateKey = session.date || "";
      if (!weeklyDateSeries.some(d => d.date === dateKey)) return;
      const s = Number(session.scores?.[selectedPanelStudent] || 0);
      if (!s) return;
      dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + s);
    });
    return weeklyDateSeries.map(d => ({ ...d, score: dayMap.get(d.date) || 0 }));
  }, [sessionScores, selectedPanelStudent, weeklyDateSeries]);

  const selectedPanelSummary = useMemo(() => {
    const total = selectedPanelProgress.reduce((s, d) => s + Number(d.score || 0), 0);
    const best = selectedPanelProgress.reduce((best, d) => (Number(d.score || 0) > Number(best.score || 0) ? d : best), selectedPanelProgress[0] || { label: '', score: 0 });
    return { total, bestDay: best };
  }, [selectedPanelProgress]);

  const handleEditClick = (score: ScoreRow) => {
    setEditingScore(score);
    setFormData({ points: score.points, hours: score.hours || 0, enrollment_no: score.enrollment_no, period: selectedMonth || "" });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingScore) return;
    setIsSaving(true);
    try {
      const res = await adminAPI.updateScore(editingScore.id, { points: formData.points, hours: formData.hours });
      if (res) {
        toast({ title: "Updated" });
        setIsEditModalOpen(false);
        loadData();
      }
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!editingScore) return;
    const ok = await confirm({ title: "Delete score", description: "Delete this record?" });
    if (!ok) return;
    setIsSaving(true);
    try {
      await adminAPI.deleteScore(editingScore.id);
      toast({ title: "Deleted" });
      setIsEditModalOpen(false);
      loadData();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
    finally { setIsSaving(false); }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Delete this uploaded session? This will remove the attendees and scores for the selected session.")) return;
    setDeletingSessionId(sessionId);
    try {
      await adminAPI.deleteSessionScore(sessionId);
      toast({ title: "Deleted", description: "Uploaded session removed." });
      loadData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleDeleteEventGroup = async (date: string, eventType: string) => {
    if (!confirm(`Delete all session data for ${date} / ${eventType}?`)) return;
    setDeletingSessionId(`${date}:${eventType}`);
    try {
      await adminAPI.deleteSessionScoresByDateEvent(date, eventType);
      toast({ title: "Deleted", description: "Selected date and event data removed." });
      loadData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setDeletingSessionId(null);
    }
  };

  const getSessionDraftScore = (sessionId: string, enrollmentNo: string, fallbackScore: number) => {
    return sessionScoreDrafts[sessionId]?.[enrollmentNo] ?? String(fallbackScore ?? 0);
  };

  const setSessionDraftScore = (sessionId: string, enrollmentNo: string, value: string) => {
    setSessionScoreDrafts((prev) => ({
      ...prev,
      [sessionId]: {
        ...(prev[sessionId] || {}),
        [enrollmentNo]: value,
      },
    }));
  };

  const applyUpdatedSession = (updatedSession: SessionScoreRow) => {
    setSessionScores((prev) => prev.map((s) => (s.id === updatedSession.id ? updatedSession : s)));
  };

  const handleSaveStudentSessionScore = async (sessionId: string, enrollmentNo: string, fallbackScore: number) => {
    const raw = getSessionDraftScore(sessionId, enrollmentNo, fallbackScore);
    const score = Number(raw);
    if (Number.isNaN(score)) {
      toast({ variant: "destructive", title: "Invalid score", description: "Please enter a valid number." });
      return;
    }

    setSavingSessionKey(`${sessionId}:${enrollmentNo}:save`);
    try {
      const res = await adminAPI.updateSessionScore(sessionId, { enrollment_no: enrollmentNo, score });
      if (res?.data) applyUpdatedSession(res.data);
      toast({ title: "Updated", description: `${enrollmentNo} score updated.` });
      setSessionScoreDrafts((prev) => ({
        ...prev,
        [sessionId]: {
          ...(prev[sessionId] || {}),
          [enrollmentNo]: String(score),
        },
      }));
      loadData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setSavingSessionKey(null);
    }
  };

  const handleDeleteStudentSessionScore = async (sessionId: string, enrollmentNo: string) => {
    if (!confirm(`Delete ${enrollmentNo} from this session?`)) return;
    setSavingSessionKey(`${sessionId}:${enrollmentNo}:delete`);
    try {
      const res = await adminAPI.updateSessionScore(sessionId, { enrollment_no: enrollmentNo, removeEnrollment: true });
      if (res?.data) applyUpdatedSession(res.data);
      toast({ title: "Deleted", description: `${enrollmentNo} removed from the session.` });
      setSessionScoreDrafts((prev) => {
        const nextSessionDraft = { ...(prev[sessionId] || {}) };
        delete nextSessionDraft[enrollmentNo];
        return { ...prev, [sessionId]: nextSessionDraft };
      });
      loadData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setSavingSessionKey(null);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    setAddError("");
    
    if (!addPeriod) {
      setAddError("Please select a period.");
      setAdding(false);
      return;
    }
    
    // Prepare rows for students with entered scores
    const rows = Object.entries(addScores)
      .filter(([_, data]) => data.points !== "" && !isNaN(Number(data.points)))
      .map(([enrollment_no, data]) => ({
        enrollment_no,
        points: parseFloat(data.points),
        period: addPeriod
      }));

    if (rows.length === 0) {
      setAddError("Please enter points for at least one student.");
      setAdding(false);
      return;
    }
    
    try {
      // Insert score records
      for (const row of rows) {
        await adminAPI.createScore(row);
      }
      
      toast({ title: "Scores added successfully" });
      setShowAddForm(false);
      setAddScores({});
      setAddPeriod(selectedMonth || "");
      setSearchName("");
      loadData();
    } catch (e: any) {
      setAddError(e.message || "Failed to add scores");
    }
    setAdding(false);
  };
  
  const handleAddClick = () => {
    setShowAddForm(true);
    setAddPeriod(selectedMonth || monthOptions[0] || "");
    setAddScores({});
    setSearchName("");
    setAddError("");
  };

  const triggerFilePicker = () => fileInputRef.current?.click();

  const guessSheetName = (sheetNames: string[], pattern: RegExp, fallbackIndex = 0) => {
    const match = sheetNames.find((name) => pattern.test(name));
    return match || sheetNames[fallbackIndex] || "";
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const workbook = XLSX.read(await f.arrayBuffer(), { type: "array" });
      workbookRef.current = workbook;
      const sheetNames = workbook.SheetNames || [];
      setPendingUploadFile(f);
      setPendingWorkbookSheets(sheetNames);
      setSelectedScoresSheetName(guessSheetName(sheetNames, /score/i, 0));
      setSelectedRoundsSheetName("__none__");
      setSelectedUploadDate("");
      setIsUploadConfirmOpen(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message || "Could not read workbook" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmUploadFile = async () => {
    if (!pendingUploadFile) return;
    setIsAddingScores(true);
    const fd = new FormData();
    fd.append("file", pendingUploadFile);
    if (selectedScoresSheetName) fd.append("scoresSheetName", selectedScoresSheetName);
    if (selectedRoundsSheetName && selectedRoundsSheetName !== "__none__") fd.append("roundsSheetName", selectedRoundsSheetName);
    if (selectedUploadDate) fd.append("updateDate", selectedUploadDate);

    try {
      const res = await adminAPI.uploadSessionXlsx(fd);
      toast({ title: "Upload complete", description: `${res.sessionsCreated || 0} sessions, ${res.scoresUpdated || 0} scores` });
      setFocusLatestSession(true);
      setIsUploadConfirmOpen(false);
      setPendingUploadFile(null);
      setPendingWorkbookSheets([]);
      setPendingDateOptions([]);
      setSelectedUploadDate("");
      workbookRef.current = null;
      loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setIsAddingScores(false);
    }
  };

  const openManualDialog = () => {
    setIsManualOpen(true);
    setManualDate("");
    setManualType("Test");
    setManualRounds(1);
    setManualScores({});
  };

  const loadCurrentManualScores = () => {
    if (!currentManualSession) {
      toast({ variant: "destructive", title: "No existing data", description: "No current session data was found for the selected date and type." });
      return;
    }

    const nextScores: { [enrollment: string]: number[] } = {};
    currentManualSession.scoreEntries.forEach((entry) => {
      nextScores[entry.enrollment_no] = [entry.score];
    });

    setManualRounds(1);
    setManualScores(nextScores);
    toast({ title: "Loaded", description: "Current session scores loaded into the manual editor." });
  };

  const handleManualSubmit = async () => {
    // Build a workbook matching parser expectations: Rounds and Scores sheets
    try {
      if (!manualDate) {
        toast({ variant: "destructive", title: "Date required", description: "Please select a session date." });
        return;
      }

      const dateKey = manualDate;
      const rounds = Math.max(1, Math.min(10, manualRounds));

      // Build Rounds sheet AOAs
      // Row 0: blank x3 then date merged across round columns (starting at col 3)
      const header0: any[] = [];
      header0[2] = "Enrollment No.";
      for (let c = 3; c < 3 + rounds; c++) header0[c] = c === 3 ? dateKey : null;

      // Row1: round labels
      const header1: any[] = [];
      header1[2] = "";
      for (let r = 0; r < rounds; r++) header1[3 + r] = String(r + 1);

      const dataRows: any[] = [];
      const students = cachedStudentsData || [];
      for (const s of students) {
        const row: any[] = [];
        row[2] = s.enrollment_no;
        const scores = manualScores[s.enrollment_no] || [];
        for (let r = 0; r < rounds; r++) {
          row[3 + r] = scores[r] !== undefined ? scores[r] : "";
        }
        dataRows.push(row);
      }

      const roundsAoa = [header0, header1, ...dataRows];
      const roundsSheet = XLSX.utils.aoa_to_sheet(roundsAoa);
      // Merge date across round columns
      roundsSheet["!merges"] = roundsSheet["!merges"] || [];
      roundsSheet["!merges"].push({ s: { r: 0, c: 3 }, e: { r: 0, c: 3 + rounds - 1 } });

      // Scores sheet: minimal with date header + type row (final scores optional)
      const scoresAoa: any[] = [];
      const s0: any[] = []; s0[2] = dateKey; // put date at col 3
      const s1: any[] = []; s1[2] = manualType;
      scoresAoa.push(s0, s1);
      const scoresSheet = XLSX.utils.aoa_to_sheet(scoresAoa);
      scoresSheet["!merges"] = scoresSheet["!merges"] || [];
      scoresSheet["!merges"].push({ s: { r: 0, c: 2 }, e: { r: 0, c: 2 } });

      const wb = { SheetNames: ["Rounds", "Scores"], Sheets: { Rounds: roundsSheet, Scores: scoresSheet } };
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const file = new File([blob], `manual_session_${dateKey}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const fd = new FormData();
      fd.append("file", file);

      const res = await adminAPI.uploadSessionXlsx(fd);
      toast({ title: "Manual session uploaded", description: `${res.sessionsCreated || 0} sessions, ${res.scoresUpdated || 0} scores` });
      setIsManualOpen(false);
      loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to upload manual session" });
    }
  };

  return (
    <div style={{ maxWidth: 1160, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      
      {/* Top Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 14, flexWrap: "wrap", flexShrink: 0 }}>
        <div style={{ display: "inline-flex", gap: 5, padding: 6, borderRadius: 50, background: "linear-gradient(135deg,#eae6dc,#f2ede4)", border: "1px solid #d8d2c6", boxShadow: "inset 0 1.5px 4px rgba(0,0,0,0.08)" }}>
          {[
            { id: "weekly", label: "Weekly", icon: <Clock size={14} /> },
            { id: "monthly", label: "Monthly", icon: <Star size={14} /> },
            { id: "cumulative", label: "All-Time", icon: <Trophy size={14} /> },
          ].map(m => {
            const active = viewMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setViewMode(m.id as any); setCurrentPage(1); }}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", borderRadius: 50, border: "none", cursor: "pointer", fontSize: "0.835rem", fontWeight: active ? 700 : 500,
                  background: active ? GRN : "transparent", color: active ? "#fff" : "#8a7e72", transition: "all 0.2s", boxShadow: active ? "0 3px 12px rgba(26,74,52,0.3)" : "none"
                }}
              >
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {viewMode === "monthly" && (
            <Select value={selectedMonth || ""} onValueChange={setSelectedMonth}>
              <SelectTrigger style={{ height: 42, padding: "0 16px", borderRadius: 50, border: "1.5px solid #dde8e2", background: "#f8fdfb", fontSize: "0.875rem", fontWeight: 600, color: "#1e1e18", width: 160 }}>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                {monthOptions.map(m => (
                  <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasWriteAccess() && (
            <div style={{ display: 'inline-flex', gap: 8 }}>
              <button type="button" onClick={() => { setFocusLatestSession(true); triggerFilePicker(); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 50, background: "#fff", color: "#1e4a34", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", border: "1.5px solid #e0dbd2" }}>
                Upload XLSX
              </button>
              <button type="button" onClick={openManualDialog} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 50, background: "#f3f9f6", color: "#1e4a34", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", border: "1.5px solid #e0dbd2" }}>
                Manual Session
              </button>
              <button
                type="button"
                onClick={handleAddClick}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 50, background: GRN, color: "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", border: "none", boxShadow: "0 4px 16px rgba(26,74,52,0.34)", letterSpacing: "0.02em" }}
              >
                <Plus size={16} strokeWidth={2.5} /> Add Score
              </button>
            </div>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileSelected} />

      <Dialog open={isUploadConfirmOpen} onOpenChange={(open) => {
        if (!open) {
          setIsUploadConfirmOpen(false);
          setPendingUploadFile(null);
          setPendingWorkbookSheets([]);
          setPendingDateOptions([]);
          setSelectedUploadDate("");
          workbookRef.current = null;
        }
      }}>
        <DialogContent className="rounded-2xl w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto flex flex-col top-[45%] sm:top-[43%] md:top-[41%]" style={{ background: "#fffdf9", border: "1.5px solid #e4ddd0" }}>
          {isAddingScores && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e7dfd2] bg-[#fffdf9] px-6 py-5 shadow-xl">
                <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-teal-800">Adding Scores</span>
              </div>
            </div>
          )}
          <DialogHeader>
            <DialogTitle style={{ color: "#1a1810" }}>Confirm workbook sheets</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p style={{ margin: 0, color: "#6f6659", fontSize: "0.9rem" }}>
              Confirm which workbook tabs should be treated as the Scores sheet and the optional Rounds sheet, then pick the date block to upload.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-semibold text-stone-700">Scores sheet</Label>
                <Select value={selectedScoresSheetName} onValueChange={setSelectedScoresSheetName}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select scores sheet" />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingWorkbookSheets.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-semibold text-stone-700">Rounds sheet (optional)</Label>
                <Select value={selectedRoundsSheetName} onValueChange={setSelectedRoundsSheetName}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select rounds sheet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No rounds sheet</SelectItem>
                    {pendingWorkbookSheets.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-semibold text-stone-700">Date to update</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full rounded-xl border-[#EAD8C0]/40 bg-white px-3 py-2 text-sm font-normal justify-between text-left h-10" disabled={pendingDateOptions.length === 0}>
                    {selectedUploadDateCalendar ? format(selectedUploadDateCalendar, "dd MMM yyyy") : (pendingDateOptions.length > 0 ? "Pick a date" : "No dates detected")}
                    <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" align="start" side="bottom">
                  <Calendar
                    mode="single"
                    selected={selectedUploadDateCalendar}
                    onSelect={(date) => {
                      if (!date) return;
                      setSelectedUploadDate(format(date, "yyyy-MM-dd"));
                    }}
                    disabled={(date) => !pendingDateOptions.includes(format(date, "yyyy-MM-dd"))}
                    initialFocus
                    className="bg-[#FAF7F2] border-2 border-[#EAD8C0]/50 rounded-2xl scale-90 origin-top-left shadow-xl"
                    classNames={{
                      day_selected: "!bg-[#EAD8C0] !text-[#8B735B] hover:!bg-[#d4bc9a] focus:!bg-[#EAD8C0]",
                      day_today: "bg-white text-[#8B735B] font-bold border border-[#EAD8C0]",
                      day: "hover:!bg-[#EAD8C0]/20 rounded-md transition-colors",
                      day_disabled: "opacity-30 cursor-not-allowed hover:!bg-transparent",
                      head_cell: "text-[#8B735B] font-bold w-7",
                      cell: "h-7 w-7 text-center text-[11px] p-0 relative [&:has([aria-selected])]:!bg-transparent focus-within:relative focus-within:z-20",
                    }}
                  />
                </PopoverContent>
              </Popover>
              <p style={{ margin: 0, color: "#7d7265", fontSize: "0.78rem" }}>
                Upload will only update the selected date block from the Scores sheet.
              </p>
            </div>
            {pendingWorkbookSheets.length > 0 && (
              <div className="rounded-xl border border-[#e7dfd2] bg-[#faf7f1] p-3 text-sm text-stone-700">
                Detected tabs: {pendingWorkbookSheets.join(", ")}
              </div>
            )}
            <div className="flex gap-3 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setIsUploadConfirmOpen(false)} className="rounded-xl" disabled={isAddingScores}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmUploadFile} disabled={isAddingScores || (pendingDateOptions.length > 0 && !selectedUploadDate)} className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white disabled:opacity-60">
                {isAddingScores ? "Adding Scores..." : "Confirm & Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

        {!loading && sessionDateOptions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} style={{ marginTop: 18, background: "#fff", borderRadius: 18, border: "1.5px solid #e0dbd2", boxShadow: "0 6px 32px rgba(26,74,52,0.08)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #efe9df", background: "linear-gradient(90deg,#fbfaf7,#f7f5ef)" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#1a1810" }}>Session Scores by Date and Event</h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#7d7265" }}>Pick a date or apply a filter to load the session scores. Event is optional, and rounds appear only when the selected event has round-wise data.</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "14px 20px", borderBottom: "1px solid #efe9df", background: "#fff" }}>
              <div style={{ width: 220 }}>
                <Select value={selectedSessionDate} onValueChange={setSelectedSessionDate}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Session date" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionDateOptions.map((date) => (
                      <SelectItem key={date} value={date}>{date}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div style={{ width: 220 }}>
                <Select value={selectedSessionEvent} onValueChange={setSelectedSessionEvent}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All events</SelectItem>
                    {sessionEventOptions.map((eventType) => (
                      <SelectItem key={eventType} value={eventType}>{eventType}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sessionRoundOptions.length > 1 && (
                <div style={{ width: 180 }}>
                  <Select value={selectedSessionRound} onValueChange={setSelectedSessionRound}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Round" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Total</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div style={{ minWidth: 240, flex: "1 1 240px" }}>
                <Input
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder="Search by name or enrollment"
                  className="rounded-xl"
                />
              </div>
              <div style={{ width: 220 }}>
                <Select value={sessionSort} onValueChange={(value) => setSessionSort(value as typeof sessionSort)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score-desc">Score: High to Low</SelectItem>
                    <SelectItem value="score-asc">Score: Low to High</SelectItem>
                    <SelectItem value="name-asc">Name: A to Z</SelectItem>
                    <SelectItem value="name-desc">Name: Z to A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div style={{ maxHeight: 520, overflowY: "auto", padding: 18 }}>
              {!sessionFiltersApplied || !selectedSessionGroup ? (
                <div style={{ padding: 16, borderRadius: 14, background: "#faf7f1", border: "1px dashed #e5dac8", color: "#7d7265", fontSize: "0.88rem", fontWeight: 600 }}>
                  Apply a session filter to view scores.
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 12px", borderRadius: 999, background: "#edf6f0", color: "#1e5c42", fontSize: "0.78rem", fontWeight: 800 }}>
                      {selectedSessionGroup.date}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "#7d7265", fontWeight: 600 }}>
                      {selectedEventGroups.length} event{selectedEventGroups.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {visibleEventGroups.map((eventGroup) => (
                  <div key={eventGroup.type} style={{ padding: 14, borderRadius: 14, background: "#fbfaf7", border: "1px solid #efe9df" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, background: "#f7f2e8", color: "#8a5a1f", fontSize: "0.74rem", fontWeight: 700 }}>
                        {eventGroup.type}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "#7d7265", fontWeight: 600 }}>
                        Attendees: {eventGroup.sessions[0]?.attendees.length || 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteEventGroup(selectedSessionGroup.date, eventGroup.type)}
                        disabled={deletingSessionId === `${selectedSessionGroup.date}:${eventGroup.type}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, border: "1px solid #efd8d8", background: "#fff6f6", color: "#b23a3a", cursor: deletingSessionId === `${selectedSessionGroup.date}:${eventGroup.type}` ? "wait" : "pointer", opacity: deletingSessionId === `${selectedSessionGroup.date}:${eventGroup.type}` ? 0.65 : 1, fontSize: "0.74rem", fontWeight: 700 }}
                        title="Delete date and event"
                      >
                        <Trash2 size={14} /> Delete event data
                      </button>
                    </div>

                    {eventGroup.sessions.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {eventGroup.sessions.map((session) => (
                          <div key={session.id} style={{ padding: "10px 12px", borderRadius: 12, background: "#fff", border: "1px solid #efe9df" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <div>
                                <p style={{ margin: 0, fontSize: "0.86rem", fontWeight: 700, color: "#1a1810" }}>{session.round > 1 ? `Round ${session.round}` : "Total"}</p>
                                <p style={{ margin: 0, fontSize: "0.72rem", color: "#8a7e72" }}>Session ID: {session.id}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteSession(session.id)}
                                disabled={deletingSessionId === session.id}
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 10, border: "1px solid #efd8d8", background: "#fff6f6", color: "#b23a3a", cursor: deletingSessionId === session.id ? "wait" : "pointer", opacity: deletingSessionId === session.id ? 0.65 : 1 }}
                                aria-label="Delete session"
                                title="Delete session"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
                              {session.scoreEntries.map((entry) => {
                                const keySave = `${session.id}:${entry.enrollment_no}:save`;
                                const keyDelete = `${session.id}:${entry.enrollment_no}:delete`;
                                const isBusy = savingSessionKey === keySave || savingSessionKey === keyDelete;
                                return (
                                  <div key={`${session.id}_${entry.enrollment_no}`} style={{ border: "1px solid #eee4d6", borderRadius: 10, padding: "8px 10px", background: "#fcfbf8" }}>
                                    <div style={{ marginBottom: 6 }}>
                                      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#1a1810" }}>{studentNameByEnrollment.get(entry.enrollment_no) || entry.enrollment_no}</p>
                                      <p style={{ margin: 0, fontSize: "0.72rem", color: "#8a7e72" }}>{entry.enrollment_no}</p>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <Input
                                        type="number"
                                        value={getSessionDraftScore(session.id, entry.enrollment_no, entry.score)}
                                        onChange={(e) => setSessionDraftScore(session.id, entry.enrollment_no, e.target.value)}
                                        className="rounded-lg h-8"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveStudentSessionScore(session.id, entry.enrollment_no, entry.score)}
                                        disabled={isBusy}
                                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "1px solid #c8d8c0", background: "#edf6f0", color: "#1e4a34", cursor: isBusy ? "wait" : "pointer", opacity: isBusy ? 0.65 : 1 }}
                                        title="Save score"
                                        aria-label="Save score"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteStudentSessionScore(session.id, entry.enrollment_no)}
                                        disabled={isBusy}
                                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "1px solid #efd8d8", background: "#fff6f6", color: "#b23a3a", cursor: isBusy ? "wait" : "pointer", opacity: isBusy ? 0.65 : 1 }}
                                        title="Delete student score"
                                        aria-label="Delete student score"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: 12, borderRadius: 12, background: "#fff7f7", color: "#a33", fontSize: "0.85rem", border: "1px solid #f0d5d5" }}>
                        No score entries stored for this event.
                      </div>
                    )}
                  </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

      {/* Leaderboard Table */}
      <div style={{ display: "flex", gap: 18, marginTop: 18, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {loading && <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}><Loader2 style={{ width: 28, height: 28, color: "#1e4a34", animation: "spin 1s linear infinite" }} /></div>}
          
          {!loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", border: "1.5px solid #e0dbd2", boxShadow: "0 6px 32px rgba(26,74,52,0.09)", borderTop: "3.5px solid #1a3a2a", flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ overflowX: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "linear-gradient(90deg,#f8f6f1,#fbfaf7)" }}>
                    <th style={{ padding: "13px 24px", textAlign: "left", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0", width: 80 }}>Rank</th>
                    <th style={{ padding: "13px 16px", textAlign: "left", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0" }}>Student</th>
                    <th style={{ padding: "13px 12px", textAlign: "left", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0", width: 140 }}>Batch</th>
                    <th style={{ padding: "13px 12px", textAlign: "left", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0", width: 120 }}>Score</th>
                    {viewMode !== "weekly" && <th style={{ padding: "13px 24px", textAlign: "center", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0", width: 100 }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="sync">
                    {viewMode === "weekly" ? (
                      weeklyLeaderboard.map((st, i) => (
                        <motion.tr key={st.enrollment_no} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.02, duration: 0.2 }}
                          style={{ borderBottom: "1px solid #f4f1eb", transition: "background 0.15s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(90deg,#f5f3ee,#faf9f6)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>

                          <td style={{ padding: "12px 24px" }}>
                            {st.rank && st.rank <= 3 ? (
                              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: st.rank === 1 ? "#fff3cc" : st.rank === 2 ? "#f0f0f0" : "#ffeadb", border: `1px solid ${st.rank === 1 ? "#f0d060" : st.rank === 2 ? "#d0d0d0" : "#f0b080"}` }}>
                                <Trophy size={14} color={st.rank === 1 ? "#b08000" : st.rank === 2 ? "#606060" : "#a05020"} />
                              </div>
                            ) : (
                              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#8a7e72", marginLeft: 8 }}>#{i + 1}</span>
                            )}
                          </td>

                          <td style={{ padding: "12px 16px" }}>
                            <div onClick={() => setSelectedPanelStudent(st.enrollment_no)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: 'pointer' }}>
                              <img src={st.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(st.name || 'U')}&background=random`} alt="" style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover' }} />
                              <div>
                                <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#18180e", lineHeight: 1.3, margin: 0 }}>{st.name}</p>
                                <p style={{ fontSize: "0.72rem", color: "#b0a898", lineHeight: 1.3, margin: 0 }}>{st.enrollment_no}</p>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: "12px 12px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: 50, fontSize: "0.74rem", fontWeight: 700, background: "#e4f0ec", color: "#1e5c42", border: "1.5px solid #aad4c0" }}>{st.batch || "N/A"}</span>
                          </td>

                          <td style={{ padding: "12px 12px", textAlign: "left" }}>
                            <span style={{ fontSize: "1rem", fontWeight: 800, color: i === 0 ? "#1e4a34" : "#18180e" }}>{st.score}</span>
                          </td>

                          {viewMode !== "weekly" && (
                            <td style={{ padding: "12px 24px", textAlign: "center" }}>
                              {hasWriteAccess() && (
                              <button onClick={() => handleEditClick(st as any)} style={{ width: 30, height: 30, borderRadius: 8, border: "1.5px solid #c8d8c0", background: "#edf6f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={e => (e.currentTarget.style.background = "#d4ecdc")} onMouseLeave={e => (e.currentTarget.style.background = "#edf6f0") }>
                                <Pencil size={13} color="#1e5c42" />
                              </button>
                              )}
                            </td>
                          )}
                        </motion.tr>
                      ))
                    ) : (
                      paged.map((s, i) => {
                        const rank = (currentPage - 1) * PG + i;
                        return (
                          <motion.tr key={s.enrollment_no} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.02, duration: 0.2 }}
                            style={{ borderBottom: "1px solid #f4f1eb", transition: "background 0.15s" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(90deg,#f5f3ee,#faf9f6)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                            
                            <td style={{ padding: "12px 24px" }}>
                              {rank < 3 ? (
                                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: rank === 0 ? "#fff3cc" : rank === 1 ? "#f0f0f0" : "#ffeadb", border: `1px solid ${rank === 0 ? "#f0d060" : rank === 1 ? "#d0d0d0" : "#f0b080"}` }}>
                                  <Trophy size={14} color={rank === 0 ? "#b08000" : rank === 1 ? "#606060" : "#a05020"} />
                                </div>
                              ) : (
                                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#8a7e72", marginLeft: 8 }}>#{rank + 1}</span>
                              )}
                            </td>

                            <td style={{ padding: "12px 16px" }}>
                              <div onClick={() => setSelectedPanelStudent(s.enrollment_no)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: 'pointer' }}>
                                <StudentAvatar name={s.name} enrollmentNo={s.enrollment_no} photoUrl={s.profile_image} className="w-10 h-10" />
                                <div>
                                  <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#18180e", lineHeight: 1.3, margin: 0 }}>{s.name}</p>
                                  <p style={{ fontSize: "0.72rem", color: "#b0a898", lineHeight: 1.3, margin: 0 }}>{s.enrollment_no}</p>
                                </div>
                              </div>
                            </td>

                            <td style={{ padding: "12px 12px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: 50, fontSize: "0.74rem", fontWeight: 700, background: "#e4f0ec", color: "#1e5c42", border: "1.5px solid #aad4c0" }}>{s.batch || "N/A"}</span>
                            </td>

                            <td style={{ padding: "12px 12px", textAlign: "left" }}>
                              <span style={{ fontSize: "1rem", fontWeight: 800, color: rank === 0 ? "#1e4a34" : "#18180e" }}>{s.points}</span>
                            </td>

                            {viewMode !== "weekly" && (
                              <td style={{ padding: "12px 24px", textAlign: "center" }}>
                                {hasWriteAccess() && (
                                <button onClick={() => handleEditClick(s)} style={{ width: 30, height: 30, borderRadius: 8, border: "1.5px solid #c8d8c0", background: "#edf6f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={e => (e.currentTarget.style.background = "#d4ecdc")} onMouseLeave={e => (e.currentTarget.style.background = "#edf6f0") }>
                                  <Pencil size={13} color="#1e5c42" />
                                </button>
                                )}
                              </td>
                            )}
                          </motion.tr>
                        );
                      })
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {viewMode !== "weekly" && (
              <div style={{ padding: "13px 24px", borderTop: "1px solid #f4f1eb", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fbfaf7", borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8a7e72", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Showing {(currentPage - 1) * PG + 1}–{Math.min(currentPage * PG, scores.length)} of {scores.length}
                </span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #e0dbd2", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: currentPage === 1 ? 0.4 : 1 }}><ChevronLeft size={16} /></button>
                  <div style={{ display: "flex", gap: 4 }}>
                    {Array.from({ length: Math.ceil(scores.length / PG) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setCurrentPage(p)} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #e0dbd2", background: currentPage === p ? GRN : "#fff", color: currentPage === p ? "#fff" : "#6a6050", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", transition: "0.2s" }}>{p}</button>
                    ))}
                  </div>
                  <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(scores.length / PG), p + 1))} disabled={currentPage === Math.ceil(scores.length / PG)} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #e0dbd2", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: currentPage === Math.ceil(scores.length / PG) ? 0.4 : 1 }}><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
            </motion.div>
          )}
        </div>

        {/* Right Panel: weekly leaderboard + student drill-down (only for weekly view) */}
        {viewMode === "weekly" && (
        <div style={{ width: 360, minWidth: 260 }}>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #efe9df", padding: 14, boxShadow: "0 6px 22px rgba(26,74,52,0.04)" }}>
            <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: "#1a1810" }}>Weekly Leaderboard</h4>
            <p style={{ margin: "6px 0 12px", fontSize: "0.78rem", color: "#7d7265" }}>Click a student to see day-wise progress (last 7 days)</p>

            {!selectedPanelStudent ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Overall weekly totals chart */}
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overallWeeklyTotals} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="overallFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1e4a34" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#1e4a34" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f4f5f6" />
                      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                      <YAxis tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} width={28} />
                      <RechartsTooltip content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (<div style={{ background: '#1a3a2a', color: '#fff', padding: 8, borderRadius: 8 }}><div style={{ fontSize: 12, fontWeight: 800 }}>{d.label}</div><div style={{ fontSize: 14, fontWeight: 900 }}>{d.total}</div></div>);
                      }} />
                      <Area type="monotone" dataKey="total" stroke="#1e4a34" strokeWidth={3} fill="url(#overallFill)" dot={{ r: 3, fill: '#1e4a34', strokeWidth: 2, stroke: '#fff' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ fontSize: '0.82rem', color: '#7d7265', fontWeight: 700 }}>Weekly Totals (last {weeklyDateSeries.length} dates)</div>

                {/* Student list below the chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {weeklyLeaderboard.length > 0 ? weeklyLeaderboard.map((st) => (
                    <button key={st.enrollment_no} onClick={() => setSelectedPanelStudent(st.enrollment_no)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, border: "1px solid #f0efe9", background: "#fbfaf7", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#edf6f0", color: "#1e5c42", fontWeight: 800 }}>{st.rank}</div>
                      <img src={st.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(st.name || 'U')}&background=random`} alt="" style={{ width: 36, height: 36, borderRadius: 999, objectFit: "cover" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#18180e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#8a7e72" }}>{st.batch || st.enrollment_no}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 900, color: "#1e4a34" }}>{st.score}</div>
                        <div style={{ fontSize: "0.72rem", color: "#8a7e72" }}>pts</div>
                      </div>
                    </button>
                  )) : (
                    <div style={{ padding: 12, borderRadius: 10, border: "1px dashed #efe9df", background: "#fff8f8", color: "#a33" }}>No weekly session data</div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={() => setSelectedPanelStudent("")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e0dbd2", background: "#fff" }}>Back</button>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <img src={(cachedStudentsData.find(s => normalizeText(s.enrollment_no) === selectedPanelStudent)?.profile_image) || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedPanelStudent)}&background=random`} alt="" style={{ width: 44, height: 44, borderRadius: 999 }} />
                    <div>
                      <div style={{ fontWeight: 800 }}>{(cachedStudentsData.find(s => normalizeText(s.enrollment_no) === selectedPanelStudent)?.student_name) || selectedPanelStudent}</div>
                      <div style={{ fontSize: 12, color: "#8a7e72" }}>{(cachedStudentsData.find(s => normalizeText(s.enrollment_no) === selectedPanelStudent)?.batch) || ''}</div>
                    </div>
                  </div>
                </div>

                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedPanelProgress} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="spFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1e4a34" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#1e4a34" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f4f5f6" />
                      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                      <YAxis tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} width={28} />
                      <RechartsTooltip content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (<div style={{ background: '#1a3a2a', color: '#fff', padding: 8, borderRadius: 8 }}><div style={{ fontSize: 12, fontWeight: 800 }}>{d.label}</div><div style={{ fontSize: 14, fontWeight: 900 }}>{d.score}</div></div>);
                      }} />
                      <Area type="monotone" dataKey="score" stroke="#1e4a34" strokeWidth={3} fill="url(#spFill)" dot={{ r: 4, fill: '#1e4a34', strokeWidth: 2, stroke: '#fff' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, padding: 8, borderRadius: 8, background: '#f6fffa', border: '1px solid #e6f6ee' }}>
                    <div style={{ fontSize: 11, color: '#059669', fontWeight: 800 }}>Total</div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>{selectedPanelSummary.total}</div>
                  </div>
                  <div style={{ flex: 1, padding: 8, borderRadius: 8, background: '#fff7ed', border: '1px solid #fbe6d2' }}>
                    <div style={{ fontSize: 11, color: '#b45309', fontWeight: 800 }}>Best Day</div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>{selectedPanelSummary.bestDay?.label || '-'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Bulk Add Scores Dialog */}
      <Dialog open={showAddForm} onOpenChange={(open) => { if (!open) setShowAddForm(false); }}>
        <DialogContent className="rounded-2xl sm:max-w-3xl max-h-[90vh] flex flex-col" style={{ background: "#fffdf9", border: "1.5px solid #e4ddd0" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#1a1810" }}>Add Scores</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="flex flex-col md:flex-row gap-4 md:items-center">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-1">
                <label className="font-semibold text-sm text-stone-700 shrink-0">Period:</label>
                <Select value={addPeriod} onValueChange={setAddPeriod}>
                  <SelectTrigger className="border-2 border-[#EAD8C0]/40 bg-white px-3 py-2 rounded-lg text-sm flex-1 text-stone-700 font-medium">
                    <SelectValue placeholder="Select Period" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FAF7F2] border-2 border-[#EAD8C0]">
                    {monthOptions.map(m => (
                      <SelectItem key={m} value={m} className="font-medium">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-1">
                <label className="font-semibold text-sm text-stone-700 shrink-0">Search:</label>
                <input
                  type="text"
                  placeholder="Search by student name..."
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  className="border-2 border-[#EAD8C0]/40 bg-white px-3 py-2 rounded-lg text-sm flex-1 text-stone-700 font-medium focus:outline-none focus:border-[#EAD8C0] focus:ring-2 focus:ring-[#EAD8C0]/20"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-gradient-to-r from-[#EAD8C0]/30 to-stone-100/30 border-b-2 border-[#EAD8C0]/50">
                    <th className="text-left px-4 py-3 text-[#8B735B] font-bold">Student</th>
                    <th className="text-center px-4 py-3 text-[#8B735B] font-bold">Enrollment No.</th>
                    <th className="text-center px-4 py-3 text-[#8B735B] font-bold">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {cachedStudentsData.filter((s: any) => s.student_name?.toLowerCase().includes(searchName.toLowerCase())).map((student: any, idx: number) => (
                    <tr key={student.enrollment_no} className={`border-b border-[#EAD8C0]/20 hover:bg-[#EAD8C0]/10 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAF7F2]/50'}`}>
                      <td className="px-4 py-3 text-stone-700 font-medium">{student.student_name}</td>
                      <td className="px-4 py-3 text-center text-stone-600 font-mono text-xs">{student.enrollment_no}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={addScores[student.enrollment_no]?.points || ""}
                          onChange={e => setAddScores({ ...addScores, [student.enrollment_no]: { ...addScores[student.enrollment_no], points: e.target.value } })}
                          className="border-2 border-[#EAD8C0]/40 bg-white px-2 py-2 rounded-md w-24 text-center text-stone-700 font-medium focus:outline-none focus:border-[#EAD8C0] focus:ring-2 focus:ring-[#EAD8C0]/20"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {addError && <div className="text-red-700 text-sm p-2 bg-red-50 rounded-md border border-red-300">{addError}</div>}
            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={adding} className="bg-teal-700 hover:bg-teal-800 text-white font-semibold py-2 rounded-lg transition-colors flex-1">
                {adding ? "Adding..." : "Submit Scores"}
              </Button>
              <Button type="button" onClick={() => setShowAddForm(false)} className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold py-2 rounded-lg transition-colors">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manual Session Dialog */}
      <Dialog open={isManualOpen} onOpenChange={(open) => { if (!open) setIsManualOpen(false); }}>
        <DialogContent className="rounded-2xl sm:max-w-4xl max-h-[90vh] flex flex-col" style={{ background: "#fffdf9", border: "1.5px solid #e4ddd0" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#1a1810" }}>Manual Session Entry</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-3">
                <label className="font-semibold text-sm text-stone-700">Date</label>
                <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="w-44" />
              </div>

              <div className="flex items-center gap-3">
                <label className="font-semibold text-sm text-stone-700">Type</label>
                <Select value={manualType} onValueChange={setManualType}>
                  <SelectTrigger className="px-3 py-2 rounded-lg w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Test">Test</SelectItem>
                    <SelectItem value="Debate">Debate</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <label className="font-semibold text-sm text-stone-700">Rounds</label>
                <Select value={String(manualRounds)} onValueChange={(v) => setManualRounds(Number(v))}>
                  <SelectTrigger className="px-3 py-2 rounded-lg w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 border-t pt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF7F2]">
                    <th className="text-left px-4 py-2">Student</th>
                    <th className="text-center px-4 py-2">Enrollment</th>
                    {Array.from({ length: manualRounds }, (_, r) => (
                      <th key={r} className="text-center px-2 py-2">R{r + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cachedStudentsData.map((s: any) => (
                    <tr key={s.enrollment_no} className="border-b">
                      <td className="px-4 py-2">{s.student_name}</td>
                      <td className="px-4 py-2 text-center">{s.enrollment_no}</td>
                      {Array.from({ length: manualRounds }, (_, r) => (
                        <td key={r} className="px-2 py-2 text-center">
                          <input type="number" min="0" step="0.1" value={manualScores[s.enrollment_no]?.[r] ?? ''} onChange={e => {
                            const v = e.target.value === '' ? undefined : Number(e.target.value);
                            setManualScores(prev => {
                              const copy = { ...prev };
                              const arr = copy[s.enrollment_no] ? [...copy[s.enrollment_no]] : Array(manualRounds).fill(undefined);
                              arr[r] = v;
                              copy[s.enrollment_no] = arr as any;
                              return copy;
                            });
                          }} className="w-20 px-2 py-1 rounded-md border" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleManualSubmit} className="bg-teal-700 hover:bg-teal-800 text-white">Upload Session</Button>
              <Button variant="outline" onClick={() => setIsManualOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md" style={{ background: "#fffdf9", border: "1.5px solid #e4ddd0" }}>
          <DialogHeader><DialogTitle style={{ color: "#1a1810" }}>Edit Score Record</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#f8f6f1", borderRadius: 12, border: "1px solid #ede8e0" }}>
              <StudentAvatar name={editingScore?.name || ""} photoUrl={editingScore?.profile_image} className="w-12 h-12" />
              <div>
                <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#18180e", margin: 0 }}>{editingScore?.name}</p>
                <p style={{ fontSize: "0.75rem", color: "#8a7e72", margin: 0 }}>{editingScore?.enrollment_no}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#5a4a38" }}>Academic Points</Label><Input type="number" value={formData.points} onChange={e => setFormData({ ...formData, points: Number(e.target.value) })} className="rounded-xl" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={handleDelete} disabled={isSaving} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 12, background: "#fde8ec", border: "1.5px solid #f4b8c0", color: "#c0363a", cursor: "pointer" }}><Trash2 size={18} /></button>
              <Button variant="outline" className="rounded-xl" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button className="rounded-xl" style={{ background: GRN, color: "#fff" }} onClick={handleUpdate} disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}